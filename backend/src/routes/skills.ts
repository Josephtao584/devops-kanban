import type { FastifyPluginAsync } from 'fastify';
import { SkillService } from '../services/skillService.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { parseNumber, getErrorMessage, getStatusCode } from '../utils/http.js';
import type { IdParams } from '../types/http/params.js';

type SkillRouteOptions = {
  skillService?: SkillService;
};

export const skillRoutes: FastifyPluginAsync<SkillRouteOptions> = async (fastify, { skillService = new SkillService() } = {}) => {
  fastify.get('/', async (request, reply) => {
    try {
      return successResponse(await skillService.listSkills());
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get skills'));
    }
  });

  fastify.get<{ Params: IdParams }>('/:id', async (request, reply) => {
    try {
      const skill = await skillService.getSkill(parseNumber(request.params.id));
      if (!skill) {
        reply.code(404);
        return errorResponse('Skill not found');
      }
      return successResponse(skill);
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get skill'));
    }
  });

  fastify.post<{ Body: { name: string; description?: string } }>('/', async (request, reply) => {
    try {
      const { name, description } = request.body;

      if (!name || typeof name !== 'string' || name.trim() === '') {
        reply.code(400);
        return errorResponse('name is required');
      }

      const skill = await skillService.createSkill(name.trim(), description);
      return successResponse(skill, 'Skill created');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to create skill'));
    }
  });

  fastify.put<{ Params: IdParams; Body: { description?: string } }>('/:id', async (request, reply) => {
    try {
      const { description } = request.body;
      const updated = await skillService.updateSkill(parseNumber(request.params.id), description);
      if (!updated) {
        reply.code(404);
        return errorResponse('Skill not found');
      }
      return successResponse(updated, 'Skill updated');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to update skill'));
    }
  });

  fastify.delete<{ Params: IdParams }>('/:id', async (request, reply) => {
    try {
      const deleted = await skillService.deleteSkill(parseNumber(request.params.id));
      if (!deleted) {
        reply.code(404);
        return errorResponse('Skill not found');
      }
      return successResponse(null, 'Skill deleted');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to delete skill'));
    }
  });
};