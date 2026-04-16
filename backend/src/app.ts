import 'dotenv/config';
import Fastify from 'fastify';
import fastifyWebSocket from '@fastify/websocket';

import * as config from './config/index.js';
import corsPlugin from './middleware/cors.js';
import errorHandlerPlugin from './middleware/errorHandler.js';
import { initWorkflows } from './services/workflow/workflows.js';
import { initDatabase, seedSampleData } from './db/index.js';
import { bootstrapBuiltinTemplates } from './services/workflow/workflowTemplateService.js';
import {
  agentRoutes,
  executionRoutes,
  iterationRoutes,
  projectRoutes,
  sessionRoutes,
  skillRoutes,
  taskRoutes,
  taskSourceRoutes,
  workflowRoutes,
  workflowTemplateRoutes,
  gitRoutes,
  mcpServerRoutes,
  bundleRoutes,
  notificationRoutes,
  settingsRoutes,
} from './routes/index.js';
import { SchedulerService } from './services/schedulerService.js';

export async function buildApp() {
  // Initialize database tables
  await initDatabase();

  // Auto-seed sample data if database is empty
  const { getDbClient } = await import('./db/client.js');
  const result = await getDbClient().execute('SELECT COUNT(*) as count FROM projects');
  if (!result?.rows?.[0] || Number(result.rows[0].count) === 0) {
    try {
      console.log('Database is empty, seeding sample data...');
      await seedSampleData();
    } catch (seedError) {
      console.warn('Sample data seeding skipped (data may already exist):', seedError instanceof Error ? seedError.message : String(seedError));
    }
  }

  // Initialize Mastra workflow engine
  await initWorkflows();

  // Bootstrap built-in workflow templates
  await bootstrapBuiltinTemplates();

  // Initialize scheduler for automated task source sync
  const schedulerService = new SchedulerService();
  await schedulerService.initialize();

  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'warn',
    },
  });

  fastify.config = config;

  fastify.decorate('schedulerService', schedulerService);

  fastify.register(corsPlugin);
  fastify.register(errorHandlerPlugin);

  fastify.register(fastifyWebSocket, {
    options: {
      maxPayload: 1048576,
    },
  });

  fastify.get('/', async () => ({
    success: true,
    message: 'DevOps Kanban API',
    version: '0.1.0 (Node.js)',
    data: {
      endpoints: {
        projects: '/api/projects',
        tasks: '/api/tasks',
        sessions: '/api/sessions',
        taskSources: '/api/task-sources',
        executions: '/api/executions',
        agents: '/api/agents',
        skills: '/api/skills',
        mcpServers: '/api/mcp-servers',
        workflows: '/api/workflows',
        websocket: '/ws',
        health: '/health',
      },
    },
  }));

  fastify.get('/health', async () => ({ status: 'ok' }));

  fastify.register(projectRoutes, { prefix: '/api/projects' });
  fastify.register(taskRoutes, { prefix: '/api/tasks' });
  fastify.register(sessionRoutes, { prefix: '/api' });
  fastify.register(taskSourceRoutes, { prefix: '/api/task-sources' });
  fastify.register(executionRoutes, { prefix: '/api/executions' });
  fastify.register(agentRoutes, { prefix: '/api/agents' });
  fastify.register(workflowRoutes, { prefix: '/api/workflows' });
  fastify.register(workflowTemplateRoutes, { prefix: '/api/workflow-template' });
  fastify.register(iterationRoutes, { prefix: '/api/iterations' });
  fastify.register(gitRoutes, { prefix: '/api/git' });
  fastify.register(skillRoutes, { prefix: '/api/skills' });
  fastify.register(mcpServerRoutes, { prefix: '/api/mcp-servers' });
  fastify.register(bundleRoutes, { prefix: '/api/bundle', storagePath: config.STORAGE_PATH });
  fastify.register(notificationRoutes, { prefix: '/api/notifications' });
  fastify.register(settingsRoutes, { prefix: '/api/settings' });

  // Shutdown scheduler when app closes
  fastify.addHook('onClose', async () => {
    schedulerService.shutdown();
  });

  return fastify;
}
