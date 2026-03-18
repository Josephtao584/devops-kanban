/**
 * Task Routes
 */
const { TaskService } = require('../services/taskService');

const service = new TaskService();

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
 * Register task routes
 */
async function taskRoutes(fastify) {
  // Get all tasks
  fastify.get('/', async (request, reply) => {
    try {
      const tasks = await service.getAll();
      return successResponse(tasks);
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get tasks');
    }
  });

  // Get task by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const taskId = parseInt(request.params.id, 10);
      const task = await service.getById(taskId);
      if (!task) {
        reply.code(404);
        return errorResponse('Task not found');
      }
      return successResponse(task);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get task');
    }
  });

  // Create task
  fastify.post('/', async (request, reply) => {
    try {
      const task = await service.create(request.body);
      return successResponse(task, 'Task created successfully');
    } catch (error) {
      request.log.error(error);
      if (error.statusCode === 400) {
        reply.code(400);
        return errorResponse(error.message);
      }
      reply.code(500);
      return errorResponse('Failed to create task');
    }
  });

  // Update task
  fastify.put('/:id', async (request, reply) => {
    try {
      const taskId = parseInt(request.params.id, 10);
      const updated = await service.update(taskId, request.body);
      if (!updated) {
        reply.code(404);
        return errorResponse('Task not found');
      }
      return successResponse(updated, 'Task updated successfully');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to update task');
    }
  });

  // Update task status (PATCH)
  fastify.patch('/:id/status', async (request, reply) => {
    try {
      const taskId = parseInt(request.params.id, 10);
      const { status } = request.body;

      if (!status) {
        reply.code(400);
        return errorResponse('Status is required');
      }

      const updated = await service.updateStatus(taskId, status);
      if (!updated) {
        reply.code(404);
        return errorResponse('Task not found');
      }
      return successResponse(updated, 'Task status updated successfully');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to update task status');
    }
  });

  // Delete task
  fastify.delete('/:id', async (request, reply) => {
    try {
      const taskId = parseInt(request.params.id, 10);
      const deleted = await service.delete(taskId);
      if (!deleted) {
        reply.code(404);
        return errorResponse('Task not found');
      }
      return successResponse(null, 'Task deleted successfully');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to delete task');
    }
  });

  // Batch update task order
  fastify.put('/reorder', async (request, reply) => {
    try {
      const { updates } = request.body;
      if (!Array.isArray(updates)) {
        reply.code(400);
        return errorResponse('Updates must be an array');
      }

      const results = [];
      for (const update of updates) {
        if (update.id && update.order !== undefined) {
          const updated = await service.update(update.id, { order: update.order });
          if (updated) {
            results.push(updated);
          }
        }
      }

      return successResponse(results, 'Tasks reordered');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to reorder tasks');
    }
  });
}

module.exports = taskRoutes;
