import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { SessionRepository } from '../src/repositories/sessionRepository.js';
import { SessionSegmentRepository } from '../src/repositories/sessionSegmentRepository.js';
import { SessionEventRepository } from '../src/repositories/sessionEventRepository.js';
import { SessionSegmentService } from '../src/services/sessionSegmentService.js';
import { SessionEventService } from '../src/services/sessionEventService.js';

async function createTempStorageRoot() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'kanban-session-events-'));
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

async function createSegment(sessionSegmentService: SessionSegmentService, sessionId: number) {
  return await sessionSegmentService.createSegment({
    session_id: sessionId,
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
    metadata: {},
  });
}

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

class GuardedSessionEventRepository extends SessionEventRepository {
  override getLastSeq(): Promise<number> {
    throw new Error('getLastSeq should not be used by service append');
  }
}

class BlockingSaveSessionEventRepository extends SessionEventRepository {
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

class TrackingUpdateSessionEventRepository extends SessionEventRepository {
  loadAllCalls = 0;

  override async _loadAll() {
    this.loadAllCalls += 1;
    return await super._loadAll();
  }
}

test.test('SessionEventService delegates monotonic seq allocation to the repository contract and bootstraps the runtime JSON file', async () => {
  const storagePath = await createTempStorageRoot();
  const sessionRepo = new SessionRepository({ storagePath });
  const sessionSegmentRepo = new SessionSegmentRepository({ storagePath });
  const sessionEventRepo = new GuardedSessionEventRepository({ storagePath });
  const verificationEventRepo = new SessionEventRepository({ storagePath });
  const sessionSegmentService = new SessionSegmentService({ sessionRepo, sessionSegmentRepo });
  const service = new SessionEventService({
    sessionRepo,
    sessionSegmentRepo,
    sessionEventRepo,
  });

  const session = await createSession(sessionRepo, 401);
  const segment = await createSegment(sessionSegmentService, session.id);

  const firstEvent = await service.appendEvent({
    session_id: session.id,
    segment_id: segment.id,
    kind: 'stream_chunk',
    role: 'assistant',
    content: 'first',
    payload: { chunk: 1 },
  });
  const secondEvent = await service.appendEvent({
    session_id: session.id,
    segment_id: segment.id,
    kind: 'stream_chunk',
    role: 'assistant',
    content: 'second',
    payload: { chunk: 2 },
  });

  assert.equal(firstEvent.seq, 1);
  assert.equal(secondEvent.seq, 2);
  assert.equal(await verificationEventRepo.getLastSeq(session.id), 2);

  const persisted = JSON.parse(
    await fs.readFile(path.join(storagePath, 'session_events.json'), 'utf-8'),
  ) as Array<{ seq: number }>;
  assert.deepEqual(persisted.map((item) => item.seq), [1, 2]);

  await fs.rm(storagePath, { recursive: true, force: true });
});

test.test('SessionEventRepository queues update behind append for the same file', async () => {
  const storagePath = await createTempStorageRoot();
  const seedRepo = new SessionEventRepository({ storagePath });
  const seedEvent = await seedRepo.append({
    session_id: 601,
    segment_id: 1,
    kind: 'message',
    role: 'assistant',
    content: 'seed',
    payload: { source: 'seed' },
  });

  const appendRepo = new BlockingSaveSessionEventRepository({ storagePath });
  const updateRepo = new TrackingUpdateSessionEventRepository({ storagePath });

  const appendPromise = appendRepo.append({
    session_id: 601,
    segment_id: 1,
    kind: 'stream_chunk',
    role: 'assistant',
    content: 'queued append',
    payload: { source: 'queued-append' },
  });

  await appendRepo.firstSaveStarted.promise;

  const updatePromise = updateRepo.update(seedEvent.id, {
    kind: 'status',
    content: 'updated',
    payload: { source: 'queued-update' },
  });

  await Promise.resolve();

  assert.equal(updateRepo.loadAllCalls, 0);

  appendRepo.releaseFirstSave();

  const [appendedEvent, updatedEvent] = await Promise.all([appendPromise, updatePromise]);

  assert.equal(appendedEvent.seq, 2);
  assert.equal(updatedEvent?.kind, 'status');
  assert.equal(updatedEvent?.content, 'updated');

  const persisted = JSON.parse(
    await fs.readFile(path.join(storagePath, 'session_events.json'), 'utf-8'),
  ) as Array<{
    id: number;
    seq: number;
    kind: string;
    content: string;
  }>;

  assert.deepEqual(
    persisted.map((item) => item.seq).sort((left, right) => left - right),
    [1, 2],
  );
  const persistedSeedEvent = persisted.find((item) => item.id === seedEvent.id);
  assert.ok(persistedSeedEvent);
  assert.equal(persistedSeedEvent.seq, 1);
  assert.equal(persistedSeedEvent.kind, 'status');
  assert.equal(persistedSeedEvent.content, 'updated');

  await fs.rm(storagePath, { recursive: true, force: true });
});

test.test('SessionEventService lists events after after_seq exclusively in ascending seq order', async () => {
  const storagePath = await createTempStorageRoot();
  const sessionRepo = new SessionRepository({ storagePath });
  const sessionSegmentRepo = new SessionSegmentRepository({ storagePath });
  const sessionEventRepo = new SessionEventRepository({ storagePath });
  const sessionSegmentService = new SessionSegmentService({ sessionRepo, sessionSegmentRepo });
  const service = new SessionEventService({
    sessionRepo,
    sessionSegmentRepo,
    sessionEventRepo,
  });

  const session = await createSession(sessionRepo, 402);
  const segment = await createSegment(sessionSegmentService, session.id);

  await fs.writeFile(
    path.join(storagePath, 'session_events.json'),
    JSON.stringify(
      [
        {
          id: 1,
          session_id: session.id,
          segment_id: segment.id,
          seq: 3,
          kind: 'stream_chunk',
          role: 'assistant',
          content: 'third',
          payload: { order: 3 },
          created_at: '2026-03-23T00:00:03.000Z',
          updated_at: '2026-03-23T00:00:03.000Z',
        },
        {
          id: 2,
          session_id: session.id,
          segment_id: segment.id,
          seq: 1,
          kind: 'message',
          role: 'assistant',
          content: 'first',
          payload: { order: 1 },
          created_at: '2026-03-23T00:00:01.000Z',
          updated_at: '2026-03-23T00:00:01.000Z',
        },
        {
          id: 3,
          session_id: session.id,
          segment_id: segment.id,
          seq: 2,
          kind: 'status',
          role: 'system',
          content: 'second',
          payload: { order: 2 },
          created_at: '2026-03-23T00:00:02.000Z',
          updated_at: '2026-03-23T00:00:02.000Z',
        },
      ],
      null,
      2,
    ),
    'utf-8',
  );

  const events = await service.listEvents(session.id, { afterSeq: 1 });

  assert.deepEqual(events.map((event) => event.seq), [2, 3]);
  assert.deepEqual(events.map((event) => event.content), ['second', 'third']);

  await fs.rm(storagePath, { recursive: true, force: true });
});

test.test('SessionEventService rejects events whose segment belongs to another session', async () => {
  const storagePath = await createTempStorageRoot();
  const sessionRepo = new SessionRepository({ storagePath });
  const sessionSegmentRepo = new SessionSegmentRepository({ storagePath });
  const sessionEventRepo = new SessionEventRepository({ storagePath });
  const sessionSegmentService = new SessionSegmentService({ sessionRepo, sessionSegmentRepo });
  const service = new SessionEventService({
    sessionRepo,
    sessionSegmentRepo,
    sessionEventRepo,
  });

  const firstSession = await createSession(sessionRepo, 403);
  const secondSession = await createSession(sessionRepo, 404);
  const segment = await createSegment(sessionSegmentService, firstSession.id);

  await assert.rejects(
    () => service.appendEvent({
      session_id: secondSession.id,
      segment_id: segment.id,
      kind: 'error',
      role: 'system',
      content: 'wrong session',
      payload: {},
    }),
    /Segment must belong to the same session/,
  );

  await fs.rm(storagePath, { recursive: true, force: true });
});
