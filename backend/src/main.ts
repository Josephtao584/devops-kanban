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

  app.close(() => {
    console.log('Fastify server closed');
    process.exit(0);
  });
});

await start();
