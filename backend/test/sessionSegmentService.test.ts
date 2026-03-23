import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { SessionRepository } from '../src/repositories/sessionRepository.js';
import { SessionSegmentRepository } from '../src/repositories/sessionSegmentRepository.js';
import { SessionSegmentService } from '../src/services/sessionSegmentService.js';

async function createTempStorageRoot() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'kanban-session-segments-'));
}

async function createSession(sessionRepo: SessionRepository, taskId: number) {
  return await sessionRepo.create({
    task_id: taskId,
    status: 'RUNNING',
    worktree_path: null,
    branch: null,
    initial_prompt: null,
    agent_id: null,
    executor_type: 'CLAUDE_CODE',
    started_at: null,
    completed_at: null,
  });
}

test.test('SessionSegmentService uses the latest stored segment index per session and bootstraps the runtime JSON file', async () => {
  const storagePath = await createTempStorageRoot();
  const sessionRepo = new SessionRepository({ storagePath });
  const sessionSegmentRepo = new SessionSegmentRepository({ storagePath });
  const service = new SessionSegmentService({ sessionRepo, sessionSegmentRepo });

  const firstSession = await createSession(sessionRepo, 101);
  const secondSession = await createSession(sessionRepo, 202);

  const firstSegment = await service.createSegment({
    session_id: firstSession.id,
    status: 'RUNNING',
    executor_type: 'CLAUDE_CODE',
    agent_id: 7,
    provider_session_id: null,
    resume_token: null,
    checkpoint_ref: null,
    trigger_type: 'START',
    parent_segment_id: null,
    started_at: '2026-03-23T00:00:00.000Z',
    completed_at: null,
    metadata: { source: 'test' },
  });
  const secondSegment = await service.createSegment({
    session_id: firstSession.id,
    status: 'RUNNING',
    executor_type: 'CLAUDE_CODE',
    agent_id: 7,
    provider_session_id: null,
    resume_token: null,
    checkpoint_ref: 'checkpoint-2',
    trigger_type: 'CONTINUE',
    parent_segment_id: firstSegment.id,
    started_at: '2026-03-23T00:05:00.000Z',
    completed_at: null,
    metadata: { source: 'test' },
  });
  const otherSessionSegment = await service.createSegment({
    session_id: secondSession.id,
    status: 'RUNNING',
    executor_type: 'CLAUDE_CODE',
    agent_id: null,
    provider_session_id: null,
    resume_token: null,
    checkpoint_ref: null,
    trigger_type: 'START',
    parent_segment_id: null,
    started_at: '2026-03-23T00:10:00.000Z',
    completed_at: null,
    metadata: {},
  });

  assert.equal(firstSegment.segment_index, 1);
  assert.equal(secondSegment.segment_index, 2);
  assert.equal(otherSessionSegment.segment_index, 1);

  const latestFirstSessionSegment = await sessionSegmentRepo.findLatestBySessionId(firstSession.id);
  const latestSecondSessionSegment = await sessionSegmentRepo.findLatestBySessionId(secondSession.id);

  assert.equal(latestFirstSessionSegment?.id, secondSegment.id);
  assert.equal(latestFirstSessionSegment?.segment_index, 2);
  assert.equal(latestSecondSessionSegment?.id, otherSessionSegment.id);
  assert.equal(latestSecondSessionSegment?.segment_index, 1);

  const persisted = JSON.parse(
    await fs.readFile(path.join(storagePath, 'session_segments.json'), 'utf-8'),
  ) as Array<{ session_id: number; segment_index: number }>;

  assert.equal(persisted.length, 3);
  assert.deepEqual(
    persisted
      .filter((item) => item.session_id === firstSession.id)
      .map((item) => item.segment_index),
    [1, 2],
  );

  await fs.rm(storagePath, { recursive: true, force: true });
});

test.test('SessionSegmentService rejects parent segments from another session', async () => {
  const storagePath = await createTempStorageRoot();
  const sessionRepo = new SessionRepository({ storagePath });
  const sessionSegmentRepo = new SessionSegmentRepository({ storagePath });
  const service = new SessionSegmentService({ sessionRepo, sessionSegmentRepo });

  const firstSession = await createSession(sessionRepo, 301);
  const secondSession = await createSession(sessionRepo, 302);
  const parentSegment = await service.createSegment({
    session_id: firstSession.id,
    status: 'COMPLETED',
    executor_type: 'CLAUDE_CODE',
    agent_id: null,
    provider_session_id: null,
    resume_token: null,
    checkpoint_ref: null,
    trigger_type: 'START',
    parent_segment_id: null,
    started_at: '2026-03-23T00:00:00.000Z',
    completed_at: '2026-03-23T00:01:00.000Z',
    metadata: {},
  });

  await assert.rejects(
    () => service.createSegment({
      session_id: secondSession.id,
      status: 'RUNNING',
      executor_type: 'CLAUDE_CODE',
      agent_id: null,
      provider_session_id: null,
      resume_token: null,
      checkpoint_ref: null,
      trigger_type: 'CONTINUE',
      parent_segment_id: parentSegment.id,
      started_at: '2026-03-23T00:02:00.000Z',
      completed_at: null,
      metadata: {},
    }),
    /Parent segment must belong to the same session/,
  );

  await fs.rm(storagePath, { recursive: true, force: true });
});
