import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';

import { SessionRepository } from '../src/repositories/sessionRepository.js';
import { SessionSegmentRepository } from '../src/repositories/sessionSegmentRepository.js';
import { SessionEventRepository } from '../src/repositories/sessionEventRepository.js';
import { SessionService } from '../src/services/sessionService.js';

async function createTempStorageRoot() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'kanban-session-service-'));
}

async function createWorktreeDir() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'kanban-session-worktree-'));
}

async function waitFor(assertion: () => Promise<void> | void, timeoutMs = 1500) {
  const startedAt = Date.now();

  while (true) {
    try {
      await assertion();
      return;
    } catch (error) {
      if (Date.now() - startedAt >= timeoutMs) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
}

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  stdin = {
    writable: true,
    write() {
      return true;
    },
  };

  override on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  emitStdout(text: string) {
    this.stdout.emit('data', Buffer.from(text));
  }

  emitStderr(text: string) {
    this.stderr.emit('data', Buffer.from(text));
  }

  finish(code = 0) {
    this.emit('close', code);
  }
}

test.test('SessionService start persists stream history as session events and leaves sessions without output snapshots', async () => {
  const storagePath = await createTempStorageRoot();
  const worktreePath = await createWorktreeDir();

  try {
    const sessionRepo = new SessionRepository({ storagePath });
    const sessionSegmentRepo = new SessionSegmentRepository({ storagePath });
    const sessionEventRepo = new SessionEventRepository({ storagePath });

    const session = await sessionRepo.create({
      task_id: 901,
      status: 'STOPPED',
      worktree_path: worktreePath,
      branch: 'task/project/901',
      initial_prompt: 'Implement the requested fix',
      agent_id: 12,
      executor_type: 'CLAUDE_CODE',
      started_at: null,
      completed_at: null,
    });

    const proc = new FakeChildProcess();
    const service = new SessionService() as SessionService & {
      sessionSegmentRepo: SessionSegmentRepository;
      sessionEventRepo: SessionEventRepository;
      taskService: { getById(taskId: number): Promise<{ id: number; title: string; description: string }> };
      _spawnClaudeCode: (...args: unknown[]) => ChildProcess;
    };

    service.sessionRepo = sessionRepo;
    service.sessionSegmentRepo = sessionSegmentRepo;
    service.sessionEventRepo = sessionEventRepo;
    service.taskService = {
      async getById(taskId: number) {
        return {
          id: taskId,
          title: 'Task 901',
          description: 'Implement the requested fix',
        };
      },
    };
    service._spawnClaudeCode = () => proc as unknown as ChildProcess;

    await service.start(session.id);

    proc.emitStdout('alpha\nbeta\n');
    proc.emitStderr('warn from stderr');
    proc.finish(0);

    await waitFor(async () => {
      const persistedSession = await sessionRepo.findById(session.id);
      assert.equal(persistedSession?.status, 'COMPLETED');

      const segments = await sessionSegmentRepo.findBySessionId(session.id);
      assert.equal(segments.length, 1);
      assert.equal(segments[0]?.trigger_type, 'START');
      assert.equal(segments[0]?.parent_segment_id, null);

      const events = await sessionEventRepo.listBySessionId(session.id);
      assert.deepEqual(
        events.map((event) => ({
          kind: event.kind,
          content: event.content,
          stream: event.payload.stream,
          segment_id: event.segment_id,
        })),
        [
          {
            kind: 'stream_chunk',
            content: 'alpha',
            stream: 'stdout',
            segment_id: segments[0]!.id,
          },
          {
            kind: 'stream_chunk',
            content: 'beta',
            stream: 'stdout',
            segment_id: segments[0]!.id,
          },
          {
            kind: 'stream_chunk',
            content: 'warn from stderr',
            stream: 'stderr',
            segment_id: segments[0]!.id,
          },
        ],
      );
    });

    const persistedSessions = JSON.parse(
      await fs.readFile(path.join(storagePath, 'sessions.json'), 'utf-8'),
    ) as Array<Record<string, unknown>>;
    assert.equal('output' in persistedSessions[0]!, false);
  } finally {
    await fs.rm(storagePath, { recursive: true, force: true });
    await fs.rm(worktreePath, { recursive: true, force: true });
  }
});

test.test('SessionService continue creates a child segment and attaches resumed events to it', async () => {
  const storagePath = await createTempStorageRoot();
  const worktreePath = await createWorktreeDir();

  try {
    const sessionRepo = new SessionRepository({ storagePath });
    const sessionSegmentRepo = new SessionSegmentRepository({ storagePath });
    const sessionEventRepo = new SessionEventRepository({ storagePath });

    const session = await sessionRepo.create({
      task_id: 902,
      status: 'STOPPED',
      worktree_path: worktreePath,
      branch: 'task/project/902',
      initial_prompt: 'Initial prompt',
      agent_id: 14,
      executor_type: 'CLAUDE_CODE',
      started_at: null,
      completed_at: null,
    });

    const firstSegment = await sessionSegmentRepo.create({
      session_id: session.id,
      status: 'COMPLETED',
      executor_type: 'CLAUDE_CODE',
      agent_id: 14,
      provider_session_id: null,
      resume_token: null,
      checkpoint_ref: null,
      trigger_type: 'START',
      parent_segment_id: null,
      started_at: '2026-03-23T00:00:00.000Z',
      completed_at: '2026-03-23T00:01:00.000Z',
      metadata: { source: 'seed-start' },
    });

    const proc = new FakeChildProcess();
    const service = new SessionService() as SessionService & {
      sessionSegmentRepo: SessionSegmentRepository;
      sessionEventRepo: SessionEventRepository;
      _spawnClaudeCode: (...args: unknown[]) => ChildProcess;
    };

    service.sessionRepo = sessionRepo;
    service.sessionSegmentRepo = sessionSegmentRepo;
    service.sessionEventRepo = sessionEventRepo;
    service._spawnClaudeCode = () => proc as unknown as ChildProcess;

    await service.continue(session.id, 'Apply the review feedback');

    proc.emitStdout('resumed output\n');
    proc.finish(0);

    await waitFor(async () => {
      const segments = await sessionSegmentRepo.findBySessionId(session.id);
      assert.equal(segments.length, 2);

      const resumedSegment = segments[1]!;
      assert.equal(resumedSegment.trigger_type, 'CONTINUE');
      assert.equal(resumedSegment.parent_segment_id, firstSegment.id);

      const events = await sessionEventRepo.listBySessionId(session.id);
      assert.deepEqual(
        events.map((event) => ({
          kind: event.kind,
          content: event.content,
          stream: event.payload.stream,
          segment_id: event.segment_id,
        })),
        [
          {
            kind: 'stream_chunk',
            content: 'resumed output',
            stream: 'stdout',
            segment_id: resumedSegment.id,
          },
        ],
      );
    });
  } finally {
    await fs.rm(storagePath, { recursive: true, force: true });
    await fs.rm(worktreePath, { recursive: true, force: true });
  }
});

test.test('SessionService listEvents returns the planned envelope with pagination metadata', async () => {
  const storagePath = await createTempStorageRoot();

  try {
    const sessionRepo = new SessionRepository({ storagePath });
    const sessionEventRepo = new SessionEventRepository({ storagePath });

    const session = await sessionRepo.create({
      task_id: 903,
      status: 'STOPPED',
      worktree_path: null,
      branch: 'task/project/903',
      initial_prompt: 'List events',
      agent_id: null,
      executor_type: 'CLAUDE_CODE',
      started_at: null,
      completed_at: null,
    });

    await sessionEventRepo.append({
      session_id: session.id,
      segment_id: 1,
      kind: 'stream_chunk',
      role: 'assistant',
      content: 'alpha',
      payload: { stream: 'stdout' },
    });
    await sessionEventRepo.append({
      session_id: session.id,
      segment_id: 1,
      kind: 'stream_chunk',
      role: 'assistant',
      content: 'beta',
      payload: { stream: 'stdout' },
    });
    await sessionEventRepo.append({
      session_id: session.id,
      segment_id: 1,
      kind: 'stream_chunk',
      role: 'assistant',
      content: 'gamma',
      payload: { stream: 'stdout' },
    });

    const service = new SessionService();
    service.sessionRepo = sessionRepo;
    service.sessionEventRepo = sessionEventRepo;

    const page = await service.listEvents(session.id, { afterSeq: 1, limit: 1 });

    assert.deepEqual(page, {
      events: [
        {
          id: 2,
          session_id: session.id,
          segment_id: 1,
          seq: 2,
          kind: 'stream_chunk',
          role: 'assistant',
          content: 'beta',
          payload: { stream: 'stdout' },
          created_at: page.events[0]?.created_at,
          updated_at: page.events[0]?.updated_at,
        },
      ],
      last_seq: 3,
      has_more: true,
    });
  } finally {
    await fs.rm(storagePath, { recursive: true, force: true });
  }
});

test.test('SessionService listEvents returns empty events with zero metadata for a session with no events', async () => {
  const storagePath = await createTempStorageRoot();

  try {
    const sessionRepo = new SessionRepository({ storagePath });
    const sessionEventRepo = new SessionEventRepository({ storagePath });

    const session = await sessionRepo.create({
      task_id: 904,
      status: 'STOPPED',
      worktree_path: null,
      branch: 'task/project/904',
      initial_prompt: 'No events yet',
      agent_id: null,
      executor_type: 'CLAUDE_CODE',
      started_at: null,
      completed_at: null,
    });

    const service = new SessionService();
    service.sessionRepo = sessionRepo;
    service.sessionEventRepo = sessionEventRepo;

    const page = await service.listEvents(session.id);

    assert.deepEqual(page, {
      events: [],
      last_seq: 0,
      has_more: false,
    });
  } finally {
    await fs.rm(storagePath, { recursive: true, force: true });
  }
});
