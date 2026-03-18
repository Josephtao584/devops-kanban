/**
 * Application entry point
 */
require('dotenv').config();

const Fastify = require('fastify');
const path = require('path');

const config = require('./config');
const corsPlugin = require('./middleware/cors');
const errorHandlerPlugin = require('./middleware/errorHandler');

// Import routes
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const sessionRoutes = require('./routes/sessions');
const taskSourceRoutes = require('./routes/taskSources');
const executionRoutes = require('./routes/executions');
const agentRoutes = require('./routes/agents');
const requirementRoutes = require('./routes/requirements');
const roleRoutes = require('./routes/roles');
const memberRoutes = require('./routes/members');

// Create Fastify instance
const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

// Store config in fastify instance
fastify.config = config;

// Register plugins
fastify.register(corsPlugin);
fastify.register(errorHandlerPlugin);

// Register WebSocket plugin for Fastify (provides fastify.websocketServer)
fastify.register(require('@fastify/websocket'), {
  options: {
    maxPayload: 1048576, // 1MB max payload
  },
});

// Root route
fastify.get('/', async (request, reply) => {
  return {
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
        requirements: '/api/requirements',
        roles: '/api/roles',
        members: '/api/members',
        websocket: '/ws',
        health: '/health',
      },
    },
  };
});

// Health check
fastify.get('/health', async (request, reply) => {
  return { status: 'ok' };
});

// Register routes with /api prefix
fastify.register(projectRoutes, { prefix: '/api/projects' });
fastify.register(taskRoutes, { prefix: '/api/tasks' });
fastify.register(sessionRoutes, { prefix: '/api' });
fastify.register(taskSourceRoutes, { prefix: '/api/task-sources' });
fastify.register(executionRoutes, { prefix: '/api/executions' });
fastify.register(agentRoutes, { prefix: '/api/agents' });
fastify.register(requirementRoutes, { prefix: '/api/requirements' });
fastify.register(roleRoutes, { prefix: '/api/roles' });
fastify.register(memberRoutes, { prefix: '/api/members' });

// Start server
const start = async () => {
  try {
    await fastify.listen({
      port: config.SERVER_PORT,
      host: config.SERVER_HOST,
    });

    console.log(`🚀 DevOps Kanban Backend (Node.js) starting...`);
    console.log(`   Server: http://${config.SERVER_HOST}:${config.SERVER_PORT}`);
    console.log(`   API Docs: http://${config.SERVER_HOST}:${config.SERVER_PORT}/docs`);
    console.log(`   Data path: ${config.STORAGE_PATH}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Handle shutdown
process.on('SIGTERM', () => {
  console.log('👋 DevOps Kanban Backend shutting down...');

  // Close Fastify server
  fastify.close(() => {
    console.log('Fastify server closed');
    process.exit(0);
  });
});

start();
