import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { TaskSourceService } from '../../src/services/taskSourceService.js';
import { closeDbClient } from '../../src/db/client.js';
import { initDatabase } from '../../src/db/schema.js';

async function withIsolatedStorage(run: () => Promise<void>) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'task-source-validation-test-'));
  process.env.STORAGE_PATH = tempRoot;
  await closeDbClient();
  await initDatabase();
  try {
    await run();
  } finally {
    await closeDbClient();
    delete process.env.STORAGE_PATH;
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

const longName = 'a'.repeat(201);
const exactName = 'a'.repeat(200);

// ─── create() validation ─────────────────────────────────

test.test('create rejects empty name', async () => {
  await withIsolatedStorage(async () => {
    const service = new TaskSourceService();
    await assert.rejects(
      async () => service.create({
        name: '',
        type: 'github',
        project_id: 1,
        config: {},
        enabled: true,
      }),
      /Task source name is required/
    );
  });
});

test.test('create rejects name exceeding 200 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new TaskSourceService();
    await assert.rejects(
      async () => service.create({
        name: longName,
        type: 'github',
        project_id: 1,
        config: {},
        enabled: true,
      }),
      /Task source name exceeds maximum length of 200 characters/
    );
  });
});

test.test('create accepts name at exactly 200 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new TaskSourceService();
    const source = await service.create({
      name: exactName,
      type: 'github',
      project_id: 1,
      config: {},
      enabled: true,
    });
    assert.equal(source.name, exactName);
  });
});

// ─── update() validation ─────────────────────────────────

test.test('update rejects empty name', async () => {
  await withIsolatedStorage(async () => {
    const service = new TaskSourceService();
    const source = await service.create({
      name: 'original',
      type: 'github',
      project_id: 1,
      config: {},
      enabled: true,
    });
    await assert.rejects(
      async () => service.update(String(source.id), { name: '' }),
      /Task source name is required/
    );
  });
});

test.test('update rejects name exceeding 200 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new TaskSourceService();
    const source = await service.create({
      name: 'original',
      type: 'github',
      project_id: 1,
      config: {},
      enabled: true,
    });
    await assert.rejects(
      async () => service.update(String(source.id), { name: longName }),
      /Task source name exceeds maximum length of 200 characters/
    );
  });
});

test.test('update accepts name at exactly 200 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new TaskSourceService();
    const source = await service.create({
      name: 'original',
      type: 'github',
      project_id: 1,
      config: {},
      enabled: true,
    });
    const updated = await service.update(String(source.id), { name: exactName });
    assert.ok(updated);
    assert.equal(updated!.name, exactName);
  });
});
