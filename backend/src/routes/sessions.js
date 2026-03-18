/**
 * Session Routes with WebSocket support
 */
const { SessionService } = require('../services/sessionService');
const { createWorktree, cleanupWorktree } = require('../utils/git');
const { TaskService } = require('../services/taskService');
const { SessionRepository } = require('../repositories/sessionRepository');

const service = new SessionService();
const sessionRepo = new SessionRepository();
const taskService = new TaskService();

// Store WebSocket subscribers
const sessionSubscriptions = new Map(); // sessionId -> { output: [], status: [] }

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
 * Broadcast message to session subscribers
 */
function broadcastToSession(sessionId, channel, data) {
  if (!sessionSubscriptions.has(sessionId)) return;

  const subscribers = sessionSubscriptions.get(sessionId)[channel];
  if (!subscribers) return;

  const message = JSON.stringify({
    sessionId,
    channel,
    ...data,
  });

  const disconnected = [];
  for (const ws of subscribers) {
    if (ws.readyState === 1) {
      // WebSocket.OPEN
      ws.send(message);
    } else {
      disconnected.push(ws);
    }
  }

  // Clean up disconnected clients
  for (const ws of disconnected) {
    const idx = subscribers.indexOf(ws);
    if (idx > -1) subscribers.splice(idx, 1);
  }
}

/**
 * Register session routes
 */
