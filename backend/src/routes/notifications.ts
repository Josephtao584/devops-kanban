import { FastifyInstance } from 'fastify';
import { NotificationService } from '../services/notificationService.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { STORAGE_PATH } from '../config/index.js';
import path from 'node:path';

const NOTIFICATION_CONFIG_FILE = path.join(STORAGE_PATH, 'notification-config.json');

export async function notificationRoutes(fastify: FastifyInstance) {
  const service = new NotificationService({ filePath: NOTIFICATION_CONFIG_FILE });

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
}
