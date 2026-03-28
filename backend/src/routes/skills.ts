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

  fastify.get<{ Params: IdParams }>('/:id/files', async (request, reply) => {
    try {
      const skill = await skillService.getSkill(parseNumber(request.params.id));
      if (!skill) {
        reply.code(404);
        return errorResponse('Skill not found');
      }
      const files = await skillService.listSkillFiles(skill.name);
      return successResponse(files);
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to list skill files'));
    }
  });

  fastify.get<{ Params: IdParams & { '*': string } }>('/:id/files/*', async (request, reply) => {
    try {
      const skill = await skillService.getSkill(parseNumber(request.params.id));
      if (!skill) {
        reply.code(404);
        return errorResponse('Skill not found');
      }
      const filePath = request.params['*'];
      const content = await skillService.readSkillFile(skill.name, filePath);
      return successResponse({ path: filePath, content });
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to read skill file'));
    }
  });

  fastify.put<{ Params: IdParams & { '*': string }; Body: { content: string } }>('/:id/files/*', async (request, reply) => {
    try {
      const skill = await skillService.getSkill(parseNumber(request.params.id));
      if (!skill) {
        reply.code(404);
        return errorResponse('Skill not found');
      }
      const filePath = request.params['*'];
      const { content } = request.body;
      if (typeof content !== 'string') {
        reply.code(400);
        return errorResponse('content is required');
      }
      await skillService.writeSkillFile(skill.name, filePath, content);
      return successResponse(null, 'File updated');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to write skill file'));
    }
  });

  fastify.post<{ Params: IdParams; Body: { zip: string } }>('/:id/upload-zip', async (request, reply) => {
    try {
      const skill = await skillService.getSkill(parseNumber(request.params.id));
      if (!skill) {
        reply.code(404);
        return errorResponse('Skill not found');
      }
      const { zip } = request.body;
      if (!zip || typeof zip !== 'string') {
        reply.code(400);
        return errorResponse('zip base64 data is required');
      }
      const zipBuffer = Buffer.from(zip, 'base64');
      await skillService.uploadSkillZip(skill.name, zipBuffer);
      return successResponse(null, 'Zip uploaded and extracted');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to upload zip'));
    }
  });
};