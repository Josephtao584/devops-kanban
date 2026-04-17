import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { ProjectService } from '../../src/services/projectService.js';
import { closeDbClient } from '../../src/db/client.js';
import { initDatabase } from '../../src/db/schema.js';

async function withIsolatedStorage(run: (tempRoot: string) => Promise<void>) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'project-service-validation-test-'));
  process.env.STORAGE_PATH = tempRoot;
  await closeDbClient();
  await initDatabase();
  try {
    await run(tempRoot);
  } finally {
    await closeDbClient();
    delete process.env.STORAGE_PATH;
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

const longName = 'a'.repeat(201);
const exactName = 'a'.repeat(200);
const longDesc = 'b'.repeat(5001);
const exactDesc = 'b'.repeat(5000);
const longUrl = 'https://example.com/' + 'x'.repeat(1985);
const exactUrl = 'https://example.com/' + 'x'.repeat(1980);

// ─── create() validation ─────────────────────────────────

test.test('create rejects name exceeding 200 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new ProjectService();
    await assert.rejects(
      async () => service.create({ name: longName }),
      /Project name exceeds maximum length of 200 characters/
    );
  });
});

test.test('create rejects empty name', async () => {
  await withIsolatedStorage(async () => {
    const service = new ProjectService();
    await assert.rejects(
      async () => service.create({ name: '' }),
      /Project name is required/
    );
  });
});

test.test('create accepts name at exactly 200 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new ProjectService();
    const project = await service.create({ name: exactName });
    assert.equal(project.name, exactName);
  });
});

test.test('create rejects description exceeding 5000 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new ProjectService();
    await assert.rejects(
      async () => service.create({ name: 'Valid', description: longDesc }),
      /Project description exceeds maximum length of 5000 characters/
    );
  });
});

test.test('create accepts description at exactly 5000 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new ProjectService();
    const project = await service.create({ name: 'Valid', description: exactDesc });
    assert.equal(project.description, exactDesc);
  });
});

test.test('create rejects git_url exceeding 2000 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new ProjectService();
    await assert.rejects(
      async () => service.create({ name: 'Valid', git_url: longUrl }),
      /Git URL exceeds maximum length of 2000 characters/
    );
  });
});

test.test('create accepts git_url at exactly 2000 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new ProjectService();
    const project = await service.create({ name: 'Valid', git_url: exactUrl });
    assert.equal(project.git_url, exactUrl);
  });
});

test.test('create rejects local_path exceeding 2000 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new ProjectService();
    const longPath = '/tmp/' + 'x'.repeat(1996);
    await assert.rejects(
      async () => service.create({ name: 'Valid', local_path: longPath }),
      /Local path exceeds maximum length of 2000 characters/
    );
  });
});

// ─── update() validation ─────────────────────────────────

test.test('update rejects name exceeding 200 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new ProjectService();
    const project = await service.create({ name: 'Original' });
    await assert.rejects(
      async () => service.update(project.id, { name: longName }),
      /Project name exceeds maximum length of 200 characters/
    );
  });
});

test.test('update rejects empty name', async () => {
  await withIsolatedStorage(async () => {
    const service = new ProjectService();
    const project = await service.create({ name: 'Original' });
    await assert.rejects(
      async () => service.update(project.id, { name: '   ' }),
      /Project name is required/
    );
  });
});

test.test('update accepts name at exactly 200 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new ProjectService();
    const project = await service.create({ name: 'Original' });
    const updated = await service.update(project.id, { name: exactName });
    assert.equal(updated!.name, exactName);
  });
});

test.test('update rejects description exceeding 5000 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new ProjectService();
    const project = await service.create({ name: 'Original' });
    await assert.rejects(
      async () => service.update(project.id, { description: longDesc }),
      /Project description exceeds maximum length of 5000 characters/
    );
  });
});

test.test('update accepts description at exactly 5000 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new ProjectService();
    const project = await service.create({ name: 'Original' });
    const updated = await service.update(project.id, { description: exactDesc });
    assert.equal(updated!.description, exactDesc);
  });
});

test.test('update rejects git_url exceeding 2000 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new ProjectService();
    const project = await service.create({ name: 'Original' });
    await assert.rejects(
      async () => service.update(project.id, { git_url: longUrl }),
      /Git URL exceeds maximum length of 2000 characters/
    );
  });
});

test.test('update allows null git_url', async () => {
  await withIsolatedStorage(async () => {
    const service = new ProjectService();
    const project = await service.create({ name: 'Original', git_url: 'https://example.com' });
    const updated = await service.update(project.id, { git_url: null });
    assert.equal(updated!.git_url, null);
  });
});

test.test('update rejects local_path exceeding 2000 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new ProjectService();
    const project = await service.create({ name: 'Original' });
    const longPath = '/tmp/' + 'x'.repeat(1996);
    await assert.rejects(
      async () => service.update(project.id, { local_path: longPath }),
      /Local path exceeds maximum length of 2000 characters/
    );
  });
});
