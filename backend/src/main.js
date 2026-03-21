/**
 * Application entry point
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Fastify from 'fastify';
import fastifyWebSocket from '@fastify/websocket';
import pino from 'pino';

import * as config from './config/index.js';
import corsPlugin from './middleware/cors.js';
import errorHandlerPlugin from './middleware/errorHandler.js';

// Import routes
import projectRoutes from './routes/projects.js';
import taskRoutes from './routes/tasks.js';
import taskWorktreeRoutes from './routes/taskWorktree.js';
import sessionRoutes from './routes/sessions.js';
import taskSourceRoutes from './routes/taskSources.js';
import executionRoutes from './routes/executions.js';
import agentRoutes from './routes/agents.js';
import roleRoutes from './routes/roles.js';
import memberRoutes from './routes/members.js';
import workflowRoutes from './routes/workflows.js';
import workflowTemplateRoutes from './routes/workflowTemplate.js';
import gitRoutes from './routes/git.js';
import iterationRoutes from './routes/iterations.js';

import { initWorkflows } from './workflows/index.js';

// Ensure logs directory exists
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Resolve log path to backend directory (from backend/src to backend)
const logDir = path.resolve(path.join(__dirname, '..'), config.LOG_DIR);

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 文件流使用 pino.destination（Pino 8）；勿与 transport.targets 混用自定义 formatters.level
function logFileStream(filename) {
  return pino.destination({ dest: path.join(logDir, filename), append: true });
}

// Configure log output streams with file rotation
const streams = [
  { level: 'trace', stream: logFileStream('trace.log') },
  { level: 'debug', stream: logFileStream('debug.log') },
  { level: 'info', stream: logFileStream('info.log') },
  { level: 'warn', stream: logFileStream('warn.log') },
  { level: 'error', stream: logFileStream('error.log') },
  { level: config.LOG_LEVEL, stream: logFileStream('app.log') },
  { level: config.LOG_LEVEL, stream: process.stdout },
];

// Create custom logger with file and console output
// Pino 默认 level 为数字；formatters.level 改为输出 'info' | 'warn' 等文本，便于阅读与检索
const logger = pino(
  {
    level: config.LOG_LEVEL,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  },
  pino.multistream(streams),
);

// Fastify 4 使用 logger 选项传入 Pino 实例（无 customLogger）
const fastify = Fastify({
  logger,
});

// Store config in fastify instance
fastify.config = config;

// Register plugins
fastify.register(corsPlugin);
fastify.register(errorHandlerPlugin);

// Register WebSocket plugin for Fastify (provides fastify.websocketServer)
fastify.register(fastifyWebSocket, {
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
        roles: '/api/roles',
        members: '/api/members',
        workflows: '/api/workflows',
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
fastify.register(taskWorktreeRoutes, { prefix: '/api/tasks' });
fastify.register(sessionRoutes, { prefix: '/api' });
fastify.register(taskSourceRoutes, { prefix: '/api/task-sources' });
fastify.register(executionRoutes, { prefix: '/api/executions' });
fastify.register(agentRoutes, { prefix: '/api/agents' });
fastify.register(roleRoutes, { prefix: '/api/roles' });
fastify.register(memberRoutes, { prefix: '/api/members' });
fastify.register(workflowRoutes, { prefix: '/api/workflows' });
fastify.register(workflowTemplateRoutes, { prefix: '/api/workflow-template' });
fastify.register(gitRoutes, { prefix: '/api/git' });
fastify.register(iterationRoutes, { prefix: '/api/iterations' });

// Start server
const start = async () => {
  try {
    // Initialize Mastra workflow engine
    await initWorkflows();

    await fastify.listen({
      port: config.SERVER_PORT,
      host: config.SERVER_HOST,
    });

    console.log(`🚀 DevOps Kanban Backend (Node.js) starting...`);
    console.log(`   Server: http://${config.SERVER_HOST}:${config.SERVER_PORT}`);
    console.log(`   API Docs: http://${config.SERVER_HOST}:${config.SERVER_PORT}/docs`);
    console.log(`   Data path: ${config.STORAGE_PATH}`);
    console.log(`   Log path: ${logDir}`);
    console.log(`   Log level: ${config.LOG_LEVEL}`);
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
