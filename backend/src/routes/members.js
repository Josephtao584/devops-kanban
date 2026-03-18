/**
 * Members Routes
 */
const { BaseRepository } = require('../repositories/base');

const repo = new BaseRepository('members.json');

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
 * Register members routes
 */
async function membersRoutes(fastify) {
  // Get all members
  fastify.get('/', async (request, reply) => {
    try {
      const members = await repo.findAll();
      return successResponse(members);
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get members');
    }
  });

  // Get member by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const memberId = parseInt(request.params.id, 10);
      const member = await repo.findById(memberId);
      if (!member) {
        reply.code(404);
        return errorResponse('Member not found');
      }
      return successResponse(member);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get member');
    }
  });

  // Create member
  fastify.post('/', async (request, reply) => {
    try {
      const member = await repo.create(request.body);
      return successResponse(member, 'Member created');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to create member');
    }
  });

  // Update member
  fastify.put('/:id', async (request, reply) => {
    try {
      const memberId = parseInt(request.params.id, 10);
      const updated = await repo.update(memberId, request.body);
      if (!updated) {
        reply.code(404);
        return errorResponse('Member not found');
      }
      return successResponse(updated, 'Member updated');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to update member');
    }
  });

  // Delete member
  fastify.delete('/:id', async (request, reply) => {
    try {
      const memberId = parseInt(request.params.id, 10);
      const deleted = await repo.delete(memberId);
      if (!deleted) {
        reply.code(404);
        return errorResponse('Member not found');
      }
      return successResponse(null, 'Member deleted');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to delete member');
    }
  });
}

module.exports = membersRoutes;
