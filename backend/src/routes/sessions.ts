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

  // GET /sessions/list/:taskId - List sessions for a task
  fastify.get<{ Params: { taskId: string } }>('/sessions/list/:taskId', async (request, reply) => {
    try {
      const sessions = await service.listByTask(parseNumber(request.params.taskId));
      return successResponse(sessions);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get sessions');
    }
  });

  // GET /sessions/active/:taskId - Get active session for a task
  fastify.get<{ Params: { taskId: string } }>('/sessions/active/:taskId', async (request, reply) => {
    try {
      const session = await service.getActiveByTask(parseNumber(request.params.taskId));
      if (!session) {
        reply.code(404);
        return errorResponse('No active session found');
      }
      return successResponse(session);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get active session');
    }
  });

  // GET /sessions/history/:taskId - Get session history for a task
  fastify.get<{ Params: { taskId: string } }>('/sessions/history/:taskId', async (request, reply) => {
    try {
      const sessions = await service.listByTask(parseNumber(request.params.taskId));
      return successResponse(sessions);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get session history');
    }
  });

  // POST /sessions - Create a new session
  fastify.post('/sessions', async (request, reply) => {
    try {
      const { task_id, agent_id } = request.body as { task_id?: number; agent_id?: number };
      if (!task_id) {
        reply.code(400);
        return errorResponse('task_id is required');
      }
      // Sessions are created by workflow system when task starts
      reply.code(501);
      return errorResponse('Sessions are created by the Workflow system when a task starts. Use the workflow to create and manage sessions.');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to create session');
    }
  });

  // GET /sessions/:id - Get session by ID
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

  // GET /sessions/:id/output - Get session output
  fastify.get<{ Params: IdParams }>('/sessions/:id/output', async (request, reply) => {
    try {
      const session = await service.getById(parseNumber(request.params.id));
      if (!session) {
        reply.code(404);
        return errorResponse('Session not found');
      }
      return successResponse({
        id: session.id,
        status: session.status,
        started_at: session.started_at,
        completed_at: session.completed_at,
        output: 'Session output is streamed via WebSocket'
      });
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get session output');
    }
  });

  // POST /sessions/:id/start - Start a session
  fastify.post<{ Params: IdParams }>('/sessions/:id/start', async (request, reply) => {
    try {
      const session = await service.getById(parseNumber(request.params.id));
      if (!session) {
        reply.code(404);
        return errorResponse('Session not found');
      }
      reply.code(501);
      return errorResponse('Sessions are started by the Workflow system. Use the workflow to manage session lifecycle.');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to start session');
    }
  });

  // POST /sessions/:id/stop - Stop a session
  fastify.post<{ Params: IdParams }>('/sessions/:id/stop', async (request, reply) => {
    try {
      const session = await service.getById(parseNumber(request.params.id));
      if (!session) {
        reply.code(404);
        return errorResponse('Session not found');
      }
      const updated = await service.updateSessionStatus(parseNumber(request.params.id), 'STOPPED');
      return successResponse(updated, 'Session stopped');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to stop session');
    }
  });

  // DELETE /sessions/:id - Delete a session
  fastify.delete<{ Params: IdParams }>('/sessions/:id', async (request, reply) => {
    try {
      const deleted = await service.delete(parseNumber(request.params.id));
      if (!deleted) {
        reply.code(404);
        return errorResponse('Session not found');
      }
      return successResponse(null, 'Session deleted');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to delete session');
    }
  });

  // POST /sessions/:id/input - Send input to a session
  fastify.post<{ Params: IdParams }>('/sessions/:id/input', async (request, reply) => {
    try {
      const { input } = request.body as { input?: string };
      if (!input) {
        reply.code(400);
        return errorResponse('input is required');
      }
      const session = await service.getById(parseNumber(request.params.id));
      if (!session) {
        reply.code(404);
        return errorResponse('Session not found');
      }
      reply.code(501);
      return errorResponse('Session input should be sent via WebSocket connection');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to send session input');
    }
  });

  // POST /sessions/:id/continue - Continue a stopped session
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

  // GET /sessions/:id/events - Get session events
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
