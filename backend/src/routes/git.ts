import type { FastifyPluginAsync } from 'fastify';
import { execSync, execFileSync, spawnSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import iconv from 'iconv-lite';

import { ProjectRepository } from '../repositories/projectRepository.js';
import { TaskRepository } from '../repositories/taskRepository.js';
import { createWorktree, cleanupWorktree, getWorktreeStatus, isGitRepository, mergeBranch, sanitizeName } from '../utils/git.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { getStatusCode, getErrorMessage, logError } from '../utils/http.js';
import { logger } from '../utils/logger.js';
import type { ProjectEntity } from '../types/entities.js';

const projectRepo = new ProjectRepository();
const taskRepo = new TaskRepository();

function parseNumber(value: string | undefined) {
  return value ? Number.parseInt(value, 10) : 0;
}

function decodeGitTextOutput(content: string | Buffer) {
  if (!Buffer.isBuffer(content)) {
    return content;
  }

  const utf8Text = iconv.decode(content, 'utf8');
  if (!utf8Text.includes('�')) {
    return utf8Text;
  }

  const gbkText = iconv.decode(content, 'gbk');
  const utf8ReplacementCount = (utf8Text.match(/�/g) || []).length;
  const gbkReplacementCount = (gbkText.match(/�/g) || []).length;

  return gbkReplacementCount < utf8ReplacementCount ? gbkText : utf8Text;
}

function isValidRemoteName(value: string) {
  return /^(?!-)[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value);
}

type ProjectIdQuery = { projectId?: string };

type WorktreeDiffStatus = 'modified' | 'added' | 'deleted' | 'untracked';

type WorktreeDiffFile = {
  path: string;
  additions: number;
  deletions: number;
  status: WorktreeDiffStatus;
};

type ParsedPorcelainFile = {
  path: string;
  status: WorktreeDiffStatus;
  diffPaths: string[];
};

export function parsePorcelainStatus(output: string): ParsedPorcelainFile[] {
  const files = new Map<string, ParsedPorcelainFile>();
  const entries = output.split('\0').filter(Boolean);

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!entry || entry.length < 4) {
      continue;
    }

    const x = entry[0];
    const y = entry[1];
    const filePath = entry.slice(3);
    if (!x || !y || !filePath) {
      continue;
    }

    if (x === '?' && y === '?') {
      files.set(filePath, {
        path: filePath,
        status: 'untracked',
        diffPaths: [filePath],
      });
      continue;
    }

    const isRenameOrCopy = x === 'R' || y === 'R' || x === 'C' || y === 'C';
    const originalPath = isRenameOrCopy && index + 1 < entries.length ? entries[index + 1] : null;
    if (originalPath) {
      index += 1;
    }

    let status: WorktreeDiffStatus = 'modified';
    if (x === 'C' || y === 'C' || (x === 'A' && y !== 'D')) {
      status = 'added';
    } else if (x === 'D' || y === 'D') {
      status = 'deleted';
    }

    files.set(filePath, {
      path: filePath,
      status,
      diffPaths: originalPath ? [originalPath, filePath] : [filePath],
    });
  }

  return Array.from(files.values());
}

function countDiffLines(diff: string) {
  let additions = 0;
  let deletions = 0;
  let insideHunk = false;

  for (const line of diff.split('\n')) {
    if (line.startsWith('@@')) {
      insideHunk = true;
      continue;
    }

    if (!insideHunk) {
      continue;
    }

    if (line.startsWith('+')) {
      additions += 1;
      continue;
    }

    if (line.startsWith('-')) {
      deletions += 1;
    }
  }

  return { additions, deletions };
}

function isBinaryContent(content: Buffer) {
  return content.includes(0);
}

function buildUntrackedDiff(filePath: string, content: Buffer) {
  const normalizedPath = filePath.replace(/\\/g, '/');

  if (isBinaryContent(content)) {
    return [
      `diff --git a/${normalizedPath} b/${normalizedPath}`,
      'new file mode 100644',
      'index 0000000..0000000',
      `Binary files /dev/null and b/${normalizedPath} differ`,
    ].join('\n');
  }

  const text = content.toString('utf-8');
  const hasTrailingNewline = text.endsWith('\n');
  const lines = text.length === 0 ? [] : text.split('\n');
  if (hasTrailingNewline) {
    lines.pop();
  }

  const hunkLength = lines.length;
  const body = lines.map((line) => `+${line}`);

  return [
    `diff --git a/${normalizedPath} b/${normalizedPath}`,
    'new file mode 100644',
    'index 0000000..1111111',
    '--- /dev/null',
    `+++ b/${normalizedPath}`,
    `@@ -0,0 +1,${hunkLength} @@`,
    ...body,
  ].join('\n');
}

