import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { logger } from '../src/utils/logger.js';

test.test('logger.info outputs structured format', () => {
  const output: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => output.push(args.join(' '));

  logger.info('TestComponent', 'Something happened');

  console.log = originalLog;
  assert.equal(output.length, 1);
  const line = output[0];
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
  const line = output[0];
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
  assert.ok(output[0].includes('[WARN]'));
  assert.ok(output[0].includes('[TestComponent]'));
});

test.test('logger.error outputs structured format', () => {
  const output: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => output.push(args.join(' '));

  logger.error('TestComponent', 'Something broke', { err: 'detail' });

  console.error = originalError;
  assert.equal(output.length, 1);
  assert.ok(output[0].includes('[ERROR]'));
  assert.ok(output[0].includes('[TestComponent]'));
});

test.test('logger outputs ISO timestamp', () => {
  const output: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => output.push(args.join(' '));

  logger.info('Test', 'msg');

  console.log = originalLog;
  const line = output[0];
  // ISO timestamp format: 2026-04-08T10:00:00.000Z
  assert.match(line, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
});

test.test('logger without context has no trailing JSON', () => {
  const output: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => output.push(args.join(' '));

  logger.info('Test', 'msg');

  console.log = originalLog;
  const line = output[0];
  assert.ok(!line.includes('{'), 'Should not include context JSON when no context provided');
});
