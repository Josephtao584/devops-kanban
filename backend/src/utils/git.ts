import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import * as fs from 'node:fs';

import { STORAGE_PATH } from '../config/index.js';
import { logger } from './logger.js';

// Timeouts on git invocations — without these, a hung git/network operation
// blocks the entire Node event loop. Local git ops (worktree add/remove,
// rev-parse, branch -D, prune) are always fast; clone/fetch may legitimately
// take a while over slow networks but still need a hard upper bound.
const GIT_LOCAL_TIMEOUT_MS = 30_000;
const GIT_NETWORK_TIMEOUT_MS = 180_000;

/**
 * Run `git` with explicit argv to avoid shell interpretation. Inputs like
 * repoUrl, worktreePath, branchName flow in from the database and would be
 * unsafe to interpolate into a shell command string. Returns combined
 * stdout; throws an Error whose `.stderr` matches what spawnSync sets so
 * existing error-handling paths keep working.
 */
function runGit(
  args: string[],
  options: { cwd?: string; timeoutMs?: number; allowFailure?: boolean } = {},
): string {
  const result = spawnSync('git', args, {
    cwd: options.cwd,
    encoding: 'utf-8',
    timeout: options.timeoutMs ?? GIT_LOCAL_TIMEOUT_MS,
    shell: false,
  });

  if (result.error) {
    if (options.allowFailure) return '';
    const err = result.error as Error & { stderr?: string };
    err.stderr = result.stderr || '';
    throw err;
  }

  if (result.status !== 0) {
    if (options.allowFailure) return result.stdout || '';
    const stderr = result.stderr || '';
    const err: Error & { stderr?: string; status?: number | null } = new Error(
      stderr || `git ${args[0]} failed with status ${result.status}`,
    );
    err.stderr = stderr;
    err.status = result.status;
    throw err;
  }

  return result.stdout || '';
}

type WorktreeStatusItem = {
  path: string;
  head?: string;
  branch?: string;
};

