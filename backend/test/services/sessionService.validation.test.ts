import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { SessionService } from '../../src/services/sessionService.js';
import { SessionRepository } from '../../src/repositories/sessionRepository.js';
import { ExecutorType } from '../../src/types/executors.js';
import { closeDbClient } from '../../src/db/client.js';
import { initDatabase } from '../../src/db/schema.js';

async function withIsolatedStorage(run: () => Promise<void>) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'session-validation-test-'));
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

const longInput = 'x'.repeat(5001);

test.test('continue rejects input exceeding 5000 characters', async () => {
  await withIsolatedStorage(async () => {
    const sessionRepo = new SessionRepository();
    const session = await sessionRepo.create({
      task_id: 1,
      status: 'STOPPED',
      executor_type: ExecutorType.CLAUDE_CODE,
    });

    const service = new SessionService();
    await assert.rejects(
      async () => service.continue(session.id, longInput),
      /Input exceeds maximum length of 5000 characters/
    );
  });
});

test.test('continue accepts input at exactly 5000 characters', async () => {
  await withIsolatedStorage(async () => {
    const sessionRepo = new SessionRepository();
    // Create a fake worktree directory so the validation passes
    const fakeWorktree = path.join(os.tmpdir(), 'session-validation-fake-worktree');
    await fs.mkdir(fakeWorktree, { recursive: true });
    try {
      const session = await sessionRepo.create({
        task_id: 1,
        status: 'STOPPED',
        executor_type: ExecutorType.CLAUDE_CODE,
        worktree_path: fakeWorktree,
      });

      const validInput = 'x'.repeat(5000);
      const service = new SessionService();
      // continue() returns early (background execution), should not throw
      const result = await service.continue(session.id, validInput);
      assert.ok(result);
    } finally {
      await fs.rm(fakeWorktree, { recursive: true, force: true });
    }
  });
});
