import type { FastifyPluginAsync } from 'fastify';

import { AgentRepository } from '../repositories/agentRepository.js';
import type { CreateAgentBody, UpdateAgentBody } from '../types/dto/agents.js';
import type { IdParams } from '../types/http/params.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { parseNumber } from '../utils/http.js';

const agentRepo = new AgentRepository();

export const agentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request) => {
    try {
      return successResponse(await agentRepo.findAll());
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get agents');
    }
  });

  fastify.get<{ Params: IdParams }>('/:id', async (request, reply) => {
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

  fastify.post<{ Body: CreateAgentBody }>('/', async (request, reply) => {
    try {
      const agent = await agentRepo.create(request.body);
      return successResponse(agent, 'Agent created');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to create agent');
    }
  });

  fastify.put<{ Params: IdParams; Body: UpdateAgentBody }>('/:id', async (request, reply) => {
    try {
      const updated = await agentRepo.update(parseNumber(request.params.id), request.body);
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

  fastify.delete<{ Params: IdParams }>('/:id', async (request, reply) => {
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