export function sanitizeName(str: string) {
  return str
    .replace(/[\u4e00-\u9fff]/g, '')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export function buildBranchName(taskId: number, taskTitle: string, maxLength = 80): string {
  const safeTitle = sanitizeName(taskTitle).substring(0, 50);
  const branch = `task/${taskId}-${safeTitle}`;
  return branch.length > maxLength ? branch.substring(0, maxLength) : branch;
}

/**
 * Compute the deterministic local cache directory for an external repository.
 * Used so callers can locate an already-cloned external repo without re-running
 * network operations. Returns `<STORAGE_PATH>/repos/<sha256(url)[0..16]>`.
 */
export function getExternalRepoPath(repoUrl: string): string {
  const hash = crypto.createHash('sha256').update(repoUrl).digest('hex').slice(0, 16);
  return path.join(STORAGE_PATH, 'repos', hash);
}

/**
 * Ensure a clone of an external repo exists at `data/repos/<hash(url)>/`.
 * If the clone already exists, fetch latest refs. Otherwise clone fresh.
 * Returns the local path to the clone.
 */
export async function ensureExternalRepo(repoUrl: string): Promise<string> {
  if (!repoUrl || !repoUrl.trim()) {
    throw new Error('ensureExternalRepo: repoUrl is required');
  }

  const repoDir = getExternalRepoPath(repoUrl);

  if (fs.existsSync(repoDir) && isGitRepository(repoDir)) {
    try {
      runGit(['fetch', '--all', '--prune'], {
        cwd: repoDir,
        timeoutMs: GIT_NETWORK_TIMEOUT_MS,
      });
    } catch (error) {
      const execError = error as Error & { stderr?: string };
      logger.warn('Git', `Failed to fetch external repo ${repoUrl}: ${execError.stderr || execError.message}`);
    }
    return repoDir;
  }

  // Stale directory that is not a git repo: remove and re-clone
  if (fs.existsSync(repoDir)) {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }

  fs.mkdirSync(path.dirname(repoDir), { recursive: true });

  try {
    runGit(['clone', repoUrl, repoDir], { timeoutMs: GIT_NETWORK_TIMEOUT_MS });
  } catch (error) {
    const execError = error as Error & { stderr?: string };
    const stderr = execError.stderr || execError.message;
    throw new Error(`Failed to clone external repository ${repoUrl}: ${stderr}`);
  }

  if (!isGitRepository(repoDir)) {
    throw new Error(`Cloned directory is not a valid git repository: ${repoDir}`);
  }

  return repoDir;
}

export function getWorktreePath(taskId: number, taskTitle: string, repoPath: string) {
  const safeTitle = sanitizeName(taskTitle).substring(0, 50);
  const baseDir = path.join(repoPath, '.worktrees');
  return path.join(baseDir, `task-${taskId}-${safeTitle}`);
}

export function createWorktree(taskId: number, taskTitle: string, repoPath = process.cwd()) {
  const worktreePath = getWorktreePath(taskId, taskTitle, repoPath);
  const branchName = buildBranchName(taskId, taskTitle);
  try {
    ensureWorktreesGitignore(repoPath);

    if (fs.existsSync(worktreePath)) {
      return worktreePath;
    }

    // Prune stale worktree references (dir deleted but git still tracks it)
    runGit(['worktree', 'prune'], { cwd: repoPath, allowFailure: true });

    const parentDir = path.dirname(worktreePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Check if branch already exists
    let branchExists = false;
    try {
      runGit(['rev-parse', '--verify', `refs/heads/${branchName}`], { cwd: repoPath });
      branchExists = true;
    } catch {
      branchExists = false;
    }

    if (branchExists) {
      // Branch exists, just add worktree without creating branch
      runGit(['worktree', 'add', worktreePath, branchName], { cwd: repoPath });
    } else {
      // Branch doesn't exist, create it with worktree
      runGit(['worktree', 'add', '-b', branchName, worktreePath], { cwd: repoPath });
    }

    // Copy .claude/ config (settings.json, settings.local.json) to worktree
    copyClaudeConfig(repoPath, worktreePath);

    return worktreePath;
  } catch (error) {
    const execError = error as Error & { stderr?: string };
    const stderr = execError.stderr || execError.message;
    // Improve error message for empty repository
    if (stderr.includes('Not a valid object name') || stderr.includes('does not have any commits')) {
      throw new Error(`Git 仓库还没有提交，无法创建 worktree。请先对仓库进行初始提交。`);
    }
    throw new Error(`Failed to create worktree: ${stderr}`);
  }
}

function copyClaudeConfig(repoPath: string, worktreePath: string) {
  const srcDir = path.join(repoPath, '.claude');
  const destDir = path.join(worktreePath, '.claude');

  if (!fs.existsSync(srcDir)) return;

  const filesToCopy = ['settings.json', 'settings.local.json'];
  let copied = false;

  for (const file of filesToCopy) {
    const srcFile = path.join(srcDir, file);
    if (fs.existsSync(srcFile)) {
      if (!copied) {
        fs.mkdirSync(destDir, { recursive: true });
        copied = true;
      }
      fs.copyFileSync(srcFile, path.join(destDir, file));
    }
  }
}

function ensureWorktreesGitignore(repoPath: string) {
  const gitignorePath = path.join(repoPath, '.gitignore');
  const worktreesEntry = '.worktrees/';

  try {
    let existingContent = '';
    if (fs.existsSync(gitignorePath)) {
      existingContent = fs.readFileSync(gitignorePath, 'utf-8');
    }

    const lines = existingContent.split('\n');
    const hasWorktrees = lines.some((line) => line.trim() === worktreesEntry);

    if (!hasWorktrees) {
      const newContent = existingContent ? `${existingContent.trim()}\n${worktreesEntry}\n` : `${worktreesEntry}\n`;
      fs.writeFileSync(gitignorePath, newContent, 'utf-8');
    }
  } catch (error) {
    const execError = error as Error;
    logger.error('Git', `Failed to update .gitignore: ${execError.message}`);
  }
}

export function cleanupWorktree(worktreePath: string, repoPath = process.cwd(), branchName: string | null = null) {
  try {
    if (fs.existsSync(worktreePath)) {
      runGit(['worktree', 'remove', worktreePath, '--force'], { cwd: repoPath });
    }
    if (branchName) {
      try {
        runGit(['branch', '-D', branchName, '--force'], { cwd: repoPath });
      } catch {
        logger.info('Git', `Branch ${branchName} may not exist, skipping deletion`);
      }
    }
    return true;
  } catch (error) {
    const execError = error as Error;
    logger.error('Git', `Failed to cleanup worktree ${worktreePath}:`, { error: execError.message });
    return false;
  }
}

export function getWorktreeStatus(repoPath = process.cwd()): WorktreeStatusItem[] {
  try {
    const output = runGit(['worktree', 'list', '--porcelain'], { cwd: repoPath });
    const worktrees: WorktreeStatusItem[] = [];
    const lines = output.trim().split('\n');
    let currentWorktree: WorktreeStatusItem | null = null;
    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        if (currentWorktree) {
          worktrees.push(currentWorktree);
        }
        currentWorktree = { path: line.substring(9) };
      } else if (line.startsWith('head ') && currentWorktree) {
        currentWorktree.head = line.substring(5);
      } else if (line.startsWith('branch ') && currentWorktree) {
        currentWorktree.branch = line.substring(7);
      }
    }
    if (currentWorktree) {
      worktrees.push(currentWorktree);
    }
    return worktrees;
  } catch {
    return [];
  }
}

