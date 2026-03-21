import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { BaseRepository } from '../src/repositories/base.js';
import type { BaseEntity } from '../src/repositories/base.js';

function createTempStorageRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'kanban-repo-'));
}

interface DemoEntity extends BaseEntity {
  name: string;
}

class DemoRepository extends BaseRepository<DemoEntity, { name: string }, { name?: string }> {
  constructor(storagePath: string) {
    super('demo.json', { storagePath });
  }
}

test.test('BaseRepository creates, reads, updates and deletes typed entities', async () => {
  const storagePath = await createTempStorageRoot();
  const repo = new DemoRepository(storagePath);

  const created = await repo.create({ name: 'demo' });
  assert.equal(created.id, 1);
  assert.equal(created.name, 'demo');

  const found = await repo.findById(1);
  assert.equal(found?.name, 'demo');

  const updated = await repo.update(1, { name: 'demo-2' });
  assert.equal(updated?.name, 'demo-2');

  const deleted = await repo.delete(1);
  assert.equal(deleted, true);

  const afterDelete = await repo.findById(1);
  assert.equal(afterDelete, null);

  await fs.rm(storagePath, { recursive: true, force: true });
});

test.test('BaseRepository preserves first write when file initialization races with create', async () => {
  const storagePath = await createTempStorageRoot();
  const repo = new DemoRepository(storagePath);

  const created = await repo.create({ name: 'demo' });
  const found = await repo.findById(created.id);

  assert.equal(found?.name, 'demo');

  await fs.rm(storagePath, { recursive: true, force: true });
});
