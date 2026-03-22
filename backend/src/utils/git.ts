import { execSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';

type WorktreeStatusItem = {
  path: string;
  head?: string;
  branch?: string;
};

export function sanitizeName(str: string) {
  return str.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_');
}

export function getWorktreePath(taskId: number, taskTitle: string, projectName: string, repoPath: string) {
  const safeTitle = sanitizeName(taskTitle).substring(0, 50);
  const safeProjectName = sanitizeName(projectName);
  const baseDir = path.join(repoPath, '.worktrees');
  return path.join(baseDir, safeProjectName, `task-${taskId}-${safeTitle}`);
}

export function createWorktree(taskId: number, taskTitle: string, projectName: string, repoPath = process.cwd()) {
  const worktreePath = getWorktreePath(taskId, taskTitle, projectName, repoPath);
  const safeProjectName = sanitizeName(projectName);
  const branchName = `task/${safeProjectName}/${taskId}`;
  try {
    ensureWorktreesGitignore(repoPath);

    if (fs.existsSync(worktreePath)) {
      return worktreePath;
    }
    const parentDir = path.dirname(worktreePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    execSync(`git worktree add -b "${branchName}" "${worktreePath}"`, {
      cwd: repoPath,
      encoding: 'utf-8',
    });
    return worktreePath;
  } catch (error) {
    const execError = error as Error & { stderr?: string };
    const stderr = execError.stderr || execError.message;
    throw new Error(`Failed to create worktree: ${stderr}`);
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
    console.error(`Failed to update .gitignore: ${execError.message}`);
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
        console.log(`Branch ${branchName} may not exist, skipping deletion`);
      }
    }
    return true;
  } catch (error) {
    const execError = error as Error;
    console.error(`Failed to cleanup worktree ${worktreePath}:`, execError.message);
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
