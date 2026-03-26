import type { FastifyPluginAsync } from 'fastify';

import { TaskSourceService } from '../services/taskSourceService.js';
import type {
  CreateTaskSourceInput,
  TaskSourceImportBody,
  TaskSourcePreviewBody,
  UpdateTaskSourceInput,
} from '../types/dto/taskSources.js';
import type { IdParams } from '../types/http/params.js';
import type { ProjectIdQuery } from '../types/http/query.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { getErrorMessage, getStatusCode, parseNumber } from '../utils/http.js';

const taskSourceService = new TaskSourceService();

function handleTaskSourceError(reply: { code(statusCode: number): unknown }, error: unknown, fallbackMessage: string) {
  const statusCode = getStatusCode(error);
  reply.code(statusCode);
  return errorResponse(statusCode === 500 ? fallbackMessage : getErrorMessage(error, fallbackMessage));
}

export const taskSourceRoutes: FastifyPluginAsync = async (fastify) => {
  const getService = () => fastify.taskSourceService || taskSourceService;

  fastify.get<{ Querystring: ProjectIdQuery }>('/', async (request, reply) => {
    try {
      const { project_id } = request.query;
      if (!project_id) {
        reply.code(400);
        return errorResponse('project_id query parameter is required');
      }

      const sources = await getService().getByProject(parseNumber(project_id));
      return successResponse(sources);
    } catch (error) {
      request.log.error(error);
      return handleTaskSourceError(reply, error, 'Failed to get task sources');
    }
  });

  fastify.get('/types/available', async (request, reply) => {
    try {
      return successResponse(await getService().getAvailableSourceTypes());
    } catch (error) {
      request.log.error(error);
      return handleTaskSourceError(reply, error, 'Failed to get available source types');
    }
  });

  fastify.get<{ Params: IdParams }>('/:id', async (request, reply) => {
    try {
      const source = await getService().getById(request.params.id);
      if (!source) {
        reply.code(404);
        return errorResponse('Task source not found');
      }
      return successResponse(source);
    } catch (error) {
      request.log.error(error);
      return handleTaskSourceError(reply, error, 'Failed to get task source');
    }
  });

  fastify.post<{ Body: CreateTaskSourceInput }>('/', async (request, reply) => {
    try {
      const source = await getService().create(request.body);
      return successResponse(source, 'Task source created successfully');
    } catch (error) {
      request.log.error(error);
      return handleTaskSourceError(reply, error, 'Failed to create task source');
    }
  });

  fastify.put<{ Params: IdParams; Body: UpdateTaskSourceInput }>('/:id', async (request, reply) => {
    try {
      const source = await getService().update(request.params.id, request.body);
      if (!source) {
        reply.code(404);
        return errorResponse('Task source not found');
      }
      return successResponse(source, 'Task source updated successfully');
    } catch (error) {
      request.log.error(error);
      return handleTaskSourceError(reply, error, 'Failed to update task source');
    }
  });

  fastify.delete<{ Params: IdParams }>('/:id', async (request, reply) => {
    try {
      const deleted = await getService().delete(request.params.id);
      if (!deleted) {
        reply.code(404);
        return errorResponse('Task source not found');
      }
      return successResponse(null, 'Task source deleted successfully');
    } catch (error) {
      request.log.error(error);
      return handleTaskSourceError(reply, error, 'Failed to delete task source');
    }
  });

  fastify.post<{ Params: IdParams }>('/:id/sync', async (request, reply) => {
    try {
      const tasks = await getService().sync(request.params.id);
      return successResponse(tasks, 'Task source synced successfully');
    } catch (error) {
      request.log.error(error);
      return handleTaskSourceError(reply, error, 'Failed to sync task source');
    }
  });

  fastify.post<{ Params: IdParams; Body: TaskSourcePreviewBody }>('/:id/sync/preview', async (request, reply) => {
    try {
      const { limit = 10, offset = 0 } = request.body ?? {};
      return successResponse(await getService().previewSync(request.params.id, { limit, offset }));
    } catch (error) {
      request.log.error(error);
      return handleTaskSourceError(reply, error, `Failed to preview sync: ${getErrorMessage(error, 'Unknown error')}`);
    }
  });

  fastify.post<{ Params: IdParams; Body: TaskSourceImportBody }>('/:id/sync/import', async (request, reply) => {
    try {
      const { items, project_id, iteration_id } = request.body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        reply.code(400);
        return errorResponse('items array is required');
      }
      if (!project_id) {
        reply.code(400);
        return errorResponse('project_id is required');
      }

      const result = await getService().importIssues(request.params.id, items, project_id, iteration_id);
      return successResponse(result, 'Import completed');
    } catch (error) {
      request.log.error(error);
      return handleTaskSourceError(reply, error, `Failed to import: ${getErrorMessage(error, 'Unknown error')}`);
    }
  });

  fastify.get<{ Params: IdParams }>('/:id/test', async (request, reply) => {
    try {
      const connected = await getService().testConnection(request.params.id);
      return successResponse({ connected });
    } catch (error) {
      request.log.error(error);
      return handleTaskSourceError(reply, error, 'Failed to test task source connection');
    }
  });
};
