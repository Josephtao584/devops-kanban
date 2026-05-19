import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import { logger } from './logger.js';

// Global registry of executor child processes (Claude Code, Codex, OpenCode).
// Without this, processes spawned by step runners become orphans on
// SIGTERM/SIGINT — the parent dies but the children keep running, holding
// CPU and an Anthropic API session for as long as the model takes to
// finish. The registry lets the shutdown path kill them deterministically.
const activeProcesses = new Set<ChildProcess>();

export function registerActiveProcess(proc: ChildProcess): void {
  activeProcesses.add(proc);
  const cleanup = () => {
    activeProcesses.delete(proc);
  };
  proc.once('close', cleanup);
  proc.once('exit', cleanup);
}

export function killAllActiveProcesses(signal: NodeJS.Signals = 'SIGTERM'): number {
  const procs = Array.from(activeProcesses);
  if (procs.length === 0) return 0;

  logger.info('processRegistry', `Killing ${procs.length} active executor process(es) on shutdown`);

  for (const proc of procs) {
    try {
      if (process.platform === 'win32' && proc.pid) {
        // taskkill propagates to the process tree; we don't await it so the
        // shutdown path stays synchronous.
        spawn('taskkill', ['/pid', String(proc.pid), '/t', '/f'], {
          stdio: 'ignore',
          detached: true,
        });
      } else {
        proc.kill(signal);
      }
    } catch (err) {
      logger.warn('processRegistry', `Failed to kill pid ${proc.pid}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return procs.length;
}

export function getActiveProcessCount(): number {
  return activeProcesses.size;
}
