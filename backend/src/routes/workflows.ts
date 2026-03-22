import type { FastifyPluginAsync } from 'fastify';

import type { StartWorkflowBody } from '../types/dto/workflows.js';
import { WorkflowService } from '../services/workflow/workflowService.js';
import type { IdParams } from '../types/http/params.js';
import type { TaskIdQuery } from '../types/http/query.js';
import { successResponse, errorResponse } from '../utils/response.js';

const workflowService = new WorkflowService();

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

const workflowRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: StartWorkflowBody }>('/run', async (request, reply) => {
    try {
      const { task_id } = request.body || {};
      if (!task_id) {
        reply.code(400);
        return errorResponse('task_id is required');
      }

      const run = await workflowService.startWorkflow(parseNumber(String(task_id)));
      return successResponse(run, 'Workflow started');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to start workflow'));
    }
  });

  fastify.get<{ Params: IdParams }>('/runs/:id', async (request, reply) => {
    try {
      const run = await workflowService.getWorkflowRun(parseNumber(request.params.id));
      if (!run) {
        reply.code(404);
        return errorResponse('Workflow run not found');
      }
      return successResponse(run);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get workflow run');
    }
  });

  fastify.get<{ Querystring: TaskIdQuery }>('/runs', async (request, reply) => {
    try {
      const taskId = parseNumber(request.query.task_id ?? '0');
      if (!taskId) {
        reply.code(400);
        return errorResponse('task_id query parameter is required');
      }
      return successResponse(await workflowService.getAllRunsByTask(taskId));
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get workflow runs');
    }
  });

  fastify.get<{ Params: IdParams }>('/runs/:id/steps', async (request, reply) => {
    try {
      const run = await workflowService.getWorkflowRun(parseNumber(request.params.id));
      if (!run) {
        reply.code(404);
        return errorResponse('Workflow run not found');
      }
      return successResponse((run as { steps?: unknown }).steps);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get workflow steps');
    }
  });

  fastify.post<{ Params: IdParams }>('/runs/:id/cancel', async (request, reply) => {
    try {
      const run = await workflowService.cancelWorkflow(parseNumber(request.params.id));
      return successResponse(run, 'Workflow cancelled');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to cancel workflow'));
    }
  });
};

export { workflowRoutes };
