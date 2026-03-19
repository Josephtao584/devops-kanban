/**
 * Project Routes
 */
import { ProjectService } from '../services/projectService.js';
import { TaskService } from '../services/taskService.js';

const service = new ProjectService();

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
 * Register project routes
 */
async function projectRoutes(fastify) {
  // Get all projects
  fastify.get('/', async (request, reply) => {
    try {
      const projects = await service.getAll();
      return successResponse(projects.map((p) => p));
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get projects');
    }
  });

  // Get project by ID with stats
  fastify.get('/:id', async (request, reply) => {
    try {
      const projectId = parseInt(request.params.id, 10);
      const project = await service.getWithStats(projectId);
      if (!project) {
        reply.code(404);
        return errorResponse('Project not found');
      }
      return successResponse(project);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get project');
    }
  });

  // Create project
  fastify.post('/', async (request, reply) => {
    try {
      const project = await service.create(request.body);
      return successResponse(project, 'Project created successfully');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to create project');
    }
  });

  // Update project
  fastify.put('/:id', async (request, reply) => {
    try {
      const projectId = parseInt(request.params.id, 10);
      const updated = await service.update(projectId, request.body);
      if (!updated) {
        reply.code(404);
        return errorResponse('Project not found');
      }
      return successResponse(updated, 'Project updated successfully');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to update project');
    }
  });

  // Delete project
  fastify.delete('/:id', async (request, reply) => {
    try {
      const projectId = parseInt(request.params.id, 10);
      const deleted = await service.delete(projectId);
      if (!deleted) {
        reply.code(404);
        return errorResponse('Project not found');
      }
      return successResponse(null, 'Project deleted successfully');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to delete project');
    }
  });

  // Get project tasks
  fastify.get('/:id/tasks', async (request, reply) => {
    try {
      const projectId = parseInt(request.params.id, 10);
      if (!(await service.exists(projectId))) {
        reply.code(404);
        return errorResponse('Project not found');
      }

      const taskService = new TaskService();
      const tasks = await taskService.getByProject(projectId);
      return successResponse(tasks);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get project tasks');
    }
  });

  // Get project tasks grouped by status
  fastify.get('/:id/tasks/grouped', async (request, reply) => {
    try {
      const projectId = parseInt(request.params.id, 10);
      if (!(await service.exists(projectId))) {
        reply.code(404);
        return errorResponse('Project not found');
      }

      const taskService = new TaskService();
      const grouped = await taskService.getByProjectGrouped(projectId);
      return successResponse(grouped);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get grouped tasks');
    }
  });
}

export default projectRoutes;
