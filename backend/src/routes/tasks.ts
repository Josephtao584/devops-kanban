import type { FastifyPluginAsync } from 'fastify';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { buildWorktreeDiff, buildBranchDiff } from './git.js';
import { isGitRepository, getWorktreePath } from '../utils/git.js';
import { TaskService } from '../services/taskService.js';
import { ProjectRepository } from '../repositories/projectRepository.js';
import type { CreateTaskInput, StartTaskInput, UpdateTaskInput } from '../types/dto/tasks.js';
import type { Suggestion } from '../types/entities.ts';
import type { IdParams } from '../types/http/params.js';
import type { ProjectIdQuery } from '../types/http/query.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { getErrorMessage, getStatusCode, parseNumber, logError } from '../utils/http.js';
import { sanitizeWorkDir } from '../utils/workDir.js';

const taskService = new TaskService();
const projectRepo = new ProjectRepository();

type QueryWithTaskFilters = ProjectIdQuery & { iteration_id?: string };
type StatusBody = { status?: string };
type ReorderRequestBody = { updates?: Array<{ id?: number; order?: number }> };

import { splitSuggestionService } from '../services/splitSuggestionService.js';
import { WorkflowRunRepository } from '../repositories/workflowRunRepository.js';
import { WorkflowInstanceRepository } from '../repositories/workflowInstanceRepository.js';
import { WorkflowService } from '../services/workflow/workflowService.js';

