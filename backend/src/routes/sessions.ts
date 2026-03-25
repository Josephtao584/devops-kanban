import type { FastifyPluginAsync } from 'fastify';

import { SessionService } from '../services/sessionService.js';
import type { ListSessionEventsQuery } from '../types/dto/sessionEvents.ts';
import type { ContinueSessionBody, CreateSessionInput } from '../types/dto/sessions.js';
import type { IdParams, TaskIdParams } from '../types/http/params.js';
import type { SessionFiltersQuery } from '../types/http/query.js';
import type { BroadcastPayload, SessionChannel, WebSocketPayload } from '../types/ws/sessions.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { getErrorMessage, getStatusCode, parseNumber } from '../utils/http.js';

type SessionSubscriber = {
  readyState: number;
  send(message: string): void;
  on(event: 'message', handler: (message: Buffer | string) => void | Promise<void>): void;
  on(event: 'close', handler: () => void): void;
};
type SessionStartResult = Awaited<ReturnType<SessionService['start']>>;
type SessionContinueResult = Awaited<ReturnType<SessionService['continue']>>;
type SessionSubscriptions = Record<SessionChannel, SessionSubscriber[]>;
type SessionRouteOptions = { service?: SessionService };

const sessionService = new SessionService();
const sessionSubscriptions = new Map<number, SessionSubscriptions>();

function broadcastToSession(sessionId: number, channel: SessionChannel, data: BroadcastPayload) {
  const subscriptions = sessionSubscriptions.get(sessionId);
  if (!subscriptions) {
    return;
  }

  const subscribers = subscriptions[channel];
  const message = JSON.stringify({
    sessionId,
    channel,
    ...data,
  });

  const disconnected: SessionSubscriber[] = [];
  for (const subscriber of subscribers) {
    if (subscriber.readyState === 1) {
      subscriber.send(message);
    } else {
      disconnected.push(subscriber);
    }
  }

  for (const subscriber of disconnected) {
    const index = subscribers.indexOf(subscriber);
    if (index >= 0) {
      subscribers.splice(index, 1);
    }
  }
}

function getSessionSubscriptions(sessionId: number) {
  let subscriptions = sessionSubscriptions.get(sessionId);
  if (!subscriptions) {
    subscriptions = { output: [], status: [] };
    sessionSubscriptions.set(sessionId, subscriptions);
  }
  return subscriptions;
}

function resolveSessionLifecycleResponse(
  reply: { code(statusCode: number): void },
  session: SessionStartResult | SessionContinueResult,
  successMessage: string,
) {
  if (!session) {
    reply.code(409);
    return errorResponse('Session worktree is unavailable');
  }

  return successResponse(session, successMessage);
}

