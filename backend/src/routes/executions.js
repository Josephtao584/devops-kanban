/**
 * Execution Routes
 */
import { ExecutionService } from '../services/executionService.js';

const service = new ExecutionService();

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
 * Register execution routes
 */
async function executionRoutes(fastify) {
  // Get all executions
  fastify.get('/', async (request, reply) => {
    try {
      const executions = await service.getAll();
      return successResponse(executions);
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get executions');
    }
  });

  // Get execution by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const executionId = parseInt(request.params.id, 10);
      const execution = await service.getById(executionId);
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

  // Get executions by session
  fastify.get('/session/:sessionId', async (request, reply) => {
    try {
      const sessionId = parseInt(request.params.sessionId, 10);
      const executions = await service.getBySession(sessionId);
      return successResponse(executions);
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get executions');
    }
  });

  // Get executions by task
  fastify.get('/task/:taskId', async (request, reply) => {
    try {
      const taskId = parseInt(request.params.taskId, 10);
      const executions = await service.getByTask(taskId);
      return successResponse(executions);
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get executions');
    }
  });

  // Create execution
  fastify.post('/', async (request, reply) => {
    try {
      const execution = await service.create(request.body);
      return successResponse(execution, 'Execution created');
    } catch (error) {
      request.log.error(error);
      if (error.statusCode === 404) {
        reply.code(404);
        return errorResponse(error.message);
      }
      reply.code(500);
      return errorResponse('Failed to create execution');
    }
  });

  // Update execution
  fastify.put('/:id', async (request, reply) => {
    try {
      const executionId = parseInt(request.params.id, 10);
      const updated = await service.update(executionId, request.body);
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

  // Delete execution
  fastify.delete('/:id', async (request, reply) => {
    try {
      const executionId = parseInt(request.params.id, 10);
      const deleted = await service.delete(executionId);
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
}

export default executionRoutes;
