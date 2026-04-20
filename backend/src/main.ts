import { buildApp } from './app.js';

const app = await buildApp();

const start = async () => {
  try {
    await app.listen({
      port: app.config.SERVER_PORT,
      host: app.config.SERVER_HOST,
    });

    console.log(`🚀 DevOps Kanban Backend (Node.js) starting...`);
    console.log(`   Server: http://${app.config.SERVER_HOST}:${app.config.SERVER_PORT}`);
    console.log(`   API Docs: http://${app.config.SERVER_HOST}:${app.config.SERVER_PORT}/docs`);
    console.log(`   Data path: ${app.config.STORAGE_PATH}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => {
  console.log('👋 DevOps Kanban Backend shutting down...');

  if (app.schedulerService) {
    app.schedulerService.shutdown();
  }

  app.close(() => {
    console.log('Fastify server closed');
    process.exit(0);
  });
});

// Global error handlers - catch unhandled exceptions that would crash the process
process.on('uncaughtException', (error) => {
  console.error('💥 UNCAUGHT EXCEPTION:', error);
  console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 UNHANDLED REJECTION at:', promise);
  console.error('Reason:', reason);
  if (reason instanceof Error) {
    console.error('Stack:', reason.stack);
  }
});

await start();
