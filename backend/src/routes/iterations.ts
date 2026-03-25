import type { FastifyPluginAsync } from 'fastify';

import { IterationService } from '../services/iterationService.js';
import type { CreateIterationInput, UpdateIterationInput } from '../types/dto/iterations.js';
import type { IdParams } from '../types/http/params.js';
import type { ProjectIdQuery } from '../types/http/query.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { getErrorMessage, getStatusCode, parseNumber } from '../utils/http.js';

type StatusBody = { status?: string };

const iterationService = new IterationService();

export const iterationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Querystring: ProjectIdQuery }>('/', async (request, reply) => {
    try {
      const { project_id } = request.query;
      if (!project_id) {
        reply.code(400);
        return errorResponse('project_id is required');
      }
      return successResponse(await iterationService.getByProject(parseNumber(project_id)));
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get iterations');
    }
  });

  fastify.get<{ Params: IdParams }>('/:id', async (request, reply) => {
    try {
      const iteration = await iterationService.getByIdWithStats(parseNumber(request.params.id));
      if (!iteration) {
        reply.code(404);
        return errorResponse('Iteration not found');
      }
      return successResponse(iteration);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get iteration');
    }
  });

  fastify.get<{ Params: IdParams }>('/:id/tasks', async (request, reply) => {
    try {
      const iterationId = parseNumber(request.params.id);
      if (!(await iterationService.exists(iterationId))) {
        reply.code(404);
        return errorResponse('Iteration not found');
      }
      return successResponse(await iterationService.getTasks(iterationId));
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get iteration tasks');
    }
  });

  fastify.post('/', async (request, reply) => {
    try {
      const iteration = await iterationService.create(request.body as CreateIterationInput);
      return successResponse(iteration, 'Iteration created successfully');
    } catch (error) {
      request.log.error(error);
      const statusCode = getStatusCode(error);
      if (statusCode === 400) {
        reply.code(400);
        return errorResponse(getErrorMessage(error, 'Failed to create iteration'));
      }
      reply.code(500);
      return errorResponse('Failed to create iteration');
    }
  });

  fastify.put<{ Params: IdParams }>('/:id', async (request, reply) => {
    try {
      const updated = await iterationService.update(parseNumber(request.params.id), request.body as UpdateIterationInput);
      if (!updated) {
        reply.code(404);
        return errorResponse('Iteration not found');
      }
      return successResponse(updated, 'Iteration updated successfully');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to update iteration');
    }
  });

  fastify.patch<{ Params: IdParams; Body: StatusBody }>('/:id/status', async (request, reply) => {
    try {
      const { status } = request.body;
      if (!status) {
        reply.code(400);
        return errorResponse('Status is required');
      }
      const updated = await iterationService.update(parseNumber(request.params.id), {status});
      if (!updated) {
        reply.code(404);
        return errorResponse('Iteration not found');
      }
      return successResponse(updated, 'Iteration status updated successfully');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to update iteration status');
    }
  });

  fastify.delete<{ Params: IdParams }>('/:id', async (request, reply) => {
    try {
      const deleted = await iterationService.delete(parseNumber(request.params.id));
      if (!deleted) {
        reply.code(404);
        return errorResponse('Iteration not found');
      }
      return successResponse(null, 'Iteration deleted successfully');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to delete iteration');
    }
  });
};
