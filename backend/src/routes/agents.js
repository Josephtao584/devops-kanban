/**
 * Agent Routes
 */
import { AgentRepository } from '../repositories/agentRepository.js';

const repo = new AgentRepository();

/**
 * Format success response
 */
function successResponse(data = null, message = 'Success') {
  return { success: true, message, data };
}

/**
 * Format error response
 */
function errorResponse(message, error = null) {
  return { success: false, message, error, data: null };
}

/**
 * Register agent routes
 */
async function agentRoutes(fastify) {
  // Get all agents
  fastify.get('/', async (request, reply) => {
    try {
      const agents = await repo.findAll();
      return successResponse(agents);
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get agents');
    }
  });

  // Get agent by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const agentId = parseInt(request.params.id, 10);
      const agent = await repo.findById(agentId);
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

  // Create agent
  fastify.post('/', async (request, reply) => {
    try {
      const agent = await repo.create(request.body);
      return successResponse(agent, 'Agent created');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to create agent');
    }
  });

  // Update agent
  fastify.put('/:id', async (request, reply) => {
    try {
      const agentId = parseInt(request.params.id, 10);
      const updated = await repo.update(agentId, request.body);
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

  // Delete agent
  fastify.delete('/:id', async (request, reply) => {
    try {
      const agentId = parseInt(request.params.id, 10);
      const deleted = await repo.delete(agentId);
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
}

export default agentRoutes;
