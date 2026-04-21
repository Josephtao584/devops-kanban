import type { FastifyPluginAsync } from 'fastify';
import cron from 'node-cron';
import { SettingsService } from '../services/settingsService.js';
import { successResponse, errorResponse } from '../utils/response.js';

const settingsService = new SettingsService();

export const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/settings — get all settings
  fastify.get('/', async () => {
    const settings = await settingsService.getAll();
    return successResponse(settings);
  });

  // PUT /api/settings — batch update settings
  fastify.put<{ Body: Record<string, string> }>('/', async (request, reply) => {
    const data = request.body;
    if (!data || typeof data !== 'object') {
      return errorResponse('Invalid settings data');
    }

    // Validate cron expression before saving
    if (data['scheduler.workflow_dispatch_cron']) {
      if (!cron.validate(data['scheduler.workflow_dispatch_cron'])) {
        reply.code(400);
        return errorResponse('Invalid cron expression');
      }
    }

    const items = Object.entries(data).map(([key, value]) => ({ key, value }));
    await settingsService.setMany(items);

    const scheduler = fastify.schedulerService;

    // Handle scheduler.enabled toggle
    if (data['scheduler.enabled'] !== undefined && scheduler) {
      if (data['scheduler.enabled'] === 'true') {
        const dispatchCron = await settingsService.getWorkflowDispatchCron();
        const ok = scheduler.enable(dispatchCron);
        if (!ok) {
          // Roll back: cron was invalid, keep scheduler disabled
          await settingsService.set('scheduler.enabled', 'false');
          reply.code(400);
          return errorResponse('Invalid cron expression, scheduler not enabled');
        }
      } else {
        scheduler.disable();
      }
    } else if (data['scheduler.workflow_dispatch_cron'] && scheduler) {
      // If cron changed while enabled, re-register dispatch job
      const enabled = await settingsService.getSchedulerEnabled();
      if (enabled) {
        scheduler.registerDispatchJob(data['scheduler.workflow_dispatch_cron']);
      }
    }

    return successResponse(null, 'Settings updated');
  });

  // GET /api/settings/scheduler/status — active workflow count
  fastify.get('/scheduler/status', async () => {
    const scheduler = fastify.schedulerService;
    const activeCount = scheduler ? await scheduler.getActiveWorkflowCount() : 0;
    return successResponse({ activeCount });
  });

  // POST /api/settings/scheduler/trigger — trigger dispatch now
  fastify.post('/scheduler/trigger', async () => {
    const scheduler = fastify.schedulerService;
    if (!scheduler) {
      return errorResponse('Scheduler not available');
    }
    const result = await scheduler.dispatchWorkflows();
    return successResponse(result, 'Workflow dispatch triggered');
  });
};
