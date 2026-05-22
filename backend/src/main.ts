import { buildApp } from './app.js';
import { killAllActiveProcesses, getActiveProcessCount } from './utils/processRegistry.js';
import { logCrash, logger } from './utils/logger.js';

const app = await buildApp();

const start = async () => {
  try {
    await app.listen({
      port: app.config.SERVER_PORT,
      host: app.config.SERVER_HOST,
    });

    logger.info('Boot', `Coplat Backend started`, {
      url: `http://${app.config.SERVER_HOST}:${app.config.SERVER_PORT}`,
      pid: process.pid,
      platform: process.platform,
      nodeVersion: process.version,
      storagePath: app.config.STORAGE_PATH,
    });
    console.log(`🚀 Coplat Backend (Node.js) starting...`);
    console.log(`   Server: http://${app.config.SERVER_HOST}:${app.config.SERVER_PORT}`);
    console.log(`   API Docs: http://${app.config.SERVER_HOST}:${app.config.SERVER_PORT}/docs`);
    console.log(`   Data path: ${app.config.STORAGE_PATH}`);
  } catch (err) {
    logger.error('Boot', 'Listen failed', { error: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined });
    app.log.error(err);
    process.exit(1);
  }
};

let shuttingDown = false;
const shutdown = (signal: string, extra?: Record<string, unknown>) => {
  // Log BEFORE the dedupe guard so a second signal still leaves a trace
  // (helpful when a CTRL_C_EVENT is broadcast to the whole console group on Windows).
  logger.warn('Shutdown', `Signal received: ${signal}`, {
    pid: process.pid,
    ppid: process.ppid,
    platform: process.platform,
    activeChildProcesses: getActiveProcessCount(),
    alreadyShuttingDown: shuttingDown,
    ...extra,
  });
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`👋 Coplat Backend shutting down (${signal})...`);

  if (app.schedulerService) {
    try {
      app.schedulerService.shutdown();
    } catch (err) {
      logger.error('Shutdown', 'Scheduler shutdown failed', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  // Kill any executor child processes (Claude Code / Codex / OpenCode) that
  // were still running. Without this they survive the parent and keep
  // burning CPU + an Anthropic API session until the model finishes.
  try {
    const killed = killAllActiveProcesses('SIGTERM');
    logger.info('Shutdown', `Killed ${killed} active executor process(es)`);
  } catch (err) {
    logger.error('Shutdown', 'Active process cleanup failed', { error: err instanceof Error ? err.message : String(err) });
  }

  // Hard timeout: if fastify.close hangs (e.g. open socket / running child
  // process), force exit so we don't get stuck in a half-closed state.
  const forceExitTimer = setTimeout(() => {
    logger.error('Shutdown', 'Graceful shutdown timed out after 5s, forcing exit');
    process.exit(1);
  }, 5000);
  forceExitTimer.unref();

  app.close().then(() => {
    logger.info('Shutdown', 'Fastify server closed cleanly');
    process.exit(0);
  }).catch((err) => {
    logger.error('Shutdown', 'Error during fastify.close', { error: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined });
    process.exit(1);
  });
};

// Signal disposition policy
// =========================
// On Windows, the backend shares a console group with `tsx watch` (parent) and
// any Claude/Codex/OpenCode CLI children. Anything in that group can broadcast
// CTRL_C_EVENT / CTRL_BREAK_EVENT to *all* members. We've observed phantom
// SIGINT arriving from a child's `taskkill` even though no human pressed Ctrl+C.
//
// To prevent silent unwanted shutdowns:
//   - SIGTERM is always honored (start.sh and OS-level shutdown use it).
//   - On POSIX, SIGINT/SIGHUP also trigger shutdown (terminal Ctrl+C is real).
//   - On Windows, SIGINT/SIGHUP/SIGBREAK are LOGGED but NOT acted on. To stop
//     the backend on Windows, kill it by PID (taskkill /pid …) or send
//     SIGTERM. This sacrifices "Ctrl+C in the dev console" — acceptable because
//     `tsx watch` controls the dev console anyway and you can stop it via its
//     own parent.
const HONOR_INTERRUPTS_ON_WIN = process.env.WIN_HONOR_INTERRUPTS === '1';
const isWin = process.platform === 'win32';

const handleInterrupt = (signal: string) => {
  if (isWin && !HONOR_INTERRUPTS_ON_WIN) {
    // Log but don't shut down — see policy comment above.
    logger.warn('Signal', `${signal} ignored on Windows (set WIN_HONOR_INTERRUPTS=1 to act)`, {
      pid: process.pid,
      ppid: process.ppid,
      activeChildProcesses: getActiveProcessCount(),
    });
    return;
  }
  shutdown(signal);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => handleInterrupt('SIGINT'));
process.on('SIGHUP', () => handleInterrupt('SIGHUP'));
if (isWin) {
  // SIGBREAK only exists on Windows. Guard so Linux/Mac don't throw on bind.
  process.on('SIGBREAK' as NodeJS.Signals, () => handleInterrupt('SIGBREAK'));
}

// 'beforeExit' fires when the event loop drains naturally (no signal, no exit()).
// If we ever see this in the log, something kept failing to keep handles open.
process.on('beforeExit', (code) => {
  logger.warn('Shutdown', 'beforeExit fired (event loop empty)', { code, pid: process.pid });
});

// 'exit' is the last hook. Synchronous only — logger.* uses sync writes via
// writeStream which may not flush, so logCrash (sync fs.writeFileSync) is the
// reliable channel here.
process.on('exit', (code) => {
  logCrash('exit', new Error(`process.exit(${code})`), { pid: process.pid, code });
});

// Global error handlers - catch unhandled exceptions that would crash the process
process.on('uncaughtException', (error) => {
  const crashPath = logCrash('uncaughtException', error);
  console.error('💥 UNCAUGHT EXCEPTION:', error);
  console.error('Stack:', error.stack);
  if (crashPath) console.error(`Crash dump: ${crashPath}`);
  // Process state is undefined after uncaught exception — must restart
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  const crashPath = logCrash('unhandledRejection', reason, { promise: String(promise) });
  console.error('💥 UNHANDLED REJECTION at:', promise);
  console.error('Reason:', reason);
  if (reason instanceof Error) {
    console.error('Stack:', reason.stack);
  }
  if (crashPath) console.error(`Crash dump: ${crashPath}`);
  // Prevent data corruption from continuing in undefined state
  setTimeout(() => process.exit(1), 1000);
});

// Process warnings (e.g. MaxListenersExceededWarning, deprecation) — these
// often precede a crash but are normally only printed to stderr.
process.on('warning', (warning) => {
  logger.warn('NodeWarning', warning.message, { name: warning.name, stack: warning.stack });
});

// Heartbeat: emit every 30s so we can pinpoint the *last alive* timestamp
// when the process dies without warning. The log line is intentionally
// `info` so it goes through the async write path and doesn't dominate the
// fsync budget; the `warn`/`error` paths are sync so the *last* line before
// death (a signal log or an exception) will still land on disk.
const HEARTBEAT_INTERVAL_MS = Number(process.env.HEARTBEAT_INTERVAL_MS) || 30_000;
const heartbeat = setInterval(() => {
  const mem = process.memoryUsage();
  logger.info('Heartbeat', 'alive', {
    uptimeSec: Math.round(process.uptime()),
    rssMB: Math.round(mem.rss / 1024 / 1024),
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    activeChildProcesses: getActiveProcessCount(),
    pid: process.pid,
  });
}, HEARTBEAT_INTERVAL_MS);
heartbeat.unref(); // Don't keep the event loop alive for heartbeat alone.

await start();
