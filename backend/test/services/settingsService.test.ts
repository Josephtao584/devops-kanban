import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import { createClient, type Client } from '@libsql/client';
import { migrateSchema } from '../../src/db/migrate.js';
import { SettingsService } from '../../src/services/settingsService.js';
import { SettingsRepository } from '../../src/repositories/settingsRepository.js';

function createTempDb(): { client: Client; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-test-'));
  const client = createClient({ url: `file:${path.join(dir, 'test.db')}` });
  return {
    client,
    cleanup: () => {
      try {
        client.close();
      } catch (_) {
        // Ignore close errors
      }
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (_) {
        // Ignore cleanup errors
      }
    },
  };
}

function extractCreateTableSql(sql: string): string {
  const matches = sql.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+[\s\S]*?\);/gi);
  return matches ? matches.join('\n\n') : '';
}

function extractCreateIndexSql(sql: string): string {
  const matches = sql.match(/CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?\w+\s+ON\s+\w+\([^)]+\);/gi);
  return matches ? matches.join('\n\n') : '';
}

async function setupService(): Promise<{ service: SettingsService; cleanup: () => void }> {
  const { client, cleanup } = createTempDb();

  // Follow the same init pattern as initDatabase() in schema.ts
  const schemaPath = path.join(import.meta.dirname, '../../src/db/schema.sql');
  const schemaSql = await fsPromises.readFile(schemaPath, 'utf-8');

  // 1. Create all tables
  const tableSql = extractCreateTableSql(schemaSql);
  if (tableSql) {
    await client.executeMultiple(tableSql);
  }

  // 2. Run migration diff (add/drop columns)
  await migrateSchema(client, schemaSql);

  // 3. Create indexes
  const indexSql = extractCreateIndexSql(schemaSql);
  if (indexSql) {
    await client.executeMultiple(indexSql);
  }

  const repo = new SettingsRepository({ client });
  const service = new SettingsService({ repo });
  return { service, cleanup };
}

test.test('get returns null for missing key', async () => {
  const { service, cleanup } = await setupService();
  try {
    const result = await service.get('nonexistent.key');
    assert.equal(result, null);
  } finally {
    cleanup();
  }
});

test.test('set and get work correctly', async () => {
  const { service, cleanup } = await setupService();
  try {
    await service.set('test.key', 'test-value');
    const result = await service.get('test.key');
    assert.equal(result, 'test-value');
  } finally {
    cleanup();
  }
});

test.test('getAll returns all settings as object', async () => {
  const { service, cleanup } = await setupService();
  try {
    await service.set('key1', 'value1');
    await service.set('key2', 'value2');

    const result = await service.getAll();
    assert.deepEqual(result, { key1: 'value1', key2: 'value2' });
  } finally {
    cleanup();
  }
});

test.test('setMany updates multiple settings', async () => {
  const { service, cleanup } = await setupService();
  try {
    await service.setMany([
      { key: 'multi.key1', value: 'val1' },
      { key: 'multi.key2', value: 'val2' },
      { key: 'multi.key3', value: 'val3' },
    ]);

    assert.equal(await service.get('multi.key1'), 'val1');
    assert.equal(await service.get('multi.key2'), 'val2');
    assert.equal(await service.get('multi.key3'), 'val3');
  } finally {
    cleanup();
  }
});

test.test('getWorkflowDispatchCron returns default when not set', async () => {
  const { service, cleanup } = await setupService();
  try {
    const result = await service.getWorkflowDispatchCron();
    assert.equal(result, '*/5 * * * *');
  } finally {
    cleanup();
  }
});

test.test('getMaxConcurrentWorkflows returns default when not set', async () => {
  const { service, cleanup } = await setupService();
  try {
    const result = await service.getMaxConcurrentWorkflows();
    assert.equal(result, 3);
  } finally {
    cleanup();
  }
});

test.test('getMaxTasksPerExecution returns default when not set', async () => {
  const { service, cleanup } = await setupService();
  try {
    const result = await service.getMaxTasksPerExecution();
    assert.equal(result, 10);
  } finally {
    cleanup();
  }
});

test.test('getWorkflowDispatchCron returns value when set', async () => {
  const { service, cleanup } = await setupService();
  try {
    await service.set('scheduler.workflow_dispatch_cron', '*/10 * * * *');
    const result = await service.getWorkflowDispatchCron();
    assert.equal(result, '*/10 * * * *');
  } finally {
    cleanup();
  }
});

test.test('getMaxConcurrentWorkflows returns value when set', async () => {
  const { service, cleanup } = await setupService();
  try {
    await service.set('scheduler.max_concurrent_workflows', '5');
    const result = await service.getMaxConcurrentWorkflows();
    assert.equal(result, 5);
  } finally {
    cleanup();
  }
});
