import { execSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';

import { logger } from './logger.js';

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
    try {
      execSync('git worktree prune', { cwd: repoPath, stdio: 'pipe' });
    } catch {
      // Non-critical, continue
    }

    const parentDir = path.dirname(worktreePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Check if branch already exists
    let branchExists = false;
    try {
      execSync(`git rev-parse --verify refs/heads/${branchName}`, { cwd: repoPath, stdio: 'pipe' });
      branchExists = true;
    } catch {
      branchExists = false;
    }

    if (branchExists) {
      // Branch exists, just add worktree without creating branch
      execSync(`git worktree add "${worktreePath}" "${branchName}"`, {
        cwd: repoPath,
        encoding: 'utf-8',
      });
    } else {
      // Branch doesn't exist, create it with worktree
      execSync(`git worktree add -b "${branchName}" "${worktreePath}"`, {
        cwd: repoPath,
        encoding: 'utf-8',
      });
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
      execSync(`git worktree remove ${worktreePath} --force`, {
        cwd: repoPath,
        encoding: 'utf-8',
      });
    }
    if (branchName) {
      try {
        execSync(`git branch -D ${branchName} --force`, {
          cwd: repoPath,
          encoding: 'utf-8',
        });
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
    const output = execSync('git worktree list --porcelain', {
      cwd: repoPath,
      encoding: 'utf-8',
    });
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
  try {
    execSync('git rev-parse --git-dir', { cwd: repoPath, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
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
  const flags = ['merge'];
  if (noFastForward) flags.push('--no-ff');
  flags.push(sourceBranch);
  if (message) {
    flags.push('-m', message);
  }

  try {
    const output = execSync(`git ${flags.join(' ')}`, {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return {
      success: true,
      conflicts: [],
      hasConflicts: false,
      message: output || 'Merge completed successfully',
    };
  } catch (error) {
    const execError = error as Error & { stderr?: string; stdout?: string };
    const stderr = execError.stderr || '';
    const stdout = execError.stdout || '';
    const combinedOutput = stderr + stdout;

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
}
