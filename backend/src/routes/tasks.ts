import type { FastifyPluginAsync } from 'fastify';

import { TaskService } from '../services/taskService.js';
import type { CreateTaskInput, UpdateTaskInput } from '../types/dto/tasks.js';
import type { IdParams } from '../types/http/params.js';
import type { ProjectIdQuery } from '../types/http/query.js';
import { successResponse, errorResponse } from '../utils/response.js';

type QueryWithTaskFilters = ProjectIdQuery & { iteration_id?: string };
type StatusBody = { status?: string };
type ReorderRequestBody = { updates?: Array<{ id?: number; order?: number }> };

const taskService = new TaskService();

function getStatusCode(error: unknown, fallback = 500) {
  if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
    return error.statusCode;
  }
  return fallback;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function parseNumber(value: string) {
  return Number.parseInt(value, 10);
}

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

  fastify.post<{ Params: IdParams }>('/:id/start', async (request, reply) => {
    try {
      const task = await taskService.startTask(parseNumber(request.params.id));
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
};
