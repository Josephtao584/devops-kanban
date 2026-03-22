import type { FastifyPluginAsync } from 'fastify';

import { AgentRepository } from '../repositories/agentRepository.js';
import { successResponse, errorResponse } from '../utils/response.js';

type ParamsWithId = { id: string };

const agentRepo = new AgentRepository();

function parseNumber(value: string) {
  return Number.parseInt(value, 10);
}

export const agentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request) => {
    try {
      return successResponse(await agentRepo.findAll());
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get agents');
    }
  });

  fastify.get<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const agent = await agentRepo.findById(parseNumber(request.params.id));
      if (!agent) {
        reply.code(404);
        return errorResponse('Agent not found');
      }
      return successResponse(agent);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get agent');
    }
  });

  fastify.post('/', async (request, reply) => {
    try {
      const agent = await agentRepo.create(request.body as Record<string, unknown>);
      return successResponse(agent, 'Agent created');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to create agent');
    }
  });

  fastify.put<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const updated = await agentRepo.update(parseNumber(request.params.id), request.body as Record<string, unknown>);
      if (!updated) {
        reply.code(404);
        return errorResponse('Agent not found');
      }
      return successResponse(updated, 'Agent updated');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to update agent');
    }
  });

  fastify.delete<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const deleted = await agentRepo.delete(parseNumber(request.params.id));
      if (!deleted) {
        reply.code(404);
        return errorResponse('Agent not found');
      }
      return successResponse(null, 'Agent deleted');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to delete agent');
    }
  });
};
