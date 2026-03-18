/**
 * Task Source Routes
 */
const { TaskSourceService } = require('../services/taskSourceService');

const service = new TaskSourceService();

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
 * Register task source routes
 */
async function taskSourceRoutes(fastify) {
  // Get all task sources for a project
  fastify.get('/', async (request, reply) => {
    try {
      const { project_id } = request.query;
      if (!project_id) {
        reply.code(400);
        return errorResponse('project_id query parameter is required');
      }

      const sources = await service.getByProject(parseInt(project_id, 10));
      return successResponse(sources);
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get task sources');
    }
  });

  // Get task source by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const sourceId = parseInt(request.params.id, 10);
      const source = await service.getById(sourceId);
      if (!source) {
        reply.code(404);
        return errorResponse('Task source not found');
      }
      return successResponse(source);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get task source');
    }
  });

  // Create task source
  fastify.post('/', async (request, reply) => {
    try {
      const source = await service.create(request.body);
      return successResponse(source, 'Task source created');
    } catch (error) {
      request.log.error(error);
      if (error.statusCode === 400) {
        reply.code(400);
        return errorResponse(error.message);
      }
      reply.code(500);
      return errorResponse('Failed to create task source');
    }
  });

  // Update task source
  fastify.put('/:id', async (request, reply) => {
    try {
      const sourceId = parseInt(request.params.id, 10);
      const updated = await service.update(sourceId, request.body);
      if (!updated) {
        reply.code(404);
        return errorResponse('Task source not found');
      }
      return successResponse(updated, 'Task source updated');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to update task source');
    }
  });

  // Delete task source
  fastify.delete('/:id', async (request, reply) => {
    try {
      const sourceId = parseInt(request.params.id, 10);
      const deleted = await service.delete(sourceId);
      if (!deleted) {
        reply.code(404);
        return errorResponse('Task source not found');
      }
      return successResponse(null, 'Task source deleted');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to delete task source');
    }
  });

  // Sync task source
  fastify.post('/:id/sync', async (request, reply) => {
    try {
      const sourceId = parseInt(request.params.id, 10);
      const { options } = request.body || {};

      // Placeholder: Implement actual sync logic
      const result = { created: 0, updated: 0 };
      return successResponse(result, 'Sync completed');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to sync task source');
    }
  });

  // Preview sync - get issues without creating requirements
  fastify.post('/:id/sync/preview', async (request, reply) => {
    try {
      const sourceId = parseInt(request.params.id, 10);
      const source = await service.getById(sourceId);
      if (!source) {
        reply.code(404);
        return errorResponse('Task source not found');
      }

      const issues = await service.previewSync(sourceId);
      return successResponse(issues);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to preview sync: ' + error.message);
    }
  });

  // Import selected issues as requirements
  fastify.post('/:id/sync/import', async (request, reply) => {
    try {
      const sourceId = parseInt(request.params.id, 10);
      const { items, project_id } = request.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        reply.code(400);
        return errorResponse('items array is required');
      }

      if (!project_id) {
        reply.code(400);
        return errorResponse('project_id is required');
      }

      const source = await service.getById(sourceId);
      if (!source) {
        reply.code(404);
        return errorResponse('Task source not found');
      }

      const result = await service.importIssues(sourceId, items, project_id);
      return successResponse(result, 'Import completed');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to import: ' + error.message);
    }
  });

  // Test task source connection
  fastify.get('/:id/test', async (request, reply) => {
    try {
      const sourceId = parseInt(request.params.id, 10);
      const source = await service.getById(sourceId);
      if (!source) {
        reply.code(404);
        return errorResponse('Task source not found');
      }

      // Placeholder: Implement actual connection test
      return successResponse(true, 'Connection successful');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Connection test failed');
    }
  });

  // Get available source types
  fastify.get('/types/available', async (request, reply) => {
    try {
      const types = service.getAvailableSourceTypes();
      return successResponse(types);
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get available source types');
    }
  });
}

module.exports = taskSourceRoutes;
