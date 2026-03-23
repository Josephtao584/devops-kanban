import * as fs from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';

import { SessionRepository } from '../repositories/sessionRepository.js';
import { SessionSegmentRepository } from '../repositories/sessionSegmentRepository.js';
import { SessionEventRepository } from '../repositories/sessionEventRepository.js';
import { TaskService } from './taskService.js';
import { createWorktree, cleanupWorktree } from '../utils/git.js';
import type { CreateSessionInput } from '../types/dto/sessions.js';
import type { SessionSegmentEntity } from '../types/entities.ts';
import type { BroadcastFn, BroadcastPayload } from '../types/ws/sessions.js';

interface SessionLike {
  id: number;
  task_id: number;
  status?: string;
  worktree_path?: string | null;
  branch?: string | null;
  initial_prompt?: string | null;
  agent_id?: number | null;
  executor_type?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

interface TaskLike {
  id: number;
  title: string;
  description?: string;
  worktree_path?: string | null;
  worktree_status?: string | null;
  worktree_branch?: string | null;
}

class SessionService {
  sessionRepo: SessionRepository;
  sessionSegmentRepo: SessionSegmentRepository;
  sessionEventRepo: SessionEventRepository;
  taskService: TaskService;
  runningProcesses: Map<number, ChildProcess>;

  constructor() {
    this.sessionRepo = new SessionRepository();
    this.sessionSegmentRepo = new SessionSegmentRepository();
    this.sessionEventRepo = new SessionEventRepository();
    this.taskService = new TaskService();
    this.runningProcesses = new Map();
  }

  async getAll(filters: { taskId?: number; activeOnly?: boolean } = {}) {
    const { taskId, activeOnly } = filters;

    let sessions;
    if (taskId) {
      sessions = await this.sessionRepo.getByTask(taskId);
      if (activeOnly) {
        sessions = sessions.filter((session) => session.status === 'RUNNING' || session.status === 'IDLE');
      }
    } else {
      sessions = await this.sessionRepo.findAll();
    }

    return sessions;
  }

  async getById(sessionId: number) {
    return await this.sessionRepo.findById(sessionId);
  }

  async getActiveByTask(taskId: number) {
    return await this.sessionRepo.getActiveByTask(taskId);
  }

  async getHistoryByTask(taskId: number, includeOutput = true) {
    const sessions = await this.sessionRepo.getByTask(taskId);
    if (!includeOutput) {
      return sessions.map(({ ...session }) => session);
    }
    return sessions;
  }

