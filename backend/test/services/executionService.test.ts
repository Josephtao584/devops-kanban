import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { ExecutionService } from '../../src/services/executionService.js';
import { SessionRepository } from '../../src/repositories/sessionRepository.js';
import { closeDbClient } from '../../src/db/client.js';
import { initDatabase } from '../../src/db/schema.js';
import { ExecutorType } from '../../src/types/executors.js';

const origStorage = process.env.STORAGE_PATH;

async function withIsolatedStorage(run: (tempRoot: string) => Promise<void>) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'execution-service-test-'));
  process.env.STORAGE_PATH = tempRoot;
  await closeDbClient();
  await initDatabase();
  try {
    await run(tempRoot);
  } finally {
    await closeDbClient();
    if (origStorage === undefined) {
      delete process.env.STORAGE_PATH;
    } else {
      process.env.STORAGE_PATH = origStorage;
    }
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

test.test('getAll returns empty list initially', async () => {
  await withIsolatedStorage(async () => {
    const service = new ExecutionService();
    const results = await service.getAll();
    assert.deepEqual(results, []);
  });
});

test.test('create creates execution with auto-derived task_id from session', async () => {
  await withIsolatedStorage(async () => {
    const sessionRepo = new SessionRepository();
    const session = await sessionRepo.create({
      task_id: 42,
      executor_type: ExecutorType.CLAUDE_CODE,
      status: 'RUNNING',
    });

    const service = new ExecutionService();
    const execution = await service.create({
      session_id: session.id,
    });

    assert.ok(execution.id);
    assert.equal(execution.session_id, session.id);
    assert.equal(execution.task_id, 42);
  });
});

test.test('create throws NotFoundError when session does not exist', async () => {
  await withIsolatedStorage(async () => {
    const service = new ExecutionService();
    try {
      await service.create({ session_id: 99999 });
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err instanceof Error);
      assert.ok((err as Error).message.includes('Session not found'));
    }
  });
});

test.test('getById returns execution by id', async () => {
  await withIsolatedStorage(async () => {
    const sessionRepo = new SessionRepository();
    const session = await sessionRepo.create({
      task_id: 1,
      executor_type: ExecutorType.CLAUDE_CODE,
      status: 'RUNNING',
    });

    const service = new ExecutionService();
    const created = await service.create({ session_id: session.id });

    const found = await service.getById(created.id);
    assert.ok(found);
    assert.equal(found!.id, created.id);
    assert.equal(found!.session_id, session.id);
  });
});

test.test('getById returns null for non-existent id', async () => {
  await withIsolatedStorage(async () => {
    const service = new ExecutionService();
    const result = await service.getById(99999);
    assert.equal(result, null);
  });
});

test.test('getBySession returns executions filtered by session', async () => {
  await withIsolatedStorage(async () => {
    const sessionRepo = new SessionRepository();
    const session1 = await sessionRepo.create({
      task_id: 1,
      executor_type: ExecutorType.CLAUDE_CODE,
      status: 'RUNNING',
    });
    const session2 = await sessionRepo.create({
      task_id: 2,
      executor_type: ExecutorType.CLAUDE_CODE,
      status: 'RUNNING',
    });

    const service = new ExecutionService();
    await service.create({ session_id: session1.id });
    await service.create({ session_id: session1.id });
    await service.create({ session_id: session2.id });

    const bySession1 = await service.getBySession(session1.id);
    assert.equal(bySession1.length, 2);

    const bySession2 = await service.getBySession(session2.id);
    assert.equal(bySession2.length, 1);
  });
});

test.test('getByTask returns executions filtered by task', async () => {
  await withIsolatedStorage(async () => {
    const sessionRepo = new SessionRepository();
    const session1 = await sessionRepo.create({
      task_id: 10,
      executor_type: ExecutorType.CLAUDE_CODE,
      status: 'RUNNING',
    });
    const session2 = await sessionRepo.create({
      task_id: 20,
      executor_type: ExecutorType.CLAUDE_CODE,
      status: 'RUNNING',
    });

    const service = new ExecutionService();
    await service.create({ session_id: session1.id });
    await service.create({ session_id: session2.id });

    const byTask10 = await service.getByTask(10);
    assert.equal(byTask10.length, 1);
    assert.equal(byTask10[0]!.task_id, 10);

    const byTask20 = await service.getByTask(20);
    assert.equal(byTask20.length, 1);
    assert.equal(byTask20[0]!.task_id, 20);
  });
});

test.test('update modifies execution', async () => {
  await withIsolatedStorage(async () => {
    const sessionRepo = new SessionRepository();
    const session = await sessionRepo.create({
      task_id: 1,
      executor_type: ExecutorType.CLAUDE_CODE,
      status: 'RUNNING',
    });

    const service = new ExecutionService();
    const created = await service.create({ session_id: session.id });

    const updated = await service.update(created.id, {
      task_id: 99,
    });

    assert.ok(updated);
    assert.equal(updated!.task_id, 99);
  });
});

test.test('update returns null for non-existent id', async () => {
  await withIsolatedStorage(async () => {
    const service = new ExecutionService();
    const result = await service.update(99999, { task_id: 99 });
    assert.equal(result, null);
  });
});

test.test('delete removes execution', async () => {
  await withIsolatedStorage(async () => {
    const sessionRepo = new SessionRepository();
    const session = await sessionRepo.create({
      task_id: 1,
      executor_type: ExecutorType.CLAUDE_CODE,
      status: 'RUNNING',
    });

    const service = new ExecutionService();
    const created = await service.create({ session_id: session.id });

    const deleted = await service.delete(created.id);
    assert.equal(deleted, true);

    const found = await service.getById(created.id);
    assert.equal(found, null);
  });
});

test.test('delete returns false for non-existent id', async () => {
  await withIsolatedStorage(async () => {
    const service = new ExecutionService();
    const result = await service.delete(99999);
    assert.equal(result, false);
  });
});