const sessionRoutes: FastifyPluginAsync<SessionRouteOptions> = async (fastify, { service = sessionService } = {}) => {
  fastify.get<{ Querystring: SessionFiltersQuery }>('/sessions', async (request) => {
    try {
      const { taskId, activeOnly } = request.query;
      const filters: { taskId?: number; activeOnly?: boolean } = {};
      if (taskId) {
        filters.taskId = parseNumber(taskId);
      }
      if (activeOnly) {
        filters.activeOnly = activeOnly === 'true';
      }

      return successResponse(await service.getAll(filters));
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get sessions');
    }
  });

  fastify.get<{ Params: TaskIdParams }>('/sessions/task/:taskId/active', async (request) => {
    try {
      return successResponse(await service.getActiveByTask(parseNumber(request.params.taskId)));
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get active session');
    }
  });

  fastify.get<{ Params: TaskIdParams; Querystring: { includeOutput?: string } }>('/sessions/task/:taskId/history', async (request, reply) => {
    try {
      const taskId = parseNumber(request.params.taskId);
      const includeOutput = request.query.includeOutput !== 'false';
      const sessions = await service.getHistoryByTask(taskId, includeOutput);
      return successResponse(sessions);
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get session history');
    }
  });

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

  fastify.post<{ Body: CreateSessionInput }>('/sessions', async (request, reply) => {
    try {
      const session = await service.create(request.body || { task_id: 0 });
      return successResponse(session, 'Session created');
    } catch (error) {
      request.log.error(error);
      const statusCode = getStatusCode(error);
      reply.code(statusCode);
      return errorResponse(statusCode === 404 ? getErrorMessage(error, 'Session create failed') : 'Failed to create session');
    }
  });

  fastify.post<{ Params: IdParams }>('/sessions/:id/start', async (request, reply) => {
    try {
      const session = await service.start(parseNumber(request.params.id), broadcastToSession);
      return resolveSessionLifecycleResponse(reply, session, 'Session started');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to start session'));
    }
  });

  fastify.post<{ Params: IdParams }>('/sessions/:id/stop', async (request, reply) => {
    try {
      const session = await service.stop(parseNumber(request.params.id), broadcastToSession);
      return successResponse(session, 'Session stopped');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to stop session'));
    }
  });

  fastify.post<{ Params: IdParams; Body: ContinueSessionBody }>('/sessions/:id/continue', async (request, reply) => {
    try {
      const session = await service.continue(parseNumber(request.params.id), request.body.input || '', broadcastToSession);
      return resolveSessionLifecycleResponse(reply, session, 'Session continued');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to continue session'));
    }
  });

  fastify.post<{ Params: IdParams; Body: ContinueSessionBody }>('/sessions/:id/input', async (request, reply) => {
    try {
      const inputSent = await service.sendInput(parseNumber(request.params.id), request.body.input || '');
      if (!inputSent) {
        reply.code(409);
        return errorResponse('Session input stream is unavailable');
      }
      return successResponse(null, 'Input sent');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to send input'));
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

  fastify.delete<{ Params: IdParams }>('/sessions/:id', async (request, reply) => {
    try {
      await service.delete(parseNumber(request.params.id), broadcastToSession);
      return successResponse(null, 'Session deleted');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to delete session'));
    }
  });

  fastify.get('/ws', { websocket: true }, (connection) => {
    const ws = connection.socket as SessionSubscriber;

    ws.on('message', async (message) => {
      try {
        const payload = JSON.parse(message.toString()) as WebSocketPayload;
        const { type, destination, session_id, channel, input, body } = payload;

        if (destination?.startsWith('/topic/session/')) {
          const parts = destination.split('/');
          if (parts.length >= 5) {
            const sessionId = parseNumber(parts[3] ?? '');
            const sessionChannel = parts[4];
            if (sessionChannel && (sessionChannel === 'output' || sessionChannel === 'status')) {
              getSessionSubscriptions(sessionId)[sessionChannel].push(ws);
              ws.send(JSON.stringify({ type: 'SUBSCRIBED', destination }));
            }
          }
        }

        if (destination?.startsWith('/app/session/')) {
          const parts = destination.split('/');
          if (parts.length >= 5) {
            const sessionId = parseNumber(parts[3] ?? '');
            const inputText = typeof body === 'string' ? ((JSON.parse(body) as { input?: string }).input) : body?.input;
            if (inputText) {
              const inputSent = await service.sendInput(sessionId, inputText);
              if (inputSent) {
                broadcastToSession(sessionId, 'output', {
                  type: 'chunk',
                  content: inputText,
                  stream: 'stdin',
                  timestamp: new Date().toISOString(),
                });
              }
            }
          }
        }

        if (type === 'subscribe' && session_id) {
          const sessionChannel = channel || 'output';
          getSessionSubscriptions(session_id)[sessionChannel].push(ws);
          ws.send(JSON.stringify({ type: 'subscribed', session_id, channel: sessionChannel }));
        }

        if (type === 'input' && session_id && input) {
          await service.sendInput(session_id, input);
        }
      } catch {
        // Ignore invalid JSON payloads.
      }
    });

    ws.on('close', () => {
      for (const [sessionId, channels] of sessionSubscriptions.entries()) {
        for (const sessionChannel of Object.keys(channels) as SessionChannel[]) {
          const subscribers = channels[sessionChannel];
          const index = subscribers.indexOf(ws);
          if (index >= 0) {
            subscribers.splice(index, 1);
          }
        }
        if (channels.output.length === 0 && channels.status.length === 0) {
          sessionSubscriptions.delete(sessionId);
        }
      }
    });
  });
};

export { sessionRoutes };