export function isGitRepository(repoPath = process.cwd()) {
  const result = spawnSync('git', ['rev-parse', '--git-dir'], {
    cwd: repoPath,
    stdio: 'ignore',
    timeout: GIT_LOCAL_TIMEOUT_MS,
    shell: false,
  });
  return result.status === 0;
}

export interface MergeResult {
  success: boolean;
  conflicts: string[];
  hasConflicts: boolean;
  message: string;
}

export function mergeBranch(
  sourceBranch: string,
  repoPath: string,
  options: { noFastForward?: boolean; message?: string } = {}
): MergeResult {
  const { noFastForward = true, message } = options;

  // 构建合并命令
  const args = ['merge'];
  if (noFastForward) args.push('--no-ff');
  args.push(sourceBranch);
  if (message) {
    args.push('-m', message);
  }

  const result = spawnSync('git', args, {
    cwd: repoPath,
    encoding: 'utf-8',
    timeout: GIT_LOCAL_TIMEOUT_MS,
    shell: false,
  });

  if (result.status === 0) {
    return {
      success: true,
      conflicts: [],
      hasConflicts: false,
      message: result.stdout || 'Merge completed successfully',
    };
  }

  const combinedOutput = (result.stderr || '') + (result.stdout || '');

  // 检测合并冲突
  if (combinedOutput.includes('CONFLICT') || combinedOutput.includes('merge failed')) {
      const conflicts: string[] = [];

      // 解析冲突文件：both modified: xxx, both added: xxx, both deleted: xxx
      const conflictPatterns = [
        /both\s+modified:\s+(.+)/gi,
        /both\s+added:\s+(.+)/gi,
        /both\s+deleted:\s+(.+)/gi,
      ];

      for (const pattern of conflictPatterns) {
        let match;
        while ((match = pattern.exec(combinedOutput)) !== null) {
          if (match[1]) {
            conflicts.push(match[1].trim());
          }
        }
      }

      // 也尝试解析 "error: ..." 格式
      const errorFilePattern = /error: (?:merge conflict in |could not apply) (.+)/gi;
      let match;
      while ((match = errorFilePattern.exec(combinedOutput)) !== null) {
        const file = match[1]?.trim();
        if (file && !conflicts.includes(file)) {
          conflicts.push(file);
        }
      }

      return {
        success: false,
        conflicts,
        hasConflicts: conflicts.length > 0,
        message: `Merge conflicts in ${conflicts.length} file(s)`,
      };
  }

  // 其他错误
  return {
    success: false,
    conflicts: [],
    hasConflicts: false,
    message: combinedOutput || 'Merge failed',
  };
}
