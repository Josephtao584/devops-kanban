import type { FastifyPluginAsync } from 'fastify';
import { TeamService } from '../services/teamService.js';
import type { CreateTeamInput, UpdateTeamInput, AddProjectToTeamInput } from '../types/dto/teams.js';
import type { IdParams } from '../types/http/params.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { parseNumber, getStatusCode, getErrorMessage, logError } from '../utils/http.js';

const teamService = new TeamService();

export const teamRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request) => {
    try {
      const teams = await teamService.getAll();
      return successResponse(teams);
    } catch (error) {
      logError(error, request);
      return errorResponse('Failed to get teams');
    }
  });

  fastify.get<{ Params: IdParams }>('/:id', async (request, reply) => {
    try {
      const teamId = parseNumber(request.params.id);
      const team = await teamService.getWithProjects(teamId);
      if (!team) {
        reply.code(404);
        return errorResponse('Team not found');
      }
      return successResponse(team);
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get team'));
    }
  });

  fastify.post('/', async (request) => {
    try {
      const team = await teamService.create(request.body as CreateTeamInput);
      return successResponse(team, 'Team created successfully');
    } catch (error) {
      logError(error, request);
      return errorResponse('Failed to create team');
    }
  });

  fastify.put<{ Params: IdParams }>('/:id', async (request, reply) => {
    try {
      const teamId = parseNumber(request.params.id);
      const updated = await teamService.update(teamId, request.body as UpdateTeamInput);
      if (!updated) {
        reply.code(404);
        return errorResponse('Team not found');
      }
      return successResponse(updated, 'Team updated successfully');
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to update team'));
    }
  });

  fastify.delete<{ Params: IdParams }>('/:id', async (request, reply) => {
    try {
      const teamId = parseNumber(request.params.id);
      const deleted = await teamService.delete(teamId);
      if (!deleted) {
        reply.code(404);
        return errorResponse('Team not found');
      }
      return successResponse(null, 'Team deleted successfully');
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to delete team'));
    }
  });

  fastify.post<{ Params: IdParams; Body: AddProjectToTeamInput }>('/:id/projects', async (request, reply) => {
    try {
      const teamId = parseNumber(request.params.id);
      const project = await teamService.addProjectToTeam(teamId, request.body as AddProjectToTeamInput);
      return successResponse(project, 'Project added to team successfully');
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to add project to team'));
    }
  });

  fastify.delete<{ Params: IdParams & { projectId: string } }>('/:id/projects/:projectId', async (request, reply) => {
    try {
      const teamId = parseNumber(request.params.id);
      const projectId = parseNumber(request.params.projectId);
      const updated = await teamService.removeProjectFromTeam(teamId, projectId);
      if (!updated) {
        reply.code(404);
        return errorResponse('Project not found');
      }
      return successResponse(updated, 'Project removed from team successfully');
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to remove project from team'));
    }
  });

  fastify.get<{ Params: IdParams }>('/:id/tasks/grouped', async (request, reply) => {
    try {
      const teamId = parseNumber(request.params.id);
      const grouped = await teamService.getTeamTasksGrouped(teamId);
      return successResponse(grouped);
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get grouped tasks'));
    }
  });
};