  async listEvents(sessionId: number, options: { afterSeq?: number; limit?: number } = {}) {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      const error = new Error('Session not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    const requestedLimit = options.limit;
    const events = await this.sessionEventRepo.listBySessionId(sessionId, {
      afterSeq: options.afterSeq,
      limit: requestedLimit === undefined ? undefined : requestedLimit + 1,
    });
    const hasMore = requestedLimit !== undefined && events.length > requestedLimit;

    return {
      events: hasMore ? events.slice(0, requestedLimit) : events,
      last_seq: await this.sessionEventRepo.getLastSeq(sessionId),
      has_more: hasMore,
    };
  }

  async create(sessionData: CreateSessionInput) {
    const task = await this.taskService.getById(sessionData.task_id) as TaskLike | null;
    if (!task) {
      const error = new Error('Task not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    let worktreePath: string;
    let branchName = `task/${sessionData.task_id}`;

    if (task.worktree_path && task.worktree_status === 'created') {
      worktreePath = task.worktree_path;
      branchName = task.worktree_branch || branchName;
    } else {
      try {
        const worktreeResult = await this.taskService.createWorktree(sessionData.task_id);
        worktreePath = worktreeResult.worktree_path;
        branchName = worktreeResult.worktree_branch;
      } catch {
        worktreePath = createWorktree(sessionData.task_id, task.title, task.title);
      }
    }

    const sessionDataWithWorktree = {
      ...sessionData,
      worktree_path: worktreePath,
      branch: branchName,
      initial_prompt: sessionData.initial_prompt || task.description || '',
      agent_id: null,
      executor_type: 'CLAUDE_CODE' as const,
      started_at: null,
      completed_at: null,
    };

    return await this.sessionRepo.create(sessionDataWithWorktree);
  }

  async start(sessionId: number, broadcastFn?: BroadcastFn) {
    const session = await this.sessionRepo.findById(sessionId) as SessionLike | null;
    if (!session) {
      const error = new Error('Session not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    if (session.status === 'RUNNING' || session.status === 'IDLE') {
      return session;
    }

    const task = await this.taskService.getById(session.task_id) as TaskLike | null;
    if (!task) {
      const error = new Error('Task not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    const startedAt = new Date().toISOString();
    await this.sessionRepo.update(sessionId, {
      status: 'RUNNING',
      started_at: session.started_at || startedAt,
      completed_at: null,
    });

    if (session.worktree_path && fs.existsSync(session.worktree_path)) {
      const segment = await this._createSegment(session, 'START', null);
      try {
        const prompt = session.initial_prompt || task.description || '';
        const proc = this._spawnClaudeCode(
          session.worktree_path,
          ['-y', '@anthropic-ai/claude-code', '--prompt', prompt, '--verbose'],
          sessionId,
          'start',
        );
        this.runningProcesses.set(sessionId, proc);
        this._readProcessOutput(sessionId, segment.id, proc, broadcastFn);
      } catch (error) {
        await this._markSegmentComplete(segment.id, 'ERROR');
        throw error;
      }
    }

    return await this.sessionRepo.findById(sessionId);
  }

  _spawnClaudeCode(worktreePath: string, args: string[], sessionId: number, action: 'start' | 'resume') {
    try {
      return spawn('npx', args, {
        cwd: worktreePath,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });
    } catch (error) {
      void this.sessionRepo.update(sessionId, { status: 'ERROR', completed_at: new Date().toISOString() });
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to ${action} Claude Code: ${message}`);
    }
  }

  _readProcessOutput(sessionId: number, segmentId: number, proc: ChildProcess, broadcastFn?: BroadcastFn) {
    let pendingEventWrite = Promise.resolve();

    const appendStreamEvent = (content: string, stream: 'stdout' | 'stderr', role: 'assistant' | 'system') => {
      const trimmed = content.trim();
      if (!trimmed) {
        return;
      }

      const timestamp = new Date().toISOString();
      pendingEventWrite = pendingEventWrite
        .catch(() => undefined)
        .then(async () => {
          await this.sessionEventRepo.append({
            session_id: sessionId,
            segment_id: segmentId,
            kind: 'stream_chunk',
            role,
            content: trimmed,
            payload: { stream, timestamp },
          });
        });

      broadcastFn?.(sessionId, 'output', {
        type: 'chunk',
        content: trimmed,
        stream,
        timestamp,
      });
    };

    proc.stdout?.on('data', (data: Buffer | string) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        appendStreamEvent(line, 'stdout', 'assistant');
      }
    });

    proc.stderr?.on('data', (data: Buffer | string) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        appendStreamEvent(line, 'stderr', 'system');
      }
    });

    proc.on('close', async (code) => {
      const status = code === 0 ? 'COMPLETED' : 'ERROR';
      const completedAt = new Date().toISOString();

      await pendingEventWrite.catch(() => undefined);
      await this.sessionRepo.update(sessionId, {
        status,
        completed_at: completedAt,
      });
      await this._markSegmentComplete(segmentId, status, completedAt);

      broadcastFn?.(sessionId, 'status', {
        type: 'status',
        status,
      });

      this.runningProcesses.delete(sessionId);
    });

    proc.on('error', async (error) => {
      const timestamp = new Date().toISOString();
      pendingEventWrite = pendingEventWrite
        .catch(() => undefined)
        .then(async () => {
          await this.sessionEventRepo.append({
            session_id: sessionId,
            segment_id: segmentId,
            kind: 'error',
            role: 'system',
            content: `Error: ${error.message}`,
            payload: { stream: 'stderr', timestamp },
          });
        });

      await pendingEventWrite.catch(() => undefined);
      await this.sessionRepo.update(sessionId, { status: 'ERROR', completed_at: timestamp });
      await this._markSegmentComplete(segmentId, 'ERROR', timestamp);

      broadcastFn?.(sessionId, 'output', {
        type: 'chunk',
        content: `Error: ${error.message}`,
        stream: 'stderr',
        timestamp,
      });
      this.runningProcesses.delete(sessionId);
    });
  }

  async stop(sessionId: number, broadcastFn?: BroadcastFn) {
    const session = await this.sessionRepo.findById(sessionId) as SessionLike | null;
    if (!session) {
      const error = new Error('Session not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    if (session.status !== 'RUNNING' && session.status !== 'IDLE') {
      return session;
    }

    const proc = this.runningProcesses.get(sessionId);
    if (proc) {
      proc.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          proc.kill('SIGKILL');
          resolve();
        }, 5000);
        proc.on('close', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
      this.runningProcesses.delete(sessionId);
    }

    const stoppedAt = new Date().toISOString();
    const updated = await this.sessionRepo.update(sessionId, { status: 'STOPPED', completed_at: stoppedAt });
    const latestSegment = await this.sessionSegmentRepo.findLatestBySessionId(sessionId);
    if (latestSegment) {
      await this._markSegmentComplete(latestSegment.id, 'STOPPED', stoppedAt);
    }

    broadcastFn?.(sessionId, 'status', {
      type: 'status',
      status: 'STOPPED',
    });

    return updated;
  }

  async continue(sessionId: number, input: string, broadcastFn?: BroadcastFn) {
    const session = await this.sessionRepo.findById(sessionId) as SessionLike | null;
    if (!session) {
      const error = new Error('Session not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    if (session.status !== 'STOPPED') {
      const error = new Error('Session is not stopped') as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }

    const latestSegment = await this.sessionSegmentRepo.findLatestBySessionId(sessionId);
    await this.sessionRepo.update(sessionId, { status: 'RUNNING', completed_at: null });

    if (session.worktree_path && fs.existsSync(session.worktree_path)) {
      const segment = await this._createSegment(session, 'CONTINUE', latestSegment?.id ?? null);
      try {
        const proc = this._spawnClaudeCode(
          session.worktree_path,
          ['-y', '@anthropic-ai/claude-code', '--resume', '--prompt', input],
          sessionId,
          'resume',
        );
        this.runningProcesses.set(sessionId, proc);
        this._readProcessOutput(sessionId, segment.id, proc, broadcastFn);
      } catch (error) {
        await this._markSegmentComplete(segment.id, 'ERROR');
        throw error;
      }
    }

    return await this.sessionRepo.findById(sessionId);
  }

  async sendInput(sessionId: number, input: string) {
    const session = await this.sessionRepo.findById(sessionId) as SessionLike | null;
    if (!session) {
      const error = new Error('Session not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    if (session.status !== 'RUNNING' && session.status !== 'IDLE') {
      const error = new Error('Session is not running') as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }

    const proc = this.runningProcesses.get(sessionId);
    if (proc?.stdin?.writable) {
      proc.stdin.write(`${input}\n`);
      return true;
    }

    return false;
  }

  async delete(sessionId: number, broadcastFn?: BroadcastFn) {
    const session = await this.sessionRepo.findById(sessionId) as SessionLike | null;
    if (!session) {
      const error = new Error('Session not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    if (session.status === 'RUNNING' || session.status === 'IDLE') {
      await this.stop(sessionId, broadcastFn);
    }

    if (session.worktree_path) {
      cleanupWorktree(session.worktree_path);
    }

    return await this.sessionRepo.delete(sessionId);
  }

  async exists(sessionId: number) {
    return (await this.sessionRepo.findById(sessionId)) !== null;
  }

  private async _createSegment(
    session: SessionLike,
    triggerType: SessionSegmentEntity['trigger_type'],
    parentSegmentId: number | null,
  ) {
    const startedAt = new Date().toISOString();
    return await this.sessionSegmentRepo.create({
      session_id: session.id,
      status: 'RUNNING',
      executor_type: (session.executor_type || 'CLAUDE_CODE') as SessionSegmentEntity['executor_type'],
      agent_id: session.agent_id ?? null,
      provider_session_id: null,
      resume_token: null,
      checkpoint_ref: null,
      trigger_type: triggerType,
      parent_segment_id: parentSegmentId,
      started_at: startedAt,
      completed_at: null,
      metadata: {},
    });
  }

  private async _markSegmentComplete(segmentId: number, status: string, completedAt = new Date().toISOString()) {
    await this.sessionSegmentRepo.update(segmentId, {
      status,
      completed_at: completedAt,
    });
  }
}

export { SessionService };
