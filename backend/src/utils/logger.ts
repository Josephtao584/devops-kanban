import * as fs from 'node:fs';
import * as path from 'node:path';
import { STORAGE_PATH } from '../config/index.js';

type LogContext = Record<string, unknown>;

const LOG_DIR = path.join(STORAGE_PATH, 'logs');

let writeStream: fs.WriteStream | null = null;
let currentLogDate: string | null = null;
let initFailed = false;

function ensureLogDir(): boolean {
  if (initFailed) return false;
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    return true;
  } catch (err) {
    initFailed = true;
    console.error(`[logger] Failed to create log dir ${LOG_DIR}: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

function todayStamp(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getStream(): fs.WriteStream | null {
  if (!ensureLogDir()) return null;
  const stamp = todayStamp();
  if (writeStream && currentLogDate === stamp) return writeStream;

  // Date rolled over — close old stream and open a new one.
  if (writeStream) {
    try { writeStream.end(); } catch { /* ignore */ }
    writeStream = null;
  }

  try {
    const filePath = path.join(LOG_DIR, `backend-${stamp}.log`);
    writeStream = fs.createWriteStream(filePath, { flags: 'a' });
    writeStream.on('error', (err) => {
      // Stream-level error: drop the stream so we try to reopen on next call.
      // Don't let this become an unhandledRejection / kill the process.
      console.error(`[logger] log stream error: ${err.message}`);
      writeStream = null;
    });
    currentLogDate = stamp;
    return writeStream;
  } catch (err) {
    console.error(`[logger] Failed to open log file: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

function formatMessage(level: string, component: string, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const contextStr = context && Object.keys(context).length > 0
    ? ' ' + JSON.stringify(context)
    : '';
  return `${timestamp} [${level}] [${component}] ${message}${contextStr}`;
}

function writeLine(line: string): void {
  const stream = getStream();
  if (!stream) return;
  try {
    stream.write(line + '\n');
  } catch (err) {
    console.error(`[logger] write failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export const logger = {
  info(component: string, message: string, context?: LogContext) {
    const line = formatMessage('INFO', component, message, context);
    console.log(line);
    writeLine(line);
  },

  warn(component: string, message: string, context?: LogContext) {
    const line = formatMessage('WARN', component, message, context);
    console.warn(line);
    writeLine(line);
  },

  error(component: string, message: string, context?: LogContext) {
    const line = formatMessage('ERROR', component, message, context);
    console.error(line);
    writeLine(line);
  },
};

/**
 * Write a crash dump synchronously and return the file path.
 *
 * Used by the process-level uncaughtException / unhandledRejection handlers
 * before the runtime exits. Sync I/O is intentional: the process is about to
 * die and the regular WriteStream may not flush in time.
 */
export function logCrash(label: string, err: unknown, extra?: LogContext): string | null {
  if (!ensureLogDir()) return null;
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(LOG_DIR, `crash-${ts}.log`);

  const errorMessage = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error && err.stack ? err.stack : '(no stack)';
  const extraStr = extra && Object.keys(extra).length > 0
    ? '\n[extra]\n' + JSON.stringify(extra, null, 2)
    : '';

  const body = `${new Date().toISOString()} [CRASH] [${label}] ${errorMessage}\n[stack]\n${stack}${extraStr}\n`;

  try {
    fs.writeFileSync(filePath, body, { flag: 'a' });
    // Also append into today's regular log so timeline stays single-file readable.
    const dailyFile = path.join(LOG_DIR, `backend-${todayStamp()}.log`);
    fs.writeFileSync(dailyFile, body, { flag: 'a' });
    return filePath;
  } catch (writeErr) {
    console.error(`[logger] Failed to write crash log: ${writeErr instanceof Error ? writeErr.message : String(writeErr)}`);
    return null;
  }
}
