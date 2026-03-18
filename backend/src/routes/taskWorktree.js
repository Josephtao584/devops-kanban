/**
 * Task Worktree Routes
 */
const { TaskService } = require('../services/taskService');

async function taskWorktreeRoutes(fastify, options) {
  const taskService = new TaskService();

  // Create worktree for a task
  fastify.post('/:taskId/worktree', async (request, reply) => {
    const { taskId } = request.params;

    try {
      const result = await taskService.createWorktree(parseInt(taskId));
      return {
        success: true,
        message: 'Worktree created successfully',
        data: result
      };
    } catch (error) {
      const statusCode = error.statusCode || 500;
      reply.code(statusCode);
      return {
        success: false,
        message: error.message,
        error: error.message
      };
    }
  });

  // Delete worktree for a task
  fastify.delete('/:taskId/worktree', async (request, reply) => {
    const { taskId } = request.params;

    try {
      const result = await taskService.deleteWorktree(parseInt(taskId));
      return {
        success: true,
        message: result.message,
        data: result
      };
    } catch (error) {
      const statusCode = error.statusCode || 500;
      reply.code(statusCode);
      return {
        success: false,
        message: error.message,
        error: error.message
      };
    }
  });

  // Get worktree status for a task
  fastify.get('/:taskId/worktree', async (request, reply) => {
    const { taskId } = request.params;

    try {
      const result = await taskService.getWorktreeStatus(parseInt(taskId));
      return {
        success: true,
        data: result
      };
    } catch (error) {
      const statusCode = error.statusCode || 500;
      reply.code(statusCode);
      return {
        success: false,
        message: error.message,
        error: error.message
      };
    }
  });
}

module.exports = taskWorktreeRoutes;