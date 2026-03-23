import 'dotenv/config';
import Fastify from 'fastify';
import fastifyWebSocket from '@fastify/websocket';

import * as config from './config/index.js';
import corsPlugin from './middleware/cors.js';
import errorHandlerPlugin from './middleware/errorHandler.js';
import {
  agentRoutes,
  executionRoutes,
  iterationRoutes,
  projectRoutes,
  sessionRoutes,
  taskRoutes,
  taskSourceRoutes,
  workflowRoutes,
  workflowTemplateRoutes,
  gitRoutes,
} from './routes/index.js';

export async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'warn',
    },
  });

  fastify.config = config;

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

  return fastify;
}
