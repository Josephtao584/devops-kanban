/**
 * Task Worktree Routes
 */
import { TaskService } from '../services/taskService.js';
import { ProjectRepository } from '../repositories/projectRepository.js';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

async function taskWorktreeRoutes(fastify, options) {
  const taskService = new TaskService();
  const projectRepo = new ProjectRepository();

  /**
   * Get repository path for a project
   */
  async function getRepoPath(projectId) {
    const project = await projectRepo.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Priority: local_path > git_url (cloned to temp)
    if (project.local_path && fs.existsSync(project.local_path)) {
      return project.local_path;
    }

    if (project.git_url) {
      const cloneDir = path.join('/tmp/claude-repos', String(project.id));
      if (fs.existsSync(cloneDir)) {
        return cloneDir;
      }
      throw new Error('Repository has not been cloned yet. Please create a worktree first.');
    }

    throw new Error('Project has neither local_path nor git_url');
  }

  // Create worktree for a task
  fastify.post('/:taskId/worktree', async (request, reply) => {
    const { taskId } = request.params;

    try {
      const result = await taskService.createWorktree(parseInt(taskId));
      return {
        success: true,
        message: 'Worktree created successfully',
        data: result
      };
    } catch (error) {
      const statusCode = error.statusCode || 500;
      reply.code(statusCode);
      return {
        success: false,
        message: error.message,
        error: error.message
      };
    }
  });

  // Delete worktree for a task
  fastify.delete('/:taskId/worktree', async (request, reply) => {
    const { taskId } = request.params;

    try {
      const result = await taskService.deleteWorktree(parseInt(taskId));
      return {
        success: true,
        message: result.message,
        data: result
      };
    } catch (error) {
      const statusCode = error.statusCode || 500;
      reply.code(statusCode);
      return {
        success: false,
        message: error.message,
        error: error.message
      };
    }
  });

  // Get worktree status for a task
  fastify.get('/:taskId/worktree', async (request, reply) => {
    const { taskId } = request.params;

    try {
      const result = await taskService.getWorktreeStatus(parseInt(taskId));
      return {
        success: true,
        data: result
      };
    } catch (error) {
      const statusCode = error.statusCode || 500;
      reply.code(statusCode);
      return {
        success: false,
        message: error.message,
        error: error.message
      };
    }
  });

  // Get diff between two branches for a worktree
  fastify.get('/:taskId/worktree/diff', async (request, reply) => {
    const { taskId } = request.params;
    const { source, target, projectId } = request.query;

    try {
      // Get task to find worktree path and branch
      const task = await taskService.getById(parseInt(taskId));
      if (!task || !task.worktree_path) {
        throw new Error('Worktree not found for this task');
      }

      const worktreePath = task.worktree_path;
      const worktreeBranch = task.worktree_branch;

      // Verify the worktree exists
      if (!fs.existsSync(worktreePath)) {
        throw new Error('Worktree directory does not exist');
      }

      // Get the source repo path from project
      let repoPath;
      if (projectId) {
        repoPath = await getRepoPath(parseInt(projectId));
      } else if (task.project_id) {
        repoPath = await getRepoPath(task.project_id);
      } else {
        throw new Error('Project ID is required to get repository path');
      }

      // Get structured diff data
      const result = {
        files: [],
        diffs: {}
      };

      try {
        // Escape branch names for shell (handle special chars like Chinese)
        const escapeBranch = (branch) => {
          if (!branch) return '';
          return `'${branch.replace(/'/g, "'\\''")}'`;
        };

        const escapedSource = escapeBranch(source || 'main');
        // Use worktree_branch if target is not provided
        const targetBranch = target || worktreeBranch;
        const escapedTarget = escapeBranch(targetBranch);

        // Get list of changed files with stats using git diff --stat
        // Run in the source repo (main), comparing source branch with worktree branch
        let diffCmd = 'git diff --stat';
        if (source && targetBranch) {
          // Compare source branch with worktree branch in source repo
          diffCmd = `git diff ${escapedSource}...${escapedTarget} --stat`;
        }

        const statOutput = execSync(diffCmd, {
          cwd: repoPath,
          encoding: 'utf-8'
        });

        // Parse stat output to extract file changes
        const statLines = statOutput.trim().split('\n');
        for (const line of statLines) {
          // Match lines like: "file.js | 5 +++---" or "file.js | 10 ++++++++"
          const match = line.match(/^[\s*]*(.+?)\s*\|\s*(\d+)\s+([+\-]+)/);
          if (match) {
            const filePath = match[1].trim();
            const changes = parseInt(match[2]);
            const changeChars = match[3];
            const additions = (changeChars.match(/\+/g) || []).length;
            const deletions = (changeChars.match(/-/g) || []).length;

            // Determine status
            let status = 'modified';
            if (additions > 0 && deletions === 0) status = 'added';
            else if (deletions > 0 && additions === 0) status = 'deleted';

            result.files.push({
              path: filePath,
              additions,
              deletions,
              changes,
              status
            });

            // Get individual file diff (run in source repo)
            const branchPrefix = (source && targetBranch) ? `${escapedSource}...${escapedTarget} -- ` : '-- ';
            const fileDiff = execSync(`git diff ${branchPrefix}${filePath}`, {
              cwd: repoPath,
              encoding: 'utf-8'
            });
            result.diffs[filePath] = fileDiff;
          }
        }

        // Also check for untracked and new files in worktree directory
        const statusOutput = execSync('git status --porcelain', {
          cwd: worktreePath,
          encoding: 'utf-8'
        });

        const statusLines = statusOutput.trim().split('\n');
        for (const line of statusLines) {
          if (!line.trim()) continue;

          const statusCode = line.substring(0, 2).trim();
          const filePath = line.substring(3).trim();

          // Skip if already in files list
          if (result.files.find(f => f.path === filePath)) continue;

          if (statusCode.includes('A') || statusCode.includes('?')) {
            result.files.push({
              path: filePath,
              additions: 0,
              deletions: 0,
              changes: 0,
              status: 'added'
            });
            result.diffs[filePath] = execSync(`git diff -- /dev/null ${filePath}`, {
              cwd: worktreePath,
              encoding: 'utf-8'
            });
          } else if (statusCode.includes('D')) {
            result.files.push({
              path: filePath,
              additions: 0,
              deletions: 0,
              changes: 0,
              status: 'deleted'
            });
            result.diffs[filePath] = execSync(`git diff ${filePath} -- /dev/null`, {
              cwd: worktreePath,
              encoding: 'utf-8'
            });
          }
        }

        // Get working tree changes
        const workingTreeDiff = execSync('git diff --', {
          cwd: worktreePath,
          encoding: 'utf-8'
        });

        // Parse working tree changes
        const workingTreeFiles = new Set();
        const diffMatches = workingTreeDiff.match(/^diff --git a\/(.+?) b\/.+$/gm);
        if (diffMatches) {
          for (const match of diffMatches) {
            const fileMatch = match.match(/^diff --git a\/(.+?) b\/.+$/);
            if (fileMatch) {
              workingTreeFiles.add(fileMatch[1]);
            }
          }
        }

        // Add working tree changes
        if (workingTreeDiff) {
          // Parse the diff for each file
          const filesInDiff = workingTreeDiff.split(/^diff --git/m);
          for (const fileDiff of filesInDiff) {
            if (!fileDiff.trim()) continue;

            const pathMatch = fileDiff.match(/a\/(.+?) b\//);
            if (pathMatch) {
              const filePath = pathMatch[1];
              if (!result.diffs[filePath]) {
                result.diffs[filePath] = fileDiff;

                // Count additions and deletions for this file
                const additions = (fileDiff.match(/^\+/gm) || []).length;
                const deletions = (fileDiff.match(/^-/gm) || []).length;

                // Check if file already in list
                const existingFile = result.files.find(f => f.path === filePath);
                if (existingFile) {
                  existingFile.additions += additions;
                  existingFile.deletions += deletions;
                  existingFile.changes = existingFile.additions + existingFile.deletions;
                } else {
                  result.files.push({
                    path: filePath,
                    additions,
                    deletions,
                    changes: additions + deletions,
                    status: additions > 0 ? 'added' : 'modified'
                  });
                }
              }
            }
          }
        }

        if (result.files.length === 0) {
          result.files.push({
            path: 'No changes',
            additions: 0,
            deletions: 0,
            changes: 0,
            status: 'modified'
          });
          result.diffs['No changes'] = 'No changes found';
        }
      } catch (gitError) {
        console.error('Git diff error:', gitError);
        result.files.push({
          path: 'Error',
          additions: 0,
          deletions: 0,
          changes: 0,
          status: 'modified'
        });
        result.diffs['Error'] = gitError.message || 'No changes found or branches do not exist';
      }

      return {
        success: true,
        data: result
      };
    } catch (error) {
      const statusCode = error.statusCode || 500;
      reply.code(statusCode);
      return {
        success: false,
        message: error.message,
        error: error.message
      };
    }
  });
}

export default taskWorktreeRoutes;
