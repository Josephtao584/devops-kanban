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

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

class GuardedSessionSegmentRepository extends SessionSegmentRepository {
  override findLatestBySessionId(): Promise<never> {
    throw new Error('findLatestBySessionId should not be used by service create');
  }
}

class BlockingSaveSessionSegmentRepository extends SessionSegmentRepository {
  saveCallCount = 0;
  firstSaveStarted = createDeferred();
  releaseFirstSaveBarrier = createDeferred();

  override async _saveAll(data: any[]) {
    this.saveCallCount += 1;
    if (this.saveCallCount === 1) {
      this.firstSaveStarted.resolve();
      await this.releaseFirstSaveBarrier.promise;
    }
    await super._saveAll(data);
  }

  releaseFirstSave() {
    this.releaseFirstSaveBarrier.resolve();
  }
}

class TrackingUpdateSessionSegmentRepository extends SessionSegmentRepository {
  loadAllCalls = 0;

  override async _loadAll() {
    this.loadAllCalls += 1;
    return await super._loadAll();
  }
}

test.test('SessionSegmentService delegates monotonic segment index allocation to the repository contract and bootstraps the runtime JSON file', async () => {
  const storagePath = await createTempStorageRoot();
  const sessionRepo = new SessionRepository({ storagePath });
  const sessionSegmentRepo = new GuardedSessionSegmentRepository({ storagePath });
  const verificationSegmentRepo = new SessionSegmentRepository({ storagePath });
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

  const latestFirstSessionSegment = await verificationSegmentRepo.findLatestBySessionId(firstSession.id);
  const latestSecondSessionSegment = await verificationSegmentRepo.findLatestBySessionId(secondSession.id);

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

test.test('SessionSegmentRepository queues update behind create for the same file', async () => {
  const storagePath = await createTempStorageRoot();
  const seedRepo = new SessionSegmentRepository({ storagePath });
  const seedSegment = await seedRepo.create({
    session_id: 501,
    status: 'RUNNING',
    executor_type: 'CLAUDE_CODE',
    agent_id: null,
    provider_session_id: null,
    resume_token: null,
    checkpoint_ref: null,
    trigger_type: 'START',
    parent_segment_id: null,
    started_at: '2026-03-23T00:00:00.000Z',
    completed_at: null,
    metadata: { source: 'seed' },
  });

  const createRepo = new BlockingSaveSessionSegmentRepository({ storagePath });
  const updateRepo = new TrackingUpdateSessionSegmentRepository({ storagePath });

  const createPromise = createRepo.create({
    session_id: 501,
    status: 'RUNNING',
    executor_type: 'CLAUDE_CODE',
    agent_id: null,
    provider_session_id: null,
    resume_token: null,
    checkpoint_ref: 'checkpoint-2',
    trigger_type: 'CONTINUE',
    parent_segment_id: seedSegment.id,
    started_at: '2026-03-23T00:05:00.000Z',
    completed_at: null,
    metadata: { source: 'queued-create' },
  });

  await createRepo.firstSaveStarted.promise;

  const updatePromise = updateRepo.update(seedSegment.id, {
    status: 'COMPLETED',
    completed_at: '2026-03-23T00:06:00.000Z',
    metadata: { source: 'queued-update' },
  });

  await Promise.resolve();

  assert.equal(updateRepo.loadAllCalls, 0);

  createRepo.releaseFirstSave();

  const [createdSegment, updatedSegment] = await Promise.all([createPromise, updatePromise]);

  assert.equal(createdSegment.segment_index, 2);
  assert.equal(updatedSegment?.status, 'COMPLETED');
  assert.equal(updatedSegment?.completed_at, '2026-03-23T00:06:00.000Z');

  const persisted = JSON.parse(
    await fs.readFile(path.join(storagePath, 'session_segments.json'), 'utf-8'),
  ) as Array<{
    id: number;
    status: string;
    segment_index: number;
    completed_at: string | null;
  }>;

  assert.equal(persisted.length, 2);
  assert.deepEqual(
    persisted.map((item) => item.segment_index).sort((left, right) => left - right),
    [1, 2],
  );
  const persistedSeedSegment = persisted.find((item) => item.id === seedSegment.id);
  assert.ok(persistedSeedSegment);
  assert.equal(persistedSeedSegment.status, 'COMPLETED');
  assert.equal(persistedSeedSegment.segment_index, 1);
  assert.equal(persistedSeedSegment.completed_at, '2026-03-23T00:06:00.000Z');

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