async function sessionRoutes(fastify) {
  // Get all sessions
  fastify.get('/sessions', async (request, reply) => {
    try {
      const { taskId, activeOnly } = request.query;
      const filters = {};
      if (taskId) filters.taskId = parseInt(taskId, 10);
      if (activeOnly) filters.activeOnly = activeOnly === 'true';

      const sessions = await service.getAll(filters);
      return successResponse(sessions);
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get sessions');
    }
  });

  // Get active session for a task
  fastify.get('/sessions/task/:taskId/active', async (request, reply) => {
    try {
      const taskId = parseInt(request.params.taskId, 10);
      const session = await service.getActiveByTask(taskId);
      return successResponse(session);
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get active session');
    }
  });

  // Get session by ID
  fastify.get('/sessions/:id', async (request, reply) => {
    try {
      const sessionId = parseInt(request.params.id, 10);
      const session = await service.getById(sessionId);
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

  // Create session
  fastify.post('/sessions', async (request, reply) => {
    try {
      const session = await service.create(request.body);
      return successResponse(session, 'Session created');
    } catch (error) {
      request.log.error(error);
      if (error.statusCode === 404) {
        reply.code(404);
        return errorResponse(error.message);
      }
      reply.code(500);
      return errorResponse('Failed to create session');
    }
  });

  // Start session
  fastify.post('/sessions/:id/start', async (request, reply) => {
    try {
      const sessionId = parseInt(request.params.id, 10);
      const broadcastFn = (sid, channel, data) => broadcastToSession(sid, channel, data);
      const session = await service.start(sessionId, broadcastFn);
      return successResponse(session, 'Session started');
    } catch (error) {
      request.log.error(error);
      if (error.statusCode) {
        reply.code(error.statusCode);
      } else {
        reply.code(500);
      }
      return errorResponse(error.message);
    }
  });

  // Stop session
  fastify.post('/sessions/:id/stop', async (request, reply) => {
    try {
      const sessionId = parseInt(request.params.id, 10);
      const broadcastFn = (sid, channel, data) => broadcastToSession(sid, channel, data);
      const session = await service.stop(sessionId, broadcastFn);
      return successResponse(session, 'Session stopped');
    } catch (error) {
      request.log.error(error);
      if (error.statusCode) {
        reply.code(error.statusCode);
      } else {
        reply.code(500);
      }
      return errorResponse(error.message);
    }
  });

  // Continue session
  fastify.post('/sessions/:id/continue', async (request, reply) => {
    try {
      const sessionId = parseInt(request.params.id, 10);
      const { input } = request.body;
      const broadcastFn = (sid, channel, data) => broadcastToSession(sid, channel, data);
      const session = await service.continue(sessionId, input, broadcastFn);
      return successResponse(session, 'Session continued');
    } catch (error) {
      request.log.error(error);
      if (error.statusCode) {
        reply.code(error.statusCode);
      } else {
        reply.code(500);
      }
      return errorResponse(error.message);
    }
  });

  // Send input to session
  fastify.post('/sessions/:id/input', async (request, reply) => {
    try {
      const sessionId = parseInt(request.params.id, 10);
      const { input } = request.body;
      await service.sendInput(sessionId, input);
      return successResponse(null, 'Input sent');
    } catch (error) {
      request.log.error(error);
      if (error.statusCode) {
        reply.code(error.statusCode);
      } else {
        reply.code(500);
      }
      return errorResponse(error.message);
    }
  });

  // Get session output
  fastify.get('/sessions/:id/output', async (request, reply) => {
    try {
      const sessionId = parseInt(request.params.id, 10);
      const session = await service.getById(sessionId);
      if (!session) {
        reply.code(404);
        return errorResponse('Session not found');
      }
      return successResponse(session.output || '');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get session output');
    }
  });

  // Delete session
  fastify.delete('/sessions/:id', async (request, reply) => {
    try {
      const sessionId = parseInt(request.params.id, 10);
      const broadcastFn = (sid, channel, data) => broadcastToSession(sid, channel, data);
      await service.delete(sessionId, broadcastFn);
      return successResponse(null, 'Session deleted');
    } catch (error) {
      request.log.error(error);
      if (error.statusCode) {
        reply.code(error.statusCode);
      } else {
        reply.code(500);
      }
      return errorResponse(error.message);
    }
  });

  // WebSocket handler
  fastify.get('/ws', { websocket: true }, (connection, req) => {
    const ws = connection.socket;

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        const { type, destination, session_id, channel, input, body } = data;

        // Handle STOMP-like destinations
        if (destination) {
          // Subscribe: /topic/session/{id}/output or /topic/session/{id}/status
          if (destination.startsWith('/topic/session/')) {
            const parts = destination.split('/');
            if (parts.length >= 5) {
              const sid = parseInt(parts[3], 10);
              const ch = parts[4]; // 'output' or 'status'

              if (!sessionSubscriptions.has(sid)) {
                sessionSubscriptions.set(sid, { output: [], status: [] });
              }

              if (ch === 'output' || ch === 'status') {
                sessionSubscriptions.get(sid)[ch].push(ws);

                ws.send(
                  JSON.stringify({
                    type: 'SUBSCRIBED',
                    destination,
                  })
                );
              }
            }
          }

          // Send input: /app/session/{id}/input
          if (destination.startsWith('/app/session/')) {
            const parts = destination.split('/');
            if (parts.length >= 4) {
              const sid = parseInt(parts[2], 10);
              const inputText =
                typeof body === 'string' ? JSON.parse(body).input : body?.input;

              if (inputText) {
                await service.sendInput(sid, inputText);

                // Echo input
                broadcastToSession(
                  sid,
                  'output',
                  {
                    type: 'chunk',
                    content: inputText,
                    stream: 'stdin',
                    timestamp: new Date().toISOString(),
                  }
                );
              }
            }
          }
        }

        // Handle simple message format
        if (type === 'subscribe' && session_id) {
          const ch = channel || 'output';
          if (!sessionSubscriptions.has(session_id)) {
            sessionSubscriptions.set(session_id, { output: [], status: [] });
          }
          sessionSubscriptions.get(session_id)[ch].push(ws);

          ws.send(
            JSON.stringify({
              type: 'subscribed',
              session_id,
              channel: ch,
            })
          );
        }

        if (type === 'input' && session_id && input) {
          await service.sendInput(session_id, input);
        }
      } catch (error) {
        // Ignore invalid JSON
      }
    });

    ws.on('close', () => {
      // Clean up subscriptions
      for (const [sid, channels] of sessionSubscriptions.entries()) {
        for (const ch of Object.keys(channels)) {
          const idx = channels[ch].indexOf(ws);
          if (idx > -1) channels[ch].splice(idx, 1);
        }
        // Clean up empty entries
        if (
          sessionSubscriptions.get(sid).output.length === 0 &&
          sessionSubscriptions.get(sid).status.length === 0
        ) {
          sessionSubscriptions.delete(sid);
        }
      }
    });
  });
}

module.exports = sessionRoutes;
