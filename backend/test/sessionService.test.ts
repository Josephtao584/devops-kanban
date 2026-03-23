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

    proc.emitStdout('alpha\n\nbeta\n  indented line\n');
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
            content: 'alpha\n\nbeta\n  indented line\n',
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
      const persistedSession = await sessionRepo.findById(session.id);
      assert.equal(persistedSession?.status, 'COMPLETED');

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
            content: 'resumed output\n',
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

test.test('SessionService start rejects when the worktree path does not exist', async () => {
  const storagePath = await createTempStorageRoot();
  const missingWorktreePath = path.join(storagePath, 'missing-worktree');

  try {
    const sessionRepo = new SessionRepository({ storagePath });
    const sessionSegmentRepo = new SessionSegmentRepository({ storagePath });

    const session = await sessionRepo.create({
      task_id: 906,
      status: 'STOPPED',
      worktree_path: missingWorktreePath,
      branch: 'task/project/906',
      initial_prompt: 'Start only when worktree exists',
      agent_id: null,
      executor_type: 'CLAUDE_CODE',
      started_at: null,
      completed_at: null,
    });

    let spawnCalled = false;
    const service = new SessionService() as SessionService & {
      sessionSegmentRepo: SessionSegmentRepository;
      taskService: { getById(taskId: number): Promise<{ id: number; title: string; description: string }> };
      _spawnClaudeCode: (...args: unknown[]) => ChildProcess;
    };

    service.sessionRepo = sessionRepo;
    service.sessionSegmentRepo = sessionSegmentRepo;
    service.taskService = {
      async getById(taskId: number) {
        return {
          id: taskId,
          title: 'Task 906',
          description: 'Start only when worktree exists',
        };
      },
    };
    service._spawnClaudeCode = () => {
      spawnCalled = true;
      throw new Error('spawn should not be called');
    };

    await assert.rejects(
      () => service.start(session.id),
      (error: unknown) => error instanceof Error && error.message === 'Session worktree is unavailable' && 'statusCode' in error && error.statusCode === 409,
    );

    const persistedSession = await sessionRepo.findById(session.id);
    const segments = await sessionSegmentRepo.findBySessionId(session.id);

    assert.equal(persistedSession?.status, 'STOPPED');
    assert.equal(persistedSession?.started_at, null);
    assert.equal(persistedSession?.completed_at, null);
    assert.equal(spawnCalled, false);
    assert.equal(segments.length, 0);
    assert.equal(service.runningProcesses.size, 0);
  } finally {
    await fs.rm(storagePath, { recursive: true, force: true });
  }
});

