import { FastifyInstance } from 'fastify';
import { NotificationService } from '../services/notificationService.js';
import { notificationEvents } from '../services/notificationEvents.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { STORAGE_PATH, BACKEND_ROOT } from '../config/index.js';
import path from 'node:path';

const NOTIFICATION_CONFIG_FILE = path.join(STORAGE_PATH, 'notification-config.json');
const NOTIFICATION_DEFAULT_YAML = path.join(BACKEND_ROOT, 'notification-config.yaml');

export async function notificationRoutes(fastify: FastifyInstance) {
  const service = new NotificationService({
    filePath: NOTIFICATION_CONFIG_FILE,
    defaultYamlPath: NOTIFICATION_DEFAULT_YAML,
  });

  // GET /api/notifications/config
  fastify.get('/config', async (_request, reply) => {
    try {
      const config = await service.getConfig();
      return successResponse(config || {}, 'Notification config loaded');
    } catch (error) {
      return errorResponse('Failed to load notification config');
    }
  });

  // PUT /api/notifications/config
  fastify.put<{ Body: { url: string; receiver: string; auth: string } }>('/config', async (request, reply) => {
    try {
      const { url, receiver, auth } = request.body;
      if (!url || typeof url !== 'string') {
        reply.code(400);
        return errorResponse('url is required');
      }
      try {
        new URL(url);
      } catch {
        reply.code(400);
        return errorResponse('url must be a valid HTTP/HTTPS URL');
      }
      await service.saveConfig({ url, receiver: receiver || '', auth: auth || '' });
      return successResponse(null, 'Notification config saved');
    } catch (error) {
      return errorResponse('Failed to save notification config');
    }
  });

  // POST /api/notifications/send
  fastify.post<{ Body: { content: string } }>('/send', async (request, reply) => {
    try {
      const { content } = request.body;
      if (!content || typeof content !== 'string') {
        reply.code(400);
        return errorResponse('content is required');
      }
      const result = await service.sendNotification(content);
      return successResponse({ sent: result }, result ? 'Notification sent' : 'Notification skipped');
    } catch (error) {
      return errorResponse('Failed to send notification');
    }
  });

  // GET /api/notifications/events — SSE endpoint for browser push
  fastify.get('/events', async (request, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    reply.hijack();

    const send = (event: { type: string; runId: number; taskId: number; taskTitle: string }) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    notificationEvents.on('workflow', send);

    request.raw.on('close', () => {
      notificationEvents.off('workflow', send);
    });
  });
}
