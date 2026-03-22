import type { FastifyPluginAsync } from 'fastify';

import { BaseRepository } from '../repositories/base.js';
import { successResponse, errorResponse } from '../utils/response.js';

type ParamsWithId = { id: string };
type StoredBaseRecord = Record<string, unknown> & { id: number; created_at: string; updated_at: string };

const memberRepo = new BaseRepository<StoredBaseRecord>('members.json');

function parseNumber(value: string) {
  return Number.parseInt(value, 10);
}

export const memberRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request) => {
    try {
      return successResponse(await memberRepo.findAll());
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get members');
    }
  });

  fastify.get<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const member = await memberRepo.findById(parseNumber(request.params.id));
      if (!member) {
        reply.code(404);
        return errorResponse('Member not found');
      }
      return successResponse(member);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get member');
    }
  });

  fastify.post('/', async (request, reply) => {
    try {
      const member = await memberRepo.create(request.body as Record<string, unknown>);
      return successResponse(member, 'Member created');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to create member');
    }
  });

  fastify.put<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const updated = await memberRepo.update(parseNumber(request.params.id), request.body as Record<string, unknown>);
      if (!updated) {
        reply.code(404);
        return errorResponse('Member not found');
      }
      return successResponse(updated, 'Member updated');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to update member');
    }
  });

  fastify.delete<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const deleted = await memberRepo.delete(parseNumber(request.params.id));
      if (!deleted) {
        reply.code(404);
        return errorResponse('Member not found');
      }
      return successResponse(null, 'Member deleted');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to delete member');
    }
  });
};
