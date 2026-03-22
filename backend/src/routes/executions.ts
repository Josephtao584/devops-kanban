import type { FastifyPluginAsync } from 'fastify';

import {
  ExecutionService,
  type CreateExecutionInput,
  type UpdateExecutionInput,
} from '../services/executionService.js';
import { successResponse, errorResponse } from '../utils/response.js';

type ParamsWithId = { id: string };
type ParamsWithTaskId = { taskId: string };
type ParamsWithSessionId = { sessionId: string };

const executionService = new ExecutionService();

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

export const executionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request) => {
    try {
      return successResponse(await executionService.getAll());
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get executions');
    }
  });

  fastify.get<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const execution = await executionService.getById(parseNumber(request.params.id));
      if (!execution) {
        reply.code(404);
        return errorResponse('Execution not found');
      }
      return successResponse(execution);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get execution');
    }
  });

  fastify.get<{ Params: ParamsWithSessionId }>('/session/:sessionId', async (request) => {
    try {
      return successResponse(await executionService.getBySession(parseNumber(request.params.sessionId)));
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get executions');
    }
  });

  fastify.get<{ Params: ParamsWithTaskId }>('/task/:taskId', async (request) => {
    try {
      return successResponse(await executionService.getByTask(parseNumber(request.params.taskId)));
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get executions');
    }
  });

  fastify.post('/', async (request, reply) => {
    try {
      const execution = await executionService.create((request.body as CreateExecutionInput) || { session_id: 0 });
      return successResponse(execution, 'Execution created');
    } catch (error) {
      request.log.error(error);
      const statusCode = getStatusCode(error);
      if (statusCode === 404) {
        reply.code(404);
        return errorResponse(getErrorMessage(error, 'Session not found'));
      }
      reply.code(500);
      return errorResponse('Failed to create execution');
    }
  });

  fastify.put<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const updated = await executionService.update(parseNumber(request.params.id), request.body as UpdateExecutionInput);
      if (!updated) {
        reply.code(404);
        return errorResponse('Execution not found');
      }
      return successResponse(updated, 'Execution updated');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to update execution');
    }
  });

  fastify.delete<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const deleted = await executionService.delete(parseNumber(request.params.id));
      if (!deleted) {
        reply.code(404);
        return errorResponse('Execution not found');
      }
      return successResponse(null, 'Execution deleted');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to delete execution');
    }
  });
};
