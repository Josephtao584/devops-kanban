import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

const sourceConfigModuleUrl = pathToFileURL(
  path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '../../src/config/index.ts')
).href;

test.test('config defaults resolve storage path from project root data directory', async () => {
  const config = await import(sourceConfigModuleUrl);
  assert.equal(config.STORAGE_PATH.replace(/\\/g, '/').endsWith('/data'), true);
});

test.test('config defaults resolve task source config from backend task-sources directory', async () => {
  const config = await import(sourceConfigModuleUrl);
  assert.equal(config.TASK_SOURCE_CONFIG_PATH.replace(/\\/g, '/').endsWith('/backend/task-sources/config.yaml'), true);
});
