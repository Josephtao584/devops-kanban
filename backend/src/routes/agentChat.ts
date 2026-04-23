import type { FastifyPluginAsync } from 'fastify';
import { AgentChatService } from '../services/agentChatService.js';
import { errorResponse, successResponse } from '../utils/response.js';
import { getErrorMessage, getStatusCode, parseNumber, logError } from '../utils/http.js';
import type { IdParams } from '../types/http/params.js';

type AgentChatRouteOptions = { service?: AgentChatService };

const agentChatRoutes: FastifyPluginAsync<AgentChatRouteOptions> = async (
  fastify,
  { service = new AgentChatService() } = {}
) => {

  // POST /api/agents/:id/chat/sessions - Start a new chat session
  fastify.post<{ Params: IdParams }>('/:id/chat/sessions', async (request, reply) => {
    try {
      const session = await service.startSession(parseNumber(request.params.id));
      return successResponse({ id: session.id, agentId: session.agentId, status: session.status }, 'Chat session started');
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to start chat session'));
    }
  });

  // GET /api/agents/:id/chat/sessions - Get latest active chat session for an agent
  fastify.get<{ Params: IdParams }>('/:id/chat/sessions', async (request, reply) => {
    try {
      const session = service.getLatestSession(parseNumber(request.params.id));
      return successResponse(session);
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get chat sessions'));
    }
  });

  // GET /api/agents/:id/chat/sessions/:chatId/messages - Get chat history
  fastify.get<{ Params: IdParams & { chatId: string } }>('/:id/chat/sessions/:chatId/messages', async (request, reply) => {
    try {
      const messages = service.getMessages(request.params.chatId);
      return successResponse(messages);
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get chat messages'));
    }
  });

  // POST /api/agents/:id/chat/sessions/:chatId/messages - Send a message (SSE streaming)
  fastify.post<{ Params: IdParams & { chatId: string }; Body: { content: string } }>(
    '/:id/chat/sessions/:chatId/messages',
    async (request, reply) => {
      const { chatId } = request.params;
      const content = (request.body as { content?: string })?.content;

      if (!content || typeof content !== 'string' || !content.trim()) {
        reply.code(400);
        return errorResponse('content is required');
      }

      // Set up SSE headers
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('X-Accel-Buffering', 'no');
      reply.raw.flushHeaders();

      const sendSseEvent = (type: string, data: unknown) => {
        if (reply.raw.destroyed) return;
        try {
          reply.raw.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
        } catch {
          // Connection may have been closed
        }
      };

      try {
        await service.sendMessage(chatId, content.trim(), (event) => {
          sendSseEvent('message', event);
        });
        sendSseEvent('done', { chatId });
      } catch (error) {
        const errMsg = getErrorMessage(error, 'Failed to process message');
        sendSseEvent('error', { message: errMsg });
        logError(error, request);
      } finally {
        if (!reply.raw.destroyed) {
          reply.raw.end();
        }
      }
    }
  );

  // DELETE /api/agents/:id/chat/sessions/:chatId - End and clean up a session
  fastify.delete<{ Params: IdParams & { chatId: string } }>('/:id/chat/sessions/:chatId', async (request, reply) => {
    try {
      await service.deleteSession(request.params.chatId);
      return successResponse(null, 'Chat session deleted');
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to delete chat session'));
    }
  });
};

export { agentChatRoutes };