export function buildWorktreeDiff(taskWorktreePath: string): { files: WorktreeDiffFile[]; diffs: Record<string, string> } {
  execFileSync('git', ['rev-parse', '--git-dir'], {
    cwd: taskWorktreePath,
    encoding: 'utf-8',
    stdio: 'ignore',
  });

  const statusOutput = execFileSync('git', ['status', '--porcelain', '-z', '--untracked-files=all'], {
    cwd: taskWorktreePath,
    encoding: 'utf-8',
  });

  const parsedFiles = parsePorcelainStatus(statusOutput);
  const files: WorktreeDiffFile[] = [];
  const diffs: Record<string, string> = {};

  for (const file of parsedFiles) {
    let diffText = '';

    try {
      if (file.status === 'untracked') {
        const fullPath = path.join(taskWorktreePath, file.path);
        const content = fs.readFileSync(fullPath);
        diffText = buildUntrackedDiff(file.path, content);
      } else {
        diffText = execFileSync('git', ['diff', 'HEAD', '--', ...file.diffPaths], {
          cwd: taskWorktreePath,
          encoding: 'utf-8',
        });
      }
    } catch {
      diffText = '';
    }

    const { additions, deletions } = countDiffLines(diffText);

    files.push({
      path: file.path,
      additions,
      deletions,
      status: file.status,
    });
    diffs[file.path] = diffText;
  }

  return { files, diffs };
}

