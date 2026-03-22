import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

const sourceConfigModuleUrl = pathToFileURL(path.resolve('D:/workspace/devops-kanban/backend/src/config/index.js')).href;
const builtConfigModuleUrl = pathToFileURL(path.resolve('D:/workspace/devops-kanban/backend/dist/src/config/index.js')).href;

test.test('config defaults resolve storage path from backend root sibling data directory', async () => {
  const config = await import(sourceConfigModuleUrl);
  assert.equal(config.STORAGE_PATH.replace(/\\/g, '/').endsWith('/data'), true);
});

test.test('config defaults resolve task source config from backend root sibling task-sources directory', async () => {
  const config = await import(sourceConfigModuleUrl);
  assert.equal(config.TASK_SOURCE_CONFIG_PATH.replace(/\\/g, '/').endsWith('/task-sources/config.yaml'), true);
});

test.test('built config defaults resolve task source config from backend task-sources directory', async () => {
  const config = await import(builtConfigModuleUrl);
  assert.equal(config.TASK_SOURCE_CONFIG_PATH.replace(/\\/g, '/').endsWith('/backend/task-sources/config.yaml'), true);
});
