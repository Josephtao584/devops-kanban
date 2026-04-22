import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { SessionService } from '../../src/services/sessionService.js';
import { SessionRepository } from '../../src/repositories/sessionRepository.js';
import { SessionEventRepository } from '../../src/repositories/sessionEventRepository.js';
import { ExecutorType } from '../../src/types/executors.js';
import { closeDbClient } from '../../src/db/client.js';
import { initDatabase } from '../../src/db/schema.js';

async function withIsolatedStorage(run: () => Promise<void>) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ask-user-session-test-'));
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

test.test('continue on ASK_USER session saves message without starting executor', async () => {
  await withIsolatedStorage(async () => {
    const sessionRepo = new SessionRepository();
    const session = await sessionRepo.create({
      task_id: 1,
      status: 'ASK_USER',
      executor_type: ExecutorType.CLAUDE_CODE,
    });

    const service = new SessionService();
    const result = await service.continue(session.id, 'my answer');

    // Session status should be RUNNING (not executing, just signaling step to continue)
    assert.ok(result);
    assert.equal(result!.status, 'RUNNING');

    // Verify the user message was saved as a session event
    const eventRepo = new SessionEventRepository();
    const events = await eventRepo.listBySessionId(session.id);
    const userMsg = events.find((e: any) => e.kind === 'message' && e.role === 'user');
    assert.ok(userMsg, 'User message should be saved as a session event');
    assert.equal(userMsg!.content, 'my answer');
  });
});

test.test('continue on ASK_USER session does not create new segment', async () => {
  await withIsolatedStorage(async () => {
    const sessionRepo = new SessionRepository();
    const session = await sessionRepo.create({
      task_id: 1,
      status: 'ASK_USER',
      executor_type: ExecutorType.CLAUDE_CODE,
    });

    const service = new SessionService();
    const result = await service.continue(session.id, 'my answer');

    // Should return quickly without creating execution segments
    assert.ok(result);
    // completed_at should not be set (session is RUNNING, not completed)
    assert.equal(result!.completed_at, null);
  });
});

test.test('continue on ASK_USER session rejects input exceeding 5000 characters', async () => {
  await withIsolatedStorage(async () => {
    const sessionRepo = new SessionRepository();
    const session = await sessionRepo.create({
      task_id: 1,
      status: 'ASK_USER',
      executor_type: ExecutorType.CLAUDE_CODE,
    });

    const service = new SessionService();
    const longInput = 'x'.repeat(5001);
    await assert.rejects(
      async () => service.continue(session.id, longInput),
      /Input exceeds maximum length of 5000 characters/
    );
  });
});