export function buildBranchDiff(repoPath: string, source: string, target: string): { files: WorktreeDiffFile[]; diffs: Record<string, string> } {
  // Validate that repoPath is a git repository
  execFileSync('git', ['rev-parse', '--git-dir'], {
    cwd: repoPath,
    encoding: 'utf-8',
    stdio: 'ignore',
  });

  // Get list of files that differ between the two branches
  let diffNamesOutput = '';
  try {
    diffNamesOutput = decodeGitTextOutput(execFileSync('git', ['-c', 'core.quotePath=false', 'diff', '--name-status', source, target], {
      cwd: repoPath,
      encoding: 'buffer',
    }));
  } catch (error) {
    const execError = error as Error & { message?: string };
    const errorMessage = execError.message || '';
    if (errorMessage.includes('unknown revision') || errorMessage.includes('bad revision')) {
      throw Object.assign(new Error(`Branch not found: ${errorMessage.split('\n')[0]}`), { statusCode: 400 });
    }
    throw Object.assign(new Error(`Failed to compare branches: ${errorMessage.split('\n')[0]}`), { statusCode: 500 });
  }

  const files: WorktreeDiffFile[] = [];
  const diffs: Record<string, string> = {};

  // Parse the diff --name-status output
  const lines = diffNamesOutput.split('\n').filter(Boolean);
  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < 2) continue;

    const statusChar = parts[0];
    const filePath = parts[1];
    if (!statusChar || !filePath) continue;

    let status: WorktreeDiffStatus = 'modified';
    if (statusChar === 'A' || statusChar === '?') {
      status = 'added';
    } else if (statusChar === 'D') {
      status = 'deleted';
    } else if (statusChar === 'R') {
      status = 'modified';
    }

    // Get the actual diff for this file
    let diffText = '';
    try {
      diffText = decodeGitTextOutput(execFileSync('git', ['-c', 'core.quotePath=false', 'diff', source, target, '--', filePath], {
        cwd: repoPath,
        encoding: 'buffer',
      }));
    } catch {
      diffText = '';
    }

    const { additions, deletions } = countDiffLines(diffText);

    files.push({
      path: filePath,
      additions,
      deletions,
      status,
    });
    diffs[filePath] = diffText;
  }

  return { files, diffs };
}

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

  async function getBranchRepoPath(projectId: number): Promise<{ repoPath: string; project: ProjectEntity }> {
    const projectRepoResult = await getProjectRepoPath(projectId);
    const tasks = await taskRepo.findByProject(projectId);

    for (const task of tasks) {
      if (task.worktree_path && fs.existsSync(task.worktree_path) && isGitRepository(task.worktree_path)) {
        return {
          repoPath: task.worktree_path,
          project: projectRepoResult.project,
        };
      }
    }

    return projectRepoResult;
  }

  function readBranchList(repoPath: string) {
    const branches = new Map<string, {
      fullName: string;
      name: string;
      isRemote: boolean;
      isCurrent: boolean;
      aheadCount: number;
      behindCount: number;
    }>();

    const localOutput = execSync('git branch -v', { cwd: repoPath, encoding: 'utf-8' });
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: repoPath, encoding: 'utf-8' }).trim();

    for (const line of localOutput.trim().split('\n')) {
      const match = line.match(/^[*+]?\s*(\S+)\s+([a-f0-9]+)\s*(.*)/);
      if (!match) {
        continue;
      }

      const [, name] = match;
      if (!name) {
        continue;
      }

      branches.set(name, {
        fullName: name,
        name,
        isRemote: false,
        isCurrent: name === currentBranch,
        aheadCount: 0,
        behindCount: 0,
      });
    }

    try {
      const remoteOutput = execSync('git branch -r -v', { cwd: repoPath, encoding: 'utf-8' });
      for (const line of remoteOutput.trim().split('\n')) {
        const match = line.match(/^\s*(\S+)\s+([a-f0-9]+)\s*(.*)/);
        if (!match) {
          continue;
        }

        const [, fullName] = match;
        if (!fullName || branches.has(fullName)) {
          continue;
        }

        branches.set(fullName, {
          fullName,
          name: fullName.replace(/^origin\//, ''),
          isRemote: true,
          isCurrent: false,
          aheadCount: 0,
          behindCount: 0,
        });
      }
    } catch {
      // No remote branches
    }

    return Array.from(branches.values());
  }

  async function listProjectBranches(projectId: number) {
    const branchRepo = await getBranchRepoPath(projectId);
    return readBranchList(branchRepo.repoPath);
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
      logError(error, request);
      return errorResponse(getErrorMessage(error, 'Failed to list worktrees'));
    }
  });

  fastify.get<{ Params: { taskId: string }; Querystring: ProjectIdQuery }>('/worktrees/:taskId', async (request, reply) => {
    try {
      const taskId = parseNumber(request.params.taskId);

      const task = await taskRepo.findById(taskId);
      if (!task) {
        reply.code(404);
        return errorResponse('Task not found');
      }

      return successResponse({
        worktree_path: task.worktree_path || null,
        worktree_branch: task.worktree_branch || null,
      });
    } catch (error) {
      logError(error, request);
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
      const worktreePath = createWorktree(taskId, task.title, repoPath);
      const safeTitle = sanitizeName(task.title).substring(0, 50);
      const branchName = `task/${taskId}-${safeTitle}`;

      await taskRepo.update(taskId, {
        worktree_path: worktreePath,
        worktree_branch: branchName,
        worktree_status: 'created',
      });

      return successResponse({
        worktree_path: worktreePath,
        worktree_branch: branchName,
        worktree_status: 'created',
      }, 'Worktree created successfully');
    } catch (error) {
      logError(error, request);
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
      logError(error, request);
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

      const statusOutput = execFileSync('git', ['status', '--porcelain', '-z', '--untracked-files=all'], {
        cwd: task.worktree_path,
        encoding: 'utf-8',
      });

      const changes = parsePorcelainStatus(statusOutput)
        .filter(file => !file.path.startsWith('.claude/'))
        .map((file) => ({
          path: file.path,
          status: file.status,
        }));

      return successResponse(changes);
    } catch (error) {
      logError(error, request);
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
      logError(error, request);
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

  fastify.post<{ Params: { taskId: string }; Querystring: ProjectIdQuery; Body: { remote?: string; setUpstream?: boolean } }>('/worktrees/:taskId/push', async (request, reply) => {
    try {
      const taskId = parseNumber(request.params.taskId);
      const { remote = 'origin', setUpstream = false } = request.body || {};

      const task = await taskRepo.findById(taskId);
      if (!task) {
        reply.code(404);
        return errorResponse('Task not found');
      }

      if (!task.worktree_path) {
        reply.code(400);
        return errorResponse('Task has no worktree');
      }

      if (!fs.existsSync(task.worktree_path)) {
        reply.code(400);
        return errorResponse('Task worktree path does not exist');
      }

      if (!isValidRemoteName(remote)) {
        reply.code(400);
        return errorResponse('Invalid remote');
      }

      const args = ['push'];
      if (setUpstream) {
        args.push('--set-upstream', remote, task.worktree_branch || `task/${taskId}`);
      } else {
        args.push(remote);
      }

      const result = spawnSync('git', args, {
        cwd: task.worktree_path,
        encoding: 'utf-8',
      });

      if (result.error) {
        throw result.error;
      }

      if (result.status !== 0) {
        throw new Error(result.stderr?.trim() || result.stdout?.trim() || 'Failed to push changes');
      }

      const output = [result.stdout?.trim(), result.stderr?.trim()].filter(Boolean).join('\n');
      return successResponse({ output }, 'Changes pushed successfully');
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to push changes'));
    }
  });

  // ==================== Branch Management ====================

  fastify.get<{ Querystring: ProjectIdQuery }>('/branches', async (request) => {
    try {
      const projectId = parseNumber(request.query.projectId);
      if (!projectId) {
        return errorResponse('projectId is required');
      }

      const branches = await listProjectBranches(projectId);
      return successResponse(branches);
    } catch (error) {
      logError(error, request);
      return errorResponse(getErrorMessage(error, 'Failed to list branches'));
    }
  });

  // POST /branches/:source/merge/:target - Merge source branch into target
  fastify.post<{ Params: { source: string; target: string }; Querystring: ProjectIdQuery }>(
    '/branches/:source/merge/:target',
    async (request, reply) => {
      try {
        const projectId = parseNumber(request.query.projectId);
        const { source, target } = request.params;

        if (!projectId) {
          reply.code(400);
          return errorResponse('projectId is required');
        }
        if (!source) {
          reply.code(400);
          return errorResponse('Source branch is required');
        }
        if (!target) {
          reply.code(400);
          return errorResponse('Target branch is required');
        }

        const { repoPath } = await getProjectRepoPath(projectId);

        // 验证源分支存在
        try {
          execSync(`git rev-parse --verify "${source}"`, {
            cwd: repoPath,
            encoding: 'utf-8',
            stdio: 'ignore',
          });
        } catch {
          reply.code(404);
          return errorResponse(`Source branch '${source}' not found`);
        }

        // 验证目标分支存在
        try {
          execSync(`git rev-parse --verify "${target}"`, {
            cwd: repoPath,
            encoding: 'utf-8',
            stdio: 'ignore',
          });
        } catch {
          reply.code(404);
          return errorResponse(`Target branch '${target}' not found`);
        }

        // 保存当前分支
        const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
          cwd: repoPath,
          encoding: 'utf-8',
        }).trim();

        // 切换到目标分支
        execSync(`git checkout "${target}"`, { cwd: repoPath, encoding: 'utf-8' });

        try {
          // 执行合并
          const result = mergeBranch(source, repoPath, { noFastForward: true });

          if (result.hasConflicts) {
            return successResponse({
              success: false,
              hasConflicts: true,
              conflicts: result.conflicts,
              message: result.message,
            }, 'Merge conflicts detected');
          }

          return successResponse({
            success: true,
            hasConflicts: false,
            conflicts: [],
            message: result.message,
          }, 'Branch merged successfully');
        } finally {
          // 恢复到原分支
          if (currentBranch && currentBranch !== target) {
            try {
              execSync(`git checkout "${currentBranch}"`, { cwd: repoPath, encoding: 'utf-8' });
            } catch {
              logger.warn('GitRoutes', `Failed to checkout back to ${currentBranch}`);
            }
          }
        }
      } catch (error) {
        logError(error, request);
        const execError = error as Error & { stderr?: string };
        const stderr = execError.stderr || execError.message;

        if (stderr.includes('does not exist')) {
          reply.code(404);
          return errorResponse('Branch not found');
        }

        reply.code(getStatusCode(error));
        return errorResponse(getErrorMessage(error, `Failed to merge branch: ${stderr}`));
      }
    }
  );

  // ==================== Diff ====================

  fastify.get<{ Params: { taskId: string }; Querystring: ProjectIdQuery & { source?: string; target?: string } }>('/worktrees/:taskId/diff', async (request, reply) => {
    try {
      const taskId = parseNumber(request.params.taskId);

      const task = await taskRepo.findById(taskId);
      if (!task) {
        reply.code(404);
        return errorResponse('Task not found');
      }

      if (!task.worktree_path) {
        reply.code(400);
        return errorResponse('Task has no worktree');
      }

      const result = buildWorktreeDiff(task.worktree_path);
      return successResponse(result);
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get diff'));
    }
  });
};