test.test('SessionService continue keeps the session stopped when Claude Code does not launch', async () => {
  const storagePath = await createTempStorageRoot();
  const worktreePath = await createWorktreeDir();

  try {
    const sessionRepo = new SessionRepository({ storagePath });
    const sessionSegmentRepo = new SessionSegmentRepository({ storagePath });

    const session = await sessionRepo.create({
      task_id: 907,
      status: 'STOPPED',
      worktree_path: worktreePath,
      branch: 'task/project/907',
      initial_prompt: 'Resume only when Claude launches',
      agent_id: null,
      executor_type: 'CLAUDE_CODE',
      started_at: null,
      completed_at: null,
    });

    const firstSegment = await sessionSegmentRepo.create({
      session_id: session.id,
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

    const service = new SessionService() as SessionService & {
      sessionSegmentRepo: SessionSegmentRepository;
      _spawnClaudeCode: (...args: unknown[]) => ChildProcess;
    };

    service.sessionRepo = sessionRepo;
    service.sessionSegmentRepo = sessionSegmentRepo;
    service._spawnClaudeCode = () => {
      throw new Error('spawn failed');
    };

    await assert.rejects(() => service.continue(session.id, 'Retry the resume'), /spawn failed/);

    const persistedSession = await sessionRepo.findById(session.id);
    const segments = await sessionSegmentRepo.findBySessionId(session.id);

    assert.equal(persistedSession?.status, 'STOPPED');
    assert.equal(persistedSession?.completed_at, null);
    assert.equal(segments.length, 2);
    assert.equal(segments[1]?.trigger_type, 'CONTINUE');
    assert.equal(segments[1]?.parent_segment_id, firstSegment.id);
    assert.equal(segments[1]?.status, 'ERROR');
    assert.equal(service.runningProcesses.size, 0);
  } finally {
    await fs.rm(storagePath, { recursive: true, force: true });
    await fs.rm(worktreePath, { recursive: true, force: true });
  }
});


test.test('SessionService continue rejects when the worktree path does not exist', async () => {
  const storagePath = await createTempStorageRoot();
  const missingWorktreePath = path.join(storagePath, 'missing-worktree');

  try {
    const sessionRepo = new SessionRepository({ storagePath });
    const sessionSegmentRepo = new SessionSegmentRepository({ storagePath });

    const session = await sessionRepo.create({
      task_id: 909,
      status: 'STOPPED',
      worktree_path: missingWorktreePath,
      branch: 'task/project/909',
      initial_prompt: 'Resume only when worktree exists',
      agent_id: null,
      executor_type: 'CLAUDE_CODE',
      started_at: null,
      completed_at: null,
    });

    await sessionSegmentRepo.create({
      session_id: session.id,
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

    let spawnCalled = false;
    const service = new SessionService() as SessionService & {
      sessionSegmentRepo: SessionSegmentRepository;
      _spawnClaudeCode: (...args: unknown[]) => ChildProcess;
    };

    service.sessionRepo = sessionRepo;
    service.sessionSegmentRepo = sessionSegmentRepo;
    service._spawnClaudeCode = () => {
      spawnCalled = true;
      throw new Error('spawn should not be called');
    };

    await assert.rejects(
      () => service.continue(session.id, 'Retry the resume'),
      (error: unknown) => error instanceof Error && error.message === 'Session worktree is unavailable' && 'statusCode' in error && error.statusCode === 409,
    );

    const persistedSession = await sessionRepo.findById(session.id);
    const segments = await sessionSegmentRepo.findBySessionId(session.id);

    assert.equal(persistedSession?.status, 'STOPPED');
    assert.equal(persistedSession?.completed_at, null);
    assert.equal(spawnCalled, false);
    assert.equal(segments.length, 1);
    assert.equal(service.runningProcesses.size, 0);
  } finally {
    await fs.rm(storagePath, { recursive: true, force: true });
  }
});


test.test('SessionService stop transitions an active desynced session to stopped when no running process exists', async () => {
  const storagePath = await createTempStorageRoot();

  try {
    const sessionRepo = new SessionRepository({ storagePath });
    const sessionSegmentRepo = new SessionSegmentRepository({ storagePath });

    const session = await sessionRepo.create({
      task_id: 908,
      status: 'RUNNING',
      worktree_path: null,
      branch: 'task/project/908',
      initial_prompt: 'Stop after restart desync',
      agent_id: null,
      executor_type: 'CLAUDE_CODE',
      started_at: '2026-03-23T00:00:00.000Z',
      completed_at: null,
    });

    const segment = await sessionSegmentRepo.create({
      session_id: session.id,
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

    const broadcasts: Array<{ room: string; payload: { type: string; status?: string } }> = [];
    const service = new SessionService();
    service.sessionRepo = sessionRepo;
    service.sessionSegmentRepo = sessionSegmentRepo;

    const stoppedSession = await service.stop(session.id, (_sessionId, room, payload) => {
      broadcasts.push({ room, payload: payload as { type: string; status?: string } });
    });

    assert.equal(stoppedSession?.status, 'STOPPED');
    assert.equal(service.runningProcesses.size, 0);
    assert.equal(service.stopRequestedSessions.has(session.id), false);

    const persistedSession = await sessionRepo.findById(session.id);
    const persistedSegment = await sessionSegmentRepo.findById(segment.id);

    assert.equal(persistedSession?.status, 'STOPPED');
    assert.ok(persistedSession?.completed_at);
    assert.equal(persistedSegment?.status, 'STOPPED');
    assert.equal(persistedSegment?.completed_at, persistedSession?.completed_at);
    assert.deepEqual(broadcasts, [{ room: 'status', payload: { type: 'status', status: 'STOPPED' } }]);
  } finally {
    await fs.rm(storagePath, { recursive: true, force: true });
  }
});

test.test('SessionService stop finalizes stopped state only once when process close arrives later', async () => {
  const storagePath = await createTempStorageRoot();
  const worktreePath = await createWorktreeDir();

  class StoppableFakeChildProcess extends FakeChildProcess {
    kill() {
      setImmediate(() => this.finish(0));
      return true;
    }
  }

  try {
    const sessionRepo = new SessionRepository({ storagePath });
    const sessionSegmentRepo = new SessionSegmentRepository({ storagePath });
    const sessionEventRepo = new SessionEventRepository({ storagePath });

    const session = await sessionRepo.create({
      task_id: 905,
      status: 'RUNNING',
      worktree_path: worktreePath,
      branch: 'task/project/905',
      initial_prompt: 'Stop safely',
      agent_id: null,
      executor_type: 'CLAUDE_CODE',
      started_at: '2026-03-23T00:00:00.000Z',
      completed_at: null,
    });

    const segment = await sessionSegmentRepo.create({
      session_id: session.id,
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

    let releaseAppend!: () => void;
    const appendBlocked = new Promise<void>((resolve) => {
      releaseAppend = resolve;
    });
    const originalAppend = sessionEventRepo.append.bind(sessionEventRepo);
    let blockFirstAppend = true;
    sessionEventRepo.append = (async (...args: Parameters<SessionEventRepository['append']>) => {
      if (blockFirstAppend) {
        blockFirstAppend = false;
        await appendBlocked;
      }
      return await originalAppend(...args);
    }) as SessionEventRepository['append'];

    let stoppedSessionUpdates = 0;
    const originalSessionUpdate = sessionRepo.update.bind(sessionRepo);
    sessionRepo.update = (async (...args: Parameters<SessionRepository['update']>) => {
      if (args[1]?.status === 'STOPPED') {
        stoppedSessionUpdates += 1;
      }
      return await originalSessionUpdate(...args);
    }) as SessionRepository['update'];

    let stoppedSegmentUpdates = 0;
    const originalSegmentUpdate = sessionSegmentRepo.update.bind(sessionSegmentRepo);
    sessionSegmentRepo.update = (async (...args: Parameters<SessionSegmentRepository['update']>) => {
      if (args[1]?.status === 'STOPPED') {
        stoppedSegmentUpdates += 1;
      }
      return await originalSegmentUpdate(...args);
    }) as SessionSegmentRepository['update'];

    const broadcasts: Array<{ room: string; payload: { type: string; status?: string } }> = [];
    const proc = new StoppableFakeChildProcess();
    const service = new SessionService();
    service.sessionRepo = sessionRepo;
    service.sessionSegmentRepo = sessionSegmentRepo;
    service.sessionEventRepo = sessionEventRepo;
    service.runningProcesses.set(session.id, proc as unknown as ChildProcess);

    service._readProcessOutput(
      session.id,
      segment.id,
      proc as unknown as ChildProcess,
      (_sessionId, room, payload) => {
        broadcasts.push({ room, payload: payload as { type: string; status?: string } });
      },
    );
    proc.emitStdout('delayed output\n');

    const stopPromise = service.stop(session.id, (_sessionId, room, payload) => {
      broadcasts.push({ room, payload: payload as { type: string; status?: string } });
    });

    await waitFor(async () => {
      assert.equal(blockFirstAppend, false);
    });

    const beforeReleaseSession = await sessionRepo.findById(session.id);
    assert.equal(beforeReleaseSession?.status, 'RUNNING');
    assert.equal(stoppedSessionUpdates, 0);
    assert.equal(stoppedSegmentUpdates, 0);
    assert.equal(
      broadcasts.filter((entry) => entry.room === 'status' && entry.payload.status === 'STOPPED').length,
      0,
    );

    releaseAppend();
    await stopPromise;

    await waitFor(async () => {
      const persistedSession = await sessionRepo.findById(session.id);
      assert.equal(persistedSession?.status, 'STOPPED');

      const persistedSegment = await sessionSegmentRepo.findById(segment.id);
      assert.equal(persistedSegment?.status, 'STOPPED');
    });

    assert.equal(stoppedSessionUpdates, 1);
    assert.equal(stoppedSegmentUpdates, 1);
    assert.equal(
      broadcasts.filter((entry) => entry.room === 'status' && entry.payload.status === 'STOPPED').length,
      1,
    );
  } finally {
    await fs.rm(storagePath, { recursive: true, force: true });
    await fs.rm(worktreePath, { recursive: true, force: true });
  }
});


test.test('SessionService delete does not clean up a task-owned shared worktree', async () => {
  const storagePath = await createTempStorageRoot();
  const worktreePath = await createWorktreeDir();

  try {
    const sessionRepo = new SessionRepository({ storagePath });

    const firstSession = await sessionRepo.create({
      task_id: 910,
      status: 'STOPPED',
      worktree_path: worktreePath,
      branch: 'task/project/910',
      initial_prompt: 'Shared worktree session one',
      agent_id: null,
      executor_type: 'CLAUDE_CODE',
      started_at: null,
      completed_at: null,
    });

    await sessionRepo.create({
      task_id: 910,
      status: 'STOPPED',
      worktree_path: worktreePath,
      branch: 'task/project/910',
      initial_prompt: 'Shared worktree session two',
      agent_id: null,
      executor_type: 'CLAUDE_CODE',
      started_at: null,
      completed_at: null,
    });

    let cleanupCalls = 0;
    const service = new SessionService() as SessionService & {
      taskService: { getById(taskId: number): Promise<{ id: number; title: string; worktree_path: string; worktree_status: string }> };
      _cleanupWorktree(worktreePath: string): boolean;
    };

    service.sessionRepo = sessionRepo;
    service.taskService = {
      async getById(taskId: number) {
        return {
          id: taskId,
          title: 'Task 910',
          worktree_path: worktreePath,
          worktree_status: 'created',
        };
      },
    };
    service._cleanupWorktree = () => {
      cleanupCalls += 1;
      return true;
    };

    const deleted = await service.delete(firstSession.id);
    const remainingSessions = await sessionRepo.findAll();

    assert.equal(deleted, true);
    assert.equal(cleanupCalls, 0);
    assert.equal(remainingSessions.length, 1);
    assert.equal(remainingSessions[0]?.worktree_path, worktreePath);
  } finally {
    await fs.rm(storagePath, { recursive: true, force: true });
    await fs.rm(worktreePath, { recursive: true, force: true });
  }
});

test.test('SessionService listEvents returns paginated events with has_more metadata', async () => {
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
