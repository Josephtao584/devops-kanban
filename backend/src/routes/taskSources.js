/**
 * Task Source Routes
 */
import { TaskSourceService } from '../services/taskSourceService.js';

const service = new TaskSourceService();

function getService(fastify) {
  return fastify.taskSourceService || service;
}

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

function getSourceId(params) {
  return params.id;
}

function handleServiceError(reply, error, fallbackMessage) {
  const statusCode = error.statusCode || 500;
  reply.code(statusCode);
  return errorResponse(statusCode === 500 ? fallbackMessage : error.message);
}

/**
 * Register task source routes
 */
async function taskSourceRoutes(fastify) {
  // GET / - Get all task sources for a project
  fastify.get('/', async (request, reply) => {
    try {
      const currentService = getService(fastify);
      const { project_id } = request.query;
      if (!project_id) {
        reply.code(400);
        return errorResponse('project_id query parameter is required');
      }

      const sources = await currentService.getByProject(parseInt(project_id, 10));
      return successResponse(sources);
    } catch (error) {
      request.log.error(error);
      return handleServiceError(reply, error, 'Failed to get task sources');
    }
  });

  // GET /types/available - Get available adapter types
  fastify.get('/types/available', async (request, reply) => {
    try {
      const currentService = getService(fastify);
      const types = await currentService.getAvailableAdapterTypes();
      return successResponse(types);
    } catch (error) {
      request.log.error(error);
      return handleServiceError(reply, error, 'Failed to get available source types');
    }
  });

  // GET /:id - Get task source by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const currentService = getService(fastify);
      const sourceId = getSourceId(request.params);
      const source = await currentService.getById(sourceId);
      if (!source) {
        reply.code(404);
        return errorResponse('Task source not found');
      }
      return successResponse(source);
    } catch (error) {
      request.log.error(error);
      return handleServiceError(reply, error, 'Failed to get task source');
    }
  });

  // POST / - Create a new task source
  fastify.post('/', async (request, reply) => {
    try {
      const currentService = getService(fastify);
      const source = await currentService.create(request.body);
      return successResponse(source, 'Task source created successfully');
    } catch (error) {
      request.log.error(error);
      return handleServiceError(reply, error, 'Failed to create task source');
    }
  });

  // PUT /:id - Update a task source
  fastify.put('/:id', async (request, reply) => {
    try {
      const currentService = getService(fastify);
      const sourceId = getSourceId(request.params);
      const source = await currentService.update(sourceId, request.body);
      if (!source) {
        reply.code(404);
        return errorResponse('Task source not found');
      }
      return successResponse(source, 'Task source updated successfully');
    } catch (error) {
      request.log.error(error);
      return handleServiceError(reply, error, 'Failed to update task source');
    }
  });

  // DELETE /:id - Delete a task source
  fastify.delete('/:id', async (request, reply) => {
    try {
      const currentService = getService(fastify);
      const sourceId = getSourceId(request.params);
      const deleted = await currentService.delete(sourceId);
      if (!deleted) {
        reply.code(404);
        return errorResponse('Task source not found');
      }
      return successResponse(null, 'Task source deleted successfully');
    } catch (error) {
      request.log.error(error);
      return handleServiceError(reply, error, 'Failed to delete task source');
    }
  });

  // POST /:id/sync - Sync task source
  fastify.post('/:id/sync', async (request, reply) => {
    try {
      const currentService = getService(fastify);
      const sourceId = getSourceId(request.params);
      const tasks = await currentService.sync(sourceId);
      return successResponse(tasks, 'Task source synced successfully');
    } catch (error) {
      request.log.error(error);
      return handleServiceError(reply, error, 'Failed to sync task source');
    }
  });

  // POST /:id/sync/preview - Preview sync issues
  fastify.post('/:id/sync/preview', async (request, reply) => {
    try {
      const currentService = getService(fastify);
      const sourceId = getSourceId(request.params);
      const issues = await currentService.previewSync(sourceId);
      return successResponse(issues);
    } catch (error) {
      request.log.error(error);
      return handleServiceError(reply, error, 'Failed to preview sync: ' + error.message);
    }
  });

  // POST /:id/sync/import - Import selected issues
  fastify.post('/:id/sync/import', async (request, reply) => {
    try {
      const currentService = getService(fastify);
      const sourceId = getSourceId(request.params);
      const { items, project_id, iteration_id } = request.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        reply.code(400);
        return errorResponse('items array is required');
      }

      if (!project_id) {
        reply.code(400);
        return errorResponse('project_id is required');
      }

      const result = await currentService.importIssues(sourceId, items, project_id, iteration_id);
      return successResponse(result, 'Import completed');
    } catch (error) {
      request.log.error(error);
      return handleServiceError(reply, error, 'Failed to import: ' + error.message);
    }
  });

  // GET /:id/test - Test task source connection
  fastify.get('/:id/test', async (request, reply) => {
    try {
      const currentService = getService(fastify);
      const sourceId = getSourceId(request.params);
      const result = await currentService.testConnection(sourceId);
      return successResponse({ connected: result });
    } catch (error) {
      request.log.error(error);
      return handleServiceError(reply, error, 'Failed to test task source connection');
    }
  });
}

export default taskSourceRoutes;
