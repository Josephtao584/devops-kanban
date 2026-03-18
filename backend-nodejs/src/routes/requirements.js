/**
 * Requirements Routes
 */
const { BaseRepository } = require('../repositories/base');

const repo = new BaseRepository('requirements.json');

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
 * Register requirements routes
 */
async function requirementsRoutes(fastify) {
  // Get all requirements
  fastify.get('/', async (request, reply) => {
    try {
      const requirements = await repo.findAll();
      return successResponse(requirements);
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get requirements');
    }
  });

  // Get requirement by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const requirementId = parseInt(request.params.id, 10);
      const requirement = await repo.findById(requirementId);
      if (!requirement) {
        reply.code(404);
        return errorResponse('Requirement not found');
      }
      return successResponse(requirement);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get requirement');
    }
  });

  // Create requirement
  fastify.post('/', async (request, reply) => {
    try {
      const requirement = await repo.create(request.body);
      return successResponse(requirement, 'Requirement created');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to create requirement');
    }
  });

  // Update requirement
  fastify.put('/:id', async (request, reply) => {
    try {
      const requirementId = parseInt(request.params.id, 10);
      const updated = await repo.update(requirementId, request.body);
      if (!updated) {
        reply.code(404);
        return errorResponse('Requirement not found');
      }
      return successResponse(updated, 'Requirement updated');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to update requirement');
    }
  });

  // Delete requirement
  fastify.delete('/:id', async (request, reply) => {
    try {
      const requirementId = parseInt(request.params.id, 10);
      const deleted = await repo.delete(requirementId);
      if (!deleted) {
        reply.code(404);
        return errorResponse('Requirement not found');
      }
      return successResponse(null, 'Requirement deleted');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to delete requirement');
    }
  });
}

module.exports = requirementsRoutes;
