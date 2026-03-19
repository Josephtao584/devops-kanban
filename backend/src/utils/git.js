import { execSync } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';

export function getWorktreePath(taskId, taskTitle) {
  const safeTitle = taskTitle.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
  const baseDir = path.join(os.tmpdir(), 'claude-worktrees');
  return path.join(baseDir, `task_${taskId}_${safeTitle}`);
}

export function createWorktree(taskId, taskTitle, repoPath = process.cwd()) {
  const worktreePath = getWorktreePath(taskId, taskTitle);
  const branchName = `task/${taskId}`;
  try {
    if (fs.existsSync(worktreePath)) {
      return worktreePath;
    }
    const parentDir = path.dirname(worktreePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    execSync(`git worktree add -b ${branchName} ${worktreePath}`, {
      cwd: repoPath,
      encoding: 'utf-8',
    });
    return worktreePath;
  } catch (error) {
    const stderr = error.stderr || error.message;
    throw new Error(`Failed to create worktree: ${stderr}`);
  }
}

/**
 * Remove a git worktree and optionally delete the branch
 * @param {string} worktreePath - Worktree path to remove
 * @param {string} repoPath - Repository path (optional, defaults to cwd)
 * @param {string} branchName - Branch name to delete (optional)
 * @returns {boolean} True if removed successfully
 */
export function cleanupWorktree(worktreePath, repoPath = process.cwd(), branchName = null) {
  try {
    if (fs.existsSync(worktreePath)) {
      execSync(`git worktree remove ${worktreePath} --force`, {
        cwd: repoPath,
        encoding: 'utf-8',
      });
    }
    // Delete the branch if provided
    if (branchName) {
      try {
        execSync(`git branch -D ${branchName} --force`, {
          cwd: repoPath,
          encoding: 'utf-8',
        });
      } catch (e) {
        // Branch may not exist, ignore error
        console.log(`Branch ${branchName} may not exist, skipping deletion`);
      }
    }
    return true;
  } catch (error) {
    console.error(`Failed to cleanup worktree ${worktreePath}:`, error.message);
    return false;
  }
}

export function getWorktreeStatus(repoPath = process.cwd()) {
  try {
    const output = execSync('git worktree list --porcelain', {
      cwd: repoPath,
      encoding: 'utf-8',
    });
    const worktrees = [];
    const lines = output.trim().split('\n');
    let currentWorktree = null;
    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        if (currentWorktree) {
          worktrees.push(currentWorktree);
        }
        currentWorktree = { path: line.substring(9) };
      } else if (line.startsWith('head ')) {
        currentWorktree.head = line.substring(5);
      } else if (line.startsWith('branch ')) {
        currentWorktree.branch = line.substring(7);
      }
    }
    if (currentWorktree) {
      worktrees.push(currentWorktree);
    }
    return worktrees;
  } catch (error) {
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
