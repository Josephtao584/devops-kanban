import { buildApp } from './app.js';
import { killAllActiveProcesses } from './utils/processRegistry.js';

const app = await buildApp();

const start = async () => {
  try {
    await app.listen({
      port: app.config.SERVER_PORT,
      host: app.config.SERVER_HOST,
    });

    console.log(`🚀 Coplat Backend (Node.js) starting...`);
    console.log(`   Server: http://${app.config.SERVER_HOST}:${app.config.SERVER_PORT}`);
    console.log(`   API Docs: http://${app.config.SERVER_HOST}:${app.config.SERVER_PORT}/docs`);
    console.log(`   Data path: ${app.config.STORAGE_PATH}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

let shuttingDown = false;
const shutdown = (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`👋 Coplat Backend shutting down (${signal})...`);

  if (app.schedulerService) {
    try {
      app.schedulerService.shutdown();
    } catch (err) {
      console.error('Scheduler shutdown failed:', err);
    }
  }

  // Kill any executor child processes (Claude Code / Codex / OpenCode) that
  // were still running. Without this they survive the parent and keep
  // burning CPU + an Anthropic API session until the model finishes.
  try {
    killAllActiveProcesses('SIGTERM');
  } catch (err) {
    console.error('Active process cleanup failed:', err);
  }

  // Hard timeout: if fastify.close hangs (e.g. open socket / running child
  // process), force exit so we don't get stuck in a half-closed state.
  const forceExitTimer = setTimeout(() => {
    console.error('Graceful shutdown timed out after 5s, forcing exit');
    process.exit(1);
  }, 5000);
  forceExitTimer.unref();

  app.close().then(() => {
    console.log('Fastify server closed');
    process.exit(0);
  }).catch((err) => {
    console.error('Error during fastify.close:', err);
    process.exit(1);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Global error handlers - catch unhandled exceptions that would crash the process
process.on('uncaughtException', (error) => {
  console.error('💥 UNCAUGHT EXCEPTION:', error);
  console.error('Stack:', error.stack);
  // Process state is undefined after uncaught exception — must restart
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 UNHANDLED REJECTION at:', promise);
  console.error('Reason:', reason);
  if (reason instanceof Error) {
    console.error('Stack:', reason.stack);
  }
  // Prevent data corruption from continuing in undefined state
  setTimeout(() => process.exit(1), 1000);
});

await start();
