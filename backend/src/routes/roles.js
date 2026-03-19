/**
 * Roles Routes
 */
import { BaseRepository } from '../repositories/base.js';

const repo = new BaseRepository('roles.json');

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
 * Register roles routes
 */
async function rolesRoutes(fastify) {
  // Get all roles
  fastify.get('/', async (request, reply) => {
    try {
      const roles = await repo.findAll();
      return successResponse(roles);
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get roles');
    }
  });

  // Get role by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const roleId = parseInt(request.params.id, 10);
      const role = await repo.findById(roleId);
      if (!role) {
        reply.code(404);
        return errorResponse('Role not found');
      }
      return successResponse(role);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get role');
    }
  });

  // Create role
  fastify.post('/', async (request, reply) => {
    try {
      const role = await repo.create(request.body);
      return successResponse(role, 'Role created');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to create role');
    }
  });

  // Update role
  fastify.put('/:id', async (request, reply) => {
    try {
      const roleId = parseInt(request.params.id, 10);
      const updated = await repo.update(roleId, request.body);
      if (!updated) {
        reply.code(404);
        return errorResponse('Role not found');
      }
      return successResponse(updated, 'Role updated');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to update role');
    }
  });

  // Delete role
  fastify.delete('/:id', async (request, reply) => {
    try {
      const roleId = parseInt(request.params.id, 10);
      const deleted = await repo.delete(roleId);
      if (!deleted) {
        reply.code(404);
        return errorResponse('Role not found');
      }
      return successResponse(null, 'Role deleted');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to delete role');
    }
  });
}

export default rolesRoutes;
