/**
 * Iteration Routes
 */
import { IterationService } from '../services/iterationService.js';

const service = new IterationService();

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
 * Register iteration routes
 */
async function iterationRoutes(fastify) {
  // Get all iterations for a project
  fastify.get('/', async (request, reply) => {
    try {
      const { project_id } = request.query;
      if (!project_id) {
        reply.code(400);
        return errorResponse('project_id is required');
      }

      const iterations = await service.getByProject(parseInt(project_id, 10));
      return successResponse(iterations);
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get iterations');
    }
  });

  // Get iteration by ID with stats
  fastify.get('/:id', async (request, reply) => {
    try {
      const iterationId = parseInt(request.params.id, 10);
      const iteration = await service.getByIdWithStats(iterationId);
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

  // Get tasks for an iteration
  fastify.get('/:id/tasks', async (request, reply) => {
    try {
      const iterationId = parseInt(request.params.id, 10);
      if (!(await service.exists(iterationId))) {
        reply.code(404);
        return errorResponse('Iteration not found');
      }

      const tasks = await service.getTasks(iterationId);
      return successResponse(tasks);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get iteration tasks');
    }
  });

  // Create iteration
  fastify.post('/', async (request, reply) => {
    try {
      const iteration = await service.create(request.body);
      return successResponse(iteration, 'Iteration created successfully');
    } catch (error) {
      request.log.error(error);
      if (error.statusCode === 400) {
        reply.code(400);
        return errorResponse(error.message);
      }
      reply.code(500);
      return errorResponse('Failed to create iteration');
    }
  });

  // Update iteration
  fastify.put('/:id', async (request, reply) => {
    try {
      const iterationId = parseInt(request.params.id, 10);
      const updated = await service.update(iterationId, request.body);
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

  // Update iteration status (PATCH)
  fastify.patch('/:id/status', async (request, reply) => {
    try {
      const iterationId = parseInt(request.params.id, 10);
      const { status } = request.body;

      if (!status) {
        reply.code(400);
        return errorResponse('Status is required');
      }

      const updated = await service.updateStatus(iterationId, status);
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

  // Delete iteration
  fastify.delete('/:id', async (request, reply) => {
    try {
      const iterationId = parseInt(request.params.id, 10);
      const deleted = await service.delete(iterationId);
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
}

export default iterationRoutes;
