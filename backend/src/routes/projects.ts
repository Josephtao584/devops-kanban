import type { FastifyPluginAsync } from 'fastify';

import { ProjectService } from '../services/projectService.js';
import { TaskService } from '../services/taskService.js';
import { successResponse, errorResponse } from '../utils/response.js';

type ParamsWithId = { id: string };

const projectService = new ProjectService();
const taskService = new TaskService();

function parseNumber(value: string) {
  return Number.parseInt(value, 10);
}

export const projectRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request) => {
    try {
      const projects = await projectService.getAll();
      return successResponse(projects.map((project) => project));
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get projects');
    }
  });

  fastify.get<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const projectId = parseNumber(request.params.id);
      const project = await projectService.getWithStats(projectId);
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

  fastify.post('/', async (request) => {
    try {
      const project = await projectService.create(request.body as Record<string, unknown>);
      return successResponse(project, 'Project created successfully');
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to create project');
    }
  });

  fastify.put<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const projectId = parseNumber(request.params.id);
      const updated = await projectService.update(projectId, request.body as Record<string, unknown>);
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

  fastify.delete<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const projectId = parseNumber(request.params.id);
      const deleted = await projectService.delete(projectId);
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

  fastify.get<{ Params: ParamsWithId }>('/:id/tasks', async (request, reply) => {
    try {
      const projectId = parseNumber(request.params.id);
      if (!(await projectService.exists(projectId))) {
        reply.code(404);
        return errorResponse('Project not found');
      }

      const tasks = await taskService.getByProject(projectId);
      return successResponse(tasks);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get project tasks');
    }
  });

  fastify.get<{ Params: ParamsWithId }>('/:id/tasks/grouped', async (request, reply) => {
    try {
      const projectId = parseNumber(request.params.id);
      if (!(await projectService.exists(projectId))) {
        reply.code(404);
        return errorResponse('Project not found');
      }

      const grouped = await taskService.getByProjectGrouped(projectId);
      return successResponse(grouped);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get grouped tasks');
    }
  });
};
