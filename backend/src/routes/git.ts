import type { FastifyPluginAsync } from 'fastify';
import { execSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';

import { ProjectRepository } from '../repositories/projectRepository.js';
import { TaskRepository } from '../repositories/taskRepository.js';
import { createWorktree, cleanupWorktree, getWorktreeStatus, isGitRepository } from '../utils/git.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { getStatusCode, getErrorMessage } from '../utils/http.js';
import type { ProjectEntity } from '../types/entities.js';

const projectRepo = new ProjectRepository();
const taskRepo = new TaskRepository();

function parseNumber(value: string | undefined) {
  return value ? Number.parseInt(value, 10) : 0;
}

type ProjectIdQuery = { projectId?: string };

export const gitRoutes: FastifyPluginAsync = async (fastify) => {
  // Helper to get repo path for a project
  async function getProjectRepoPath(projectId: number): Promise<{ repoPath: string; project: ProjectEntity }> {
    const project = await projectRepo.findById(projectId);
    if (!project) {
      throw Object.assign(new Error('Project not found'), { statusCode: 404 });
    }

    if (project.local_path && fs.existsSync(project.local_path)) {
      if (!isGitRepository(project.local_path)) {
        throw Object.assign(new Error('local_path is not a valid git repository'), { statusCode: 400 });
      }
      return { repoPath: project.local_path, project };
    }

    if (project.git_url) {
      const cloneDir = path.join('/tmp/claude-repos', String(project.id));
      if (!fs.existsSync(cloneDir) || !isGitRepository(cloneDir)) {
        if (fs.existsSync(cloneDir)) {
          fs.rmSync(cloneDir, { recursive: true, force: true });
        }
        fs.mkdirSync(cloneDir, { recursive: true });
        execSync(`git clone ${project.git_url} .`, {
          cwd: cloneDir,
          encoding: 'utf-8',
          stdio: 'pipe',
        });
      }
      return { repoPath: cloneDir, project };
    }

    throw Object.assign(new Error('Project has no git repository configured'), { statusCode: 400 });
  }

  // ==================== Worktree Management ====================

  fastify.get<{ Querystring: ProjectIdQuery }>('/worktrees', async (request) => {
    try {
      const projectId = parseNumber(request.query.projectId);
      if (!projectId) {
        return errorResponse('projectId is required');
      }

      const { repoPath } = await getProjectRepoPath(projectId);
      const worktrees = getWorktreeStatus(repoPath);
      return successResponse(worktrees);
    } catch (error) {
      request.log.error(error);
      return errorResponse(getErrorMessage(error, 'Failed to list worktrees'));
    }
  });

  fastify.get<{ Params: { taskId: string }; Querystring: ProjectIdQuery }>('/worktrees/:taskId', async (request, reply) => {
    try {
      const taskId = parseNumber(request.params.taskId);
      const projectId = parseNumber(request.query.projectId);

      const task = await taskRepo.findById(taskId);
      if (!task) {
        reply.code(404);
        return errorResponse('Task not found');
      }

      return successResponse({
        worktree_path: task.worktree_path || null,
        worktree_branch: task.worktree_branch || null,
        worktree_status: task.worktree_status || 'none',
      });
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get worktree status'));
    }
  });

  fastify.post<{ Params: { taskId: string }; Querystring: ProjectIdQuery }>('/worktrees/:taskId', async (request, reply) => {
    try {
      const taskId = parseNumber(request.params.taskId);

      const task = await taskRepo.findById(taskId);
      if (!task) {
        reply.code(404);
        return errorResponse('Task not found');
      }

      const { repoPath } = await getProjectRepoPath(task.project_id);
      const worktreePath = createWorktree(taskId, task.title, task.project_id.toString(), repoPath);

      await taskRepo.update(taskId, {
        worktree_path: worktreePath,
        worktree_branch: `task/${taskId}`,
        worktree_status: 'created',
      });

      return successResponse({
        worktree_path: worktreePath,
        worktree_branch: `task/${taskId}`,
        worktree_status: 'created',
      }, 'Worktree created successfully');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to create worktree'));
    }
  });

  fastify.delete<{ Params: { taskId: string }; Querystring: ProjectIdQuery }>('/worktrees/:taskId', async (request, reply) => {
    try {
      const taskId = parseNumber(request.params.taskId);

      const task = await taskRepo.findById(taskId);
      if (!task) {
        reply.code(404);
        return errorResponse('Task not found');
      }

      if (!task.worktree_path) {
        return successResponse({ success: true }, 'No worktree to delete');
      }

      const { repoPath } = await getProjectRepoPath(task.project_id);
      cleanupWorktree(task.worktree_path, repoPath, task.worktree_branch || null);

      await taskRepo.update(taskId, {
        worktree_path: null,
        worktree_branch: null,
        worktree_status: 'none',
      });

      return successResponse({ success: true }, 'Worktree deleted');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to delete worktree'));
    }
  });

  // ==================== Changes / Untracked Files ====================

  fastify.get<{ Params: { taskId: string }; Querystring: ProjectIdQuery }>('/worktrees/:taskId/changes', async (request, reply) => {
    try {
      const taskId = parseNumber(request.params.taskId);

      const task = await taskRepo.findById(taskId);
      if (!task) {
        reply.code(404);
        return errorResponse('Task not found');
      }

      if (!task.worktree_path) {
        return successResponse([]);
      }

      // Get all changes: modified, new (untracked), deleted
      const statusOutput = execSync('git status --porcelain', {
        cwd: task.worktree_path,
        encoding: 'utf-8',
      });

      const changes: Array<{
        path: string;
        status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
      }> = [];

      for (const line of statusOutput.trim().split('\n')) {
        if (!line.trim()) continue;

        // Parse git status --porcelain format
        // XY filename
        // X = index status, Y = working tree status
        const match = line.match(/^(\?\?|\s\w|\w\s|[MARC])\s+(.+)$/);
        if (match) {
          const [, statusCode, filePath] = match;
          let status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' = 'modified';

          if (statusCode === '??') {
            status = 'untracked';
          } else if (statusCode === 'M' || statusCode === 'MM') {
            status = 'modified';
          } else if (statusCode === 'A' || statusCode === 'AM') {
            status = 'added';
          } else if (statusCode === 'D') {
            status = 'deleted';
          } else if (statusCode === 'R') {
            status = 'renamed';
          }

          changes.push({
            path: filePath.trim(),
            status,
          });
        }
      }

      return successResponse(changes);
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get changes'));
    }
  });

  // ==================== Commit ====================

  fastify.post<{ Params: { taskId: string }; Querystring: ProjectIdQuery; Body: { message?: string; addAll?: boolean; files?: string[] } }>('/worktrees/:taskId/commit', async (request, reply) => {
    try {
      const taskId = parseNumber(request.params.taskId);
      const { message, addAll = true, files = [] } = request.body || {};

      if (!message || message.trim().length === 0) {
        reply.code(400);
        return errorResponse('Commit message is required');
      }

      const task = await taskRepo.findById(taskId);
      if (!task) {
        reply.code(404);
        return errorResponse('Task not found');
      }

      if (!task.worktree_path) {
        reply.code(400);
        return errorResponse('Task has no worktree');
      }

      // Build git add command
      if (addAll) {
        execSync('git add -A', { cwd: task.worktree_path, encoding: 'utf-8' });
      } else if (files.length > 0) {
        for (const file of files) {
          execSync(`git add "${file}"`, { cwd: task.worktree_path, encoding: 'utf-8' });
        }
      }

      // Build git commit command
      const commitOutput = execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
        cwd: task.worktree_path,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      return successResponse({ message: 'Changes committed successfully', output: commitOutput.toString() });
    } catch (error) {
      request.log.error(error);
      const execError = error as Error & { stderr?: string };
      const stderr = execError.stderr || execError.message;

      // Check if there's nothing to commit
      if (stderr.includes('nothing to commit')) {
        reply.code(400);
        return errorResponse('Nothing to commit');
      }

      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, `Failed to commit: ${stderr}`));
    }
  });

  // ==================== Branch Management ====================

  fastify.get<{ Querystring: ProjectIdQuery }>('/branches', async (request) => {
    try {
      const projectId = parseNumber(request.query.projectId);
      if (!projectId) {
        return errorResponse('projectId is required');
      }

      const { repoPath } = await getProjectRepoPath(projectId);

      // Get local branches
      const localOutput = execSync('git branch -v', { cwd: repoPath, encoding: 'utf-8' });
      const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: repoPath, encoding: 'utf-8' }).trim();

      const branches: Array<{
        fullName: string;
        name: string;
        isRemote: boolean;
        isCurrent: boolean;
        aheadCount: number;
        behindCount: number;
      }> = [];

      for (const line of localOutput.trim().split('\n')) {
        const match = line.match(/^\*?\s*(\S+)\s+([a-f0-9]+)\s*(.*)/);
        if (match) {
          const [, name, hash, description] = match;
          branches.push({
            fullName: name,
            name,
            isRemote: false,
            isCurrent: name === currentBranch,
            aheadCount: 0,
            behindCount: 0,
          });
        }
      }

      // Get remote branches
      try {
        const remoteOutput = execSync('git branch -r -v', { cwd: repoPath, encoding: 'utf-8' });
        for (const line of remoteOutput.trim().split('\n')) {
          const match = line.match(/^\s*(\S+)\s+([a-f0-9]+)\s*(.*)/);
          if (match) {
            const [, fullName, hash, description] = match;
            branches.push({
              fullName,
              name: fullName.replace(/^origin\//, ''),
              isRemote: true,
              isCurrent: false,
              aheadCount: 0,
              behindCount: 0,
            });
          }
        }
      } catch {
        // No remote branches
      }

      return successResponse(branches);
    } catch (error) {
      request.log.error(error);
      return errorResponse(getErrorMessage(error, 'Failed to list branches'));
    }
  });

  // ==================== Diff ====================

  fastify.get<{ Params: { taskId: string }; Querystring: ProjectIdQuery & { source?: string; target?: string } }>('/worktrees/:taskId/diff', async (request, reply) => {
    try {
      const taskId = parseNumber(request.params.taskId);
      const { source, target } = request.query;

      const task = await taskRepo.findById(taskId);
      if (!task) {
        reply.code(404);
        return errorResponse('Task not found');
      }

      if (!task.worktree_path) {
        reply.code(400);
        return errorResponse('Task has no worktree');
      }

      const { repoPath } = await getProjectRepoPath(task.project_id);

      // Build git diff command
      let sourceRef = source || 'master';
      let targetRef = target || task.worktree_branch || 'HEAD';

      // Run git diff from parent repo where both branches exist
      const diffOutput = execSync(`git diff "${sourceRef}" "${targetRef}" --stat`, {
        cwd: repoPath,
        encoding: 'utf-8',
      });

      // Get file changes
      const files: Array<{
        path: string;
        additions: number;
        deletions: number;
        status: 'added' | 'modified' | 'deleted';
      }> = [];

      for (const line of diffOutput.trim().split('\n')) {
        const statMatch = line.match(/^\s*(.+?)\s*\|\s*(\d+)\s*(\+*)(\-*)$/);
        if (statMatch) {
          const [, filePath, changes, additions, deletions] = statMatch;
          const addCount = additions.length;
          const delCount = deletions.length;

          // Determine status
          let status: 'added' | 'modified' | 'deleted' = 'modified';
          if (addCount > 0 && delCount === 0) status = 'added';
          if (delCount > 0 && addCount === 0) status = 'deleted';

          files.push({
            path: filePath.trim(),
            additions: addCount,
            deletions: delCount,
            status,
          });
        }
      }

      // Get actual diff content
      const diffContent: Record<string, string> = {};
      for (const file of files) {
        try {
          const fileDiff = execSync(`git diff "${sourceRef}" "${targetRef}" -- "${file.path}"`, {
            cwd: repoPath,
            encoding: 'utf-8',
          });
          diffContent[file.path] = fileDiff;
        } catch {
          diffContent[file.path] = '';
        }
      }

      return successResponse({ files, diffs: diffContent });
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get diff'));
    }
  });
};
