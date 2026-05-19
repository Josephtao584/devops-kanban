import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { logger, logCrash } from '../src/utils/logger.js';
import { STORAGE_PATH } from '../src/config/index.js';

test.test('logger.info outputs structured format', () => {
  const output: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => output.push(args.join(' '));

  logger.info('TestComponent', 'Something happened');

  console.log = originalLog;
  assert.equal(output.length, 1);
  const line = output[0]!;
  assert.ok(line.includes('[INFO]'));
  assert.ok(line.includes('[TestComponent]'));
  assert.ok(line.includes('Something happened'));
});

test.test('logger.info with context includes JSON', () => {
  const output: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => output.push(args.join(' '));

  logger.info('TestComponent', 'Got result', { taskId: 42, name: 'test' });

  console.log = originalLog;
  const line = output[0]!;
  assert.ok(line.includes('"taskId":42'));
  assert.ok(line.includes('"name":"test"'));
});

test.test('logger.warn outputs structured format', () => {
  const output: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => output.push(args.join(' '));

  logger.warn('TestComponent', 'Something odd', { key: 'val' });

  console.warn = originalWarn;
  assert.equal(output.length, 1);
  assert.ok(output[0]!.includes('[WARN]'));
  assert.ok(output[0]!.includes('[TestComponent]'));
});

test.test('logger.error outputs structured format', () => {
  const output: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => output.push(args.join(' '));

  logger.error('TestComponent', 'Something broke', { err: 'detail' });

  console.error = originalError;
  assert.equal(output.length, 1);
  assert.ok(output[0]!.includes('[ERROR]'));
  assert.ok(output[0]!.includes('[TestComponent]'));
});

test.test('logger outputs ISO timestamp', () => {
  const output: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => output.push(args.join(' '));

  logger.info('Test', 'msg');

  console.log = originalLog;
  const line = output[0]!;
  // ISO timestamp format: 2026-04-08T10:00:00.000Z
  assert.match(line, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
});

test.test('logger without context has no trailing JSON', () => {
  const output: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => output.push(args.join(' '));

  logger.info('Test', 'msg');

  console.log = originalLog;
  const line = output[0]!;
  assert.ok(!line.includes('{'), 'Should not include context JSON when no context provided');
});

test.test('logger.info appends to today\'s log file', async () => {
  const originalLog = console.log;
  console.log = () => {};

  const tag = `file-test-${process.pid}-${Date.now()}`;
  logger.info('FileTest', tag);

  console.log = originalLog;

  const today = new Date();
  const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const logFile = path.join(STORAGE_PATH, 'logs', `backend-${stamp}.log`);

  // WriteStream is async; poll for the marker to appear (up to ~2s).
  let content = '';
  for (let i = 0; i < 20; i++) {
    if (fs.existsSync(logFile)) {
      content = fs.readFileSync(logFile, 'utf8');
      if (content.includes(tag)) break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  assert.ok(fs.existsSync(logFile), `expected log file at ${logFile}`);
  assert.ok(content.includes(tag), `expected log file to contain marker ${tag}`);
  assert.ok(content.includes('[FileTest]'));
});

test.test('logCrash writes a synchronous crash dump', () => {
  const err = new Error('synthetic crash');
  const crashPath = logCrash('test-label', err, { runId: 999 });

  assert.ok(crashPath, 'logCrash should return the dump path');
  assert.ok(fs.existsSync(crashPath!), `crash file should exist at ${crashPath}`);
  const content = fs.readFileSync(crashPath!, 'utf8');
  assert.ok(content.includes('test-label'));
  assert.ok(content.includes('synthetic crash'));
  assert.ok(content.includes('"runId": 999'));
  assert.ok(content.includes('[stack]'));

  // Cleanup so re-runs don't accumulate
  try { fs.unlinkSync(crashPath!); } catch { /* ignore */ }
});
