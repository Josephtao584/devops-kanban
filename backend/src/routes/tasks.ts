import type { FastifyPluginAsync } from 'fastify';
import * as fs from 'node:fs';

import { buildWorktreeDiff, buildBranchDiff } from './git.js';
import { isGitRepository } from '../utils/git.js';
import { TaskService } from '../services/taskService.js';
import { ProjectRepository } from '../repositories/projectRepository.js';
import type { CreateTaskInput, StartTaskInput, UpdateTaskInput } from '../types/dto/tasks.js';
import type { IdParams } from '../types/http/params.js';
import type { ProjectIdQuery } from '../types/http/query.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { getErrorMessage, getStatusCode, parseNumber } from '../utils/http.js';

const taskService = new TaskService();
const projectRepo = new ProjectRepository();

type QueryWithTaskFilters = ProjectIdQuery & { iteration_id?: string };
type StatusBody = { status?: string };
type ReorderRequestBody = { updates?: Array<{ id?: number; order?: number }> };

export const taskRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Querystring: QueryWithTaskFilters }>('/', async (request) => {
    try {
      const { project_id, iteration_id } = request.query;
      if (iteration_id !== undefined) {
        const iterId = iteration_id === 'null' ? null : parseNumber(iteration_id);
        const tasks = await taskService.getByProjectAndIteration(parseNumber(project_id ?? '0'), iterId);
        return successResponse(tasks);
      }
      if (project_id) {
        const tasks = await taskService.getByProject(parseNumber(project_id));
        return successResponse(tasks);
      }
      return successResponse(await taskService.getAll());
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get tasks');
    }
  });

  fastify.get<{ Params: IdParams }>('/:id', async (request, reply) => {
    try {
      const task = await taskService.getById(parseNumber(request.params.id));
      if (!task) {
        reply.code(404);
        return errorResponse('Task not found');
      }
      return successResponse(task);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get task');
    }
  });

  fastify.post('/', async (request, reply) => {
    try {
      const task = await taskService.create(request.body as CreateTaskInput);
      return successResponse(task, 'Task created successfully');
    } catch (error) {
      request.log.error(error);
      const statusCode = getStatusCode(error);
      if (statusCode === 400) {
        reply.code(400);
        return errorResponse(getErrorMessage(error, 'Failed to create task'));
      }
      reply.code(500);
      return errorResponse('Failed to create task');
    }
  });

  fastify.put<{ Params: IdParams }>('/:id', async (request, reply) => {
    try {
      const updated = await taskService.update(parseNumber(request.params.id), request.body as UpdateTaskInput);
      if (!updated) {
        reply.code(404);
        return errorResponse('Task not found');
      }
      return successResponse(updated, 'Task updated successfully');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to update task');
    }
  });

  fastify.patch<{ Params: IdParams; Body: StatusBody }>('/:id/status', async (request, reply) => {
    try {
      const { status } = request.body;
      if (!status) {
        reply.code(400);
        return errorResponse('Status is required');
      }

      const updated = await taskService.updateStatus(parseNumber(request.params.id), status);
      if (!updated) {
        reply.code(404);
        return errorResponse('Task not found');
      }
      return successResponse(updated, 'Task status updated successfully');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to update task status');
    }
  });

  fastify.delete<{ Params: IdParams }>('/:id', async (request, reply) => {
    try {
      const deleted = await taskService.delete(parseNumber(request.params.id));
      if (!deleted) {
        reply.code(404);
        return errorResponse('Task not found');
      }
      return successResponse(null, 'Task deleted successfully');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to delete task');
    }
  });

  fastify.post<{ Params: IdParams; Body: StartTaskInput }>('/:id/start', async (request, reply) => {
    try {
      const task = await taskService.startTask(parseNumber(request.params.id), request.body);
      return successResponse(task, 'Task started successfully');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to start task'));
    }
  });

  fastify.put<{ Body: ReorderRequestBody }>('/reorder', async (request, reply) => {
    try {
      const { updates } = request.body;
      if (!Array.isArray(updates)) {
        reply.code(400);
        return errorResponse('Updates must be an array');
      }

      const results = [];
      for (const update of updates) {
        if (update.id && update.order !== undefined) {
          const updated = await taskService.update(update.id, { order: update.order });
          if (updated) {
            results.push(updated);
          }
        }
      }

      return successResponse(results, 'Tasks reordered');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to reorder tasks');
    }
  });

  // Worktree routes
  fastify.get<{ Params: IdParams }>('/:id/worktree', async (request, reply) => {
    try {
      const status = await taskService.getWorktreeStatus(parseNumber(request.params.id));
      return successResponse(status);
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get worktree status'));
    }
  });

  fastify.post<{ Params: IdParams }>('/:id/worktree', async (request, reply) => {
    try {
      const result = await taskService.createWorktree(parseNumber(request.params.id));
      return successResponse(result, 'Worktree created successfully');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to create worktree'));
    }
  });

  fastify.delete<{ Params: IdParams }>('/:id/worktree', async (request, reply) => {
    try {
      const result = await taskService.deleteWorktree(parseNumber(request.params.id));
      return successResponse(result, 'Worktree deleted successfully');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to delete worktree'));
    }
  });

  fastify.get<{ Params: IdParams; Querystring: ProjectIdQuery & { source?: string; target?: string } }>('/:id/worktree/diff', async (request, reply) => {
    try {
      const taskId = parseNumber(request.params.id);
      const { source, target, project_id } = request.query;
      const projectId = project_id ? parseNumber(project_id) : 0;

      const task = await taskService.getById(taskId);
      if (!task) {
        reply.code(404);
        return errorResponse('Task not found');
      }

      // If source and target are provided, compare branches
      if (source && target && projectId) {
        if (task.worktree_path && fs.existsSync(task.worktree_path) && isGitRepository(task.worktree_path)) {
          const result = buildBranchDiff(task.worktree_path, source, target);
          return successResponse(result);
        }

        const project = await projectRepo.findById(projectId);
        if (!project) {
          reply.code(404);
          return errorResponse('Project not found');
        }

        let repoPath = '';
        if (project.local_path && fs.existsSync(project.local_path)) {
          if (!isGitRepository(project.local_path)) {
            reply.code(400);
            return errorResponse('Project local_path is not a valid git repository');
          }
          repoPath = project.local_path;
        } else if (project.git_url) {
          reply.code(400);
          return errorResponse('Cannot compare branches: no local repository');
        } else {
          reply.code(400);
          return errorResponse('Project has no git repository configured');
        }

        const result = buildBranchDiff(repoPath, source, target);
        return successResponse(result);
      }

      // Fallback: return uncommitted changes in worktree
      if (!task.worktree_path) {
        reply.code(400);
        return errorResponse('Task has no worktree');
      }

      const result = buildWorktreeDiff(task.worktree_path);
      return successResponse(result);
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get diff'));
    }
  });
};