const workflowRunRepo = new WorkflowRunRepository();
const workflowInstanceRepo = new WorkflowInstanceRepository();
const workflowService = new WorkflowService();

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
      logError(error, request);
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
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get task'));
    }
  });

  fastify.post('/', async (request, reply) => {
    try {
      const task = await taskService.create(request.body as CreateTaskInput);
      return successResponse(task, 'Task created successfully');
    } catch (error) {
      logError(error, request);
      const statusCode = getStatusCode(error);
      if (statusCode === 400) {
        reply.code(400);
        return errorResponse(getErrorMessage(error, 'Failed to create task'));
      }
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to create task'));
    }
  });

  fastify.put<{ Params: IdParams; Body: UpdateTaskInput }>('/:id', async (request, reply) => {
    try {
      const body = request.body;
      const taskData: UpdateTaskInput = {};
      const allowedKeys: (keyof UpdateTaskInput)[] = [
        'title', 'description', 'project_id', 'iteration_id', 'status',
        'priority', 'assignee', 'due_date', 'external_id', 'workflow_run_id',
        'worktree_path', 'worktree_branch', 'order',
        'auto_execute', 'auto_execute_template_id', 'work_dir',
      ];
      for (const key of allowedKeys) {
        if ((body as any)[key] !== undefined) {
          (taskData as any)[key] = (body as any)[key];
        }
      }
      const updated = await taskService.update(parseNumber(request.params.id), taskData);
      if (!updated) {
        reply.code(404);
        return errorResponse('Task not found');
      }
      return successResponse(updated, 'Task updated successfully');
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to update task'));
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
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to update task status'));
    }
  });

  fastify.delete<{ Params: IdParams; Querystring: { deleteWorktree?: boolean } }>('/:id', async (request, reply) => {
    try {
      const { deleteWorktree } = request.query;
      const deleted = await taskService.delete(parseNumber(request.params.id), deleteWorktree);
      if (!deleted) {
        reply.code(404);
        return errorResponse('Task not found');
      }
      return successResponse(null, 'Task deleted successfully');
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to delete task'));
    }
  });

  fastify.post<{ Params: IdParams; Body: StartTaskInput }>('/:id/start', async (request, reply) => {
    try {
      const task = await taskService.startTask(parseNumber(request.params.id), request.body as StartTaskInput);
      return successResponse(task, 'Task started successfully');
    } catch (error) {
      logError(error, request);
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
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to reorder tasks'));
    }
  });

  // Batch create, pipeline, dependents, regenerate-split
  fastify.post<{ Body: { parent_task_id: number; suggestions: Suggestion[] } }>(
    '/batch-create',
    async (req, reply) => {
      try {
        const created = await taskService.batchCreate(req.body);
        return successResponse(created.map((c) => c.task));
      } catch (e) {
        reply.code(400);
        return errorResponse(getErrorMessage(e, 'Failed to batch create tasks'));
      }
    },
  );

  fastify.get<{ Params: IdParams }>('/:id/dependents', async (req) => {
    const dependents = await taskService.getDependents(parseNumber(req.params.id));
    return successResponse(dependents);
  });

  fastify.get<{ Params: IdParams }>('/:id/pipeline', async (req, reply) => {
    try {
      const pipeline = await taskService.getPipeline(parseNumber(req.params.id));
      return successResponse(pipeline);
    } catch (e) {
      const statusCode = getStatusCode(e);
      if (statusCode === 404) {
        reply.code(404);
        return errorResponse(getErrorMessage(e, 'Task not found'));
      }
      reply.code(statusCode);
      return errorResponse(getErrorMessage(e, 'Failed to get pipeline'));
    }
  });

  fastify.post<{ Params: IdParams }>('/:id/regenerate-split', async (req, reply) => {
    try {
      const taskId = parseNumber(req.params.id);

      // Dismiss the current pending suggestion (if any) so the user doesn't
      // see a stale record while the step re-runs.
      const existing = await splitSuggestionService.getPendingByTask(taskId);
      if (existing) await splitSuggestionService.dismiss(existing.id);

      // Find the task's latest workflow run and look up the SPLIT_TASK step
      // on its frozen instance. If either is missing we can't regenerate.
      const run = await workflowRunRepo.findLatestByTaskId(taskId);
      if (!run) {
        return successResponse({ dismissed: !!existing, regenerated: false, reason: 'no workflow run for task' });
      }

      const instance = await workflowInstanceRepo.findByInstanceId(run.workflow_instance_id);
      const splitStepBinding = instance?.steps.find((s) => s.type === 'SPLIT_TASK');
      if (!splitStepBinding) {
        return successResponse({ dismissed: !!existing, regenerated: false, reason: 'no SPLIT_TASK step in instance' });
      }

      try {
        await workflowService.retryStep(run.id, splitStepBinding.id);
        return successResponse({ dismissed: !!existing, regenerated: true, runId: run.id, stepId: splitStepBinding.id });
      } catch (err) {
        logError(err, req);
        reply.code(getStatusCode(err));
        return errorResponse(getErrorMessage(err, 'Failed to regenerate split'));
      }
    } catch (err) {
      logError(err, req);
      reply.code(getStatusCode(err));
      return errorResponse(getErrorMessage(err, 'Failed to regenerate split'));
    }
  });

  // Worktree routes
  fastify.get<{ Params: IdParams }>('/:id/worktree', async (request, reply) => {
    try {
      const status = await taskService.getWorktreeStatus(parseNumber(request.params.id));
      return successResponse(status);
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get worktree status'));
    }
  });

  fastify.post<{ Params: IdParams }>('/:id/worktree', async (request, reply) => {
    try {
      const result = await taskService.createWorktree(parseNumber(request.params.id));
      return successResponse(result, 'Worktree created successfully');
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to create worktree'));
    }
  });

  fastify.delete<{ Params: IdParams }>('/:id/worktree', async (request, reply) => {
    try {
      const result = await taskService.deleteWorktree(parseNumber(request.params.id));
      return successResponse(result, 'Worktree deleted successfully');
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to delete worktree'));
    }
  });

  fastify.post<{ Params: IdParams; Body: { work_dir?: string | null } }>('/:id/worktree/preview', async (request, reply) => {
    try {
      const task = await taskService.getById(parseNumber(request.params.id));
      if (!task) {
        reply.code(404);
        return errorResponse('Task not found');
      }
      const project = await projectRepo.findById(task.project_id);
      if (!project?.local_path) {
        reply.code(400);
        return errorResponse('Project has no local path configured');
      }
      const worktreePath = getWorktreePath(task.id, task.title, project.local_path);
      const workDir = sanitizeWorkDir(request.body?.work_dir);
      const fullPath = workDir ? path.join(worktreePath, workDir) : worktreePath;
      const projectWorkPath = workDir ? path.join(project.local_path, workDir) : project.local_path;
      return successResponse({
        worktree_path: worktreePath,
        full_path: fullPath,
        worktree_exists: fs.existsSync(worktreePath),
        full_path_exists: fs.existsSync(fullPath),
        project_local_path: project.local_path,
        project_work_path: projectWorkPath,
        project_exists: fs.existsSync(project.local_path),
        project_work_path_exists: fs.existsSync(projectWorkPath),
        worktree_base_exists: fs.existsSync(path.join(project.local_path, '.worktrees')),
      });
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to preview worktree path'));
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
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get diff'));
    }
  });
};
