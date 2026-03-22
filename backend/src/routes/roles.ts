import type { FastifyPluginAsync } from 'fastify';

import { BaseRepository } from '../repositories/base.js';
import { successResponse, errorResponse } from '../utils/response.js';

type ParamsWithId = { id: string };
type StoredBaseRecord = Record<string, unknown> & { id: number; created_at: string; updated_at: string };

const roleRepo = new BaseRepository<StoredBaseRecord>('roles.json');

function parseNumber(value: string) {
  return Number.parseInt(value, 10);
}

export const roleRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request) => {
    try {
      return successResponse(await roleRepo.findAll());
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get roles');
    }
  });

  fastify.get<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const role = await roleRepo.findById(parseNumber(request.params.id));
      if (!role) {
        reply.code(404);
        return errorResponse('Role not found');
      }
      return successResponse(role);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get role');
    }
  });

  fastify.post('/', async (request, reply) => {
    try {
      const role = await roleRepo.create(request.body as Record<string, unknown>);
      return successResponse(role, 'Role created');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to create role');
    }
  });

  fastify.put<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const updated = await roleRepo.update(parseNumber(request.params.id), request.body as Record<string, unknown>);
      if (!updated) {
        reply.code(404);
        return errorResponse('Role not found');
      }
      return successResponse(updated, 'Role updated');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to update role');
    }
  });

  fastify.delete<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const deleted = await roleRepo.delete(parseNumber(request.params.id));
      if (!deleted) {
        reply.code(404);
        return errorResponse('Role not found');
      }
      return successResponse(null, 'Role deleted');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to delete role');
    }
  });
};
