import type { FastifyPluginAsync } from 'fastify';

import { SessionService } from '../services/sessionService.js';
import type { ListSessionEventsQuery } from '../types/dto/sessionEvents.ts';
import type { ContinueSessionBody } from '../types/dto/sessions.js';
import type { IdParams } from '../types/http/params.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { getErrorMessage, getStatusCode, parseNumber } from '../utils/http.js';

type SessionContinueResult = Awaited<ReturnType<SessionService['continue']>>;
type SessionRouteOptions = { service?: SessionService };

const sessionService = new SessionService();

function resolveSessionLifecycleResponse(
  reply: { code(statusCode: number): void },
  session: SessionContinueResult,
  successMessage: string,
) {
  if (!session) {
    reply.code(409);
    return errorResponse('Session worktree is unavailable');
  }

  return successResponse(session, successMessage);
}

const sessionRoutes: FastifyPluginAsync<SessionRouteOptions> = async (fastify, { service = sessionService } = {}) => {

  fastify.get<{ Params: IdParams }>('/sessions/:id', async (request, reply) => {
    try {
      const session = await service.getById(parseNumber(request.params.id));
      if (!session) {
        reply.code(404);
        return errorResponse('Session not found');
      }
      return successResponse(session);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get session');
    }
  });

  fastify.post<{ Params: IdParams; Body: ContinueSessionBody }>('/sessions/:id/continue', async (request, reply) => {
    try {
      const session = await service.continue(parseNumber(request.params.id), request.body.input);
      return resolveSessionLifecycleResponse(reply, session, 'Session continued');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to continue session'));
    }
  });

  fastify.get<{ Params: IdParams; Querystring: ListSessionEventsQuery }>('/sessions/:id/events', async (request, reply) => {
    try {
      const afterSeq = request.query.after_seq ? parseNumber(request.query.after_seq) : undefined;
      const limit = request.query.limit ? parseNumber(request.query.limit) : undefined;
      const events = await service.listEvents(parseNumber(request.params.id), {
        ...(afterSeq !== undefined ? { afterSeq } : {}),
        ...(limit !== undefined ? { limit } : {}),
      });
      return successResponse(events);
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get session events'));
    }
  });
};

export { sessionRoutes };
