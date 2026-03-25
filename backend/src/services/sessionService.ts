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
  stopRequestedSessions: Set<number>;
  sessionCompletionPromises: Map<number, Promise<void>>;

  constructor() {
    this.sessionRepo = new SessionRepository();
    this.sessionSegmentRepo = new SessionSegmentRepository();
    this.sessionEventRepo = new SessionEventRepository();
    this.taskService = new TaskService();
    this.runningProcesses = new Map();
    this.stopRequestedSessions = new Set();
    this.sessionCompletionPromises = new Map();
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

  async getOutput(sessionId: number) {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      const error = new Error('Session not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    const events = await this.sessionEventRepo.listBySessionId(sessionId);
    return events
      .filter((event) => event.kind === 'stream_chunk' || event.kind === 'message' || event.kind === 'error')
      .map((event) => event.content)
      .join('');
  }

  async listEvents(sessionId: number, options: { afterSeq?: number; limit?: number } = {}) {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      const error = new Error('Session not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    const requestedLimit = options.limit;
    const afterSeq = options.afterSeq;
    const events = await this.sessionEventRepo.listBySessionId(sessionId, {
      ...(afterSeq !== undefined ? { afterSeq } : {}),
      ...(requestedLimit !== undefined ? { limit: requestedLimit + 1 } : {}),
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

    this.stopRequestedSessions.delete(sessionId);

    const task = await this.taskService.getById(session.task_id) as TaskLike | null;
    if (!task) {
      const error = new Error('Task not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    const worktreePath = this._requireLaunchableWorktree(session);
    const prompt = session.initial_prompt || task.description || '';
    const segment = await this._createSegment(session, 'START', null);
    try {
      const proc = this._spawnClaudeCode(
        worktreePath,
        ['-y', '@anthropic-ai/claude-code', '--prompt', prompt, '--verbose'],
        sessionId,
        'start',
      );
      const startedAt = new Date().toISOString();
      await this.sessionRepo.update(sessionId, {
        status: 'RUNNING',
        started_at: session.started_at || startedAt,
        completed_at: null,
      });
      this.runningProcesses.set(sessionId, proc);
      this._readProcessOutput(sessionId, segment.id, proc, broadcastFn);
    } catch (error) {
      await this._markSegmentComplete(segment.id, 'ERROR');
      throw error;
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
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to ${action} Claude Code: ${message}`);
    }
  }

  _readProcessOutput(sessionId: number, segmentId: number, proc: ChildProcess, broadcastFn?: BroadcastFn) {
    let pendingEventWrite = Promise.resolve();
    let finalizeSessionPromise: Promise<void> | null = null;
    let resolveSessionCompletion: (() => void) | null = null;
    let rejectSessionCompletion: ((error: unknown) => void) | null = null;
    const sessionCompletionPromise = new Promise<void>((resolve, reject) => {
      resolveSessionCompletion = resolve;
      rejectSessionCompletion = reject;
    });

    this.sessionCompletionPromises.set(sessionId, sessionCompletionPromise);

    const finalizeSession = async (status: 'COMPLETED' | 'ERROR' | 'STOPPED', completedAt = new Date().toISOString()) => {
      if (finalizeSessionPromise) {
        return await finalizeSessionPromise;
      }

      finalizeSessionPromise = (async () => {
        const finalStatus = this.stopRequestedSessions.has(sessionId) ? 'STOPPED' : status;

        await this.sessionRepo.update(sessionId, {
          status: finalStatus,
          completed_at: completedAt,
        });
        await this._markSegmentComplete(segmentId, finalStatus, completedAt);

        broadcastFn?.(sessionId, 'status', {
          type: 'status',
          status: finalStatus,
        });

        this.runningProcesses.delete(sessionId);
        this.stopRequestedSessions.delete(sessionId);
      })();

      void finalizeSessionPromise
        .then(() => {
          resolveSessionCompletion?.();
        })
        .catch((error) => {
          rejectSessionCompletion?.(error);
        })
        .finally(() => {
          if (this.sessionCompletionPromises.get(sessionId) === sessionCompletionPromise) {
            this.sessionCompletionPromises.delete(sessionId);
          }
        });

      return await finalizeSessionPromise;
    };

    const appendStreamEvent = (content: string, stream: 'stdout' | 'stderr', role: 'assistant' | 'system') => {
      if (content.length === 0) {
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
            content,
            payload: { stream, timestamp },
          });
        });

      broadcastFn?.(sessionId, 'output', {
        type: 'chunk',
        content,
        stream,
        timestamp,
      });
    };

    proc.stdout?.on('data', (data: Buffer | string) => {
      appendStreamEvent(data.toString(), 'stdout', 'assistant');
    });

    proc.stderr?.on('data', (data: Buffer | string) => {
      appendStreamEvent(data.toString(), 'stderr', 'system');
    });

    proc.on('close', async (code) => {
      const status = code === 0 ? 'COMPLETED' : 'ERROR';
      const completedAt = new Date().toISOString();

      await pendingEventWrite.catch(() => undefined);
      await finalizeSession(status, completedAt);
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
      await finalizeSession('ERROR', timestamp);

      broadcastFn?.(sessionId, 'output', {
        type: 'chunk',
        content: `Error: ${error.message}`,
        stream: 'stderr',
        timestamp,
      });
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

    this.stopRequestedSessions.add(sessionId);

    const proc = this.runningProcesses.get(sessionId);
    if (!proc) {
      const completedAt = new Date().toISOString();
      await this.sessionRepo.update(sessionId, {
        status: 'STOPPED',
        completed_at: completedAt,
      });

      const latestSegment = await this.sessionSegmentRepo.findLatestBySessionId(sessionId);
      if (latestSegment?.status === 'RUNNING') {
        await this._markSegmentComplete(latestSegment.id, 'STOPPED', completedAt);
      }

      broadcastFn?.(sessionId, 'status', {
        type: 'status',
        status: 'STOPPED',
      });

      this.stopRequestedSessions.delete(sessionId);
      this.sessionCompletionPromises.delete(sessionId);
      return await this.sessionRepo.findById(sessionId);
    }

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

    await this.sessionCompletionPromises.get(sessionId);

    return await this.sessionRepo.findById(sessionId);
  }


  async continue(sessionId: number, input: string, _broadcastFn?: BroadcastFn) {
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

    if (!session.executor_type) {
      const error = new Error('Session has no executor type') as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }

    const worktreePath = this._requireLaunchableWorktree(session);
    const latestSegment = await this.sessionSegmentRepo.findLatestBySessionId(sessionId);

    const { AgentExecutorRegistry } = await import('./workflow/agentExecutorRegistry.js');
    const registry = new AgentExecutorRegistry();
    const executor = registry.getExecutor(session.executor_type);

    if (!executor.continue) {
      const error = new Error(`Executor ${session.executor_type} does not support continue`) as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }

    const segment = await this._createSegment(session, 'CONTINUE', latestSegment?.id ?? null);

    try {
      await this.sessionRepo.update(sessionId, { status: 'RUNNING', completed_at: null });

      const result = await executor.continue({
        prompt: input,
        worktreePath,
        providerSessionId: latestSegment?.provider_session_id || undefined,
        onEvent: async (event) => {
          await this.sessionEventRepo.append({
            session_id: sessionId,
            segment_id: segment.id,
            kind: event.kind,
            role: event.role,
            content: event.content,
            payload: event.payload || {},
          });
        },
        onProviderState: async (providerState) => {
          if (providerState.providerSessionId) {
            await this.sessionSegmentRepo.update(segment.id, {
              provider_session_id: providerState.providerSessionId,
            });
          }
        },
      });

      await this._markSegmentComplete(segment.id, result.exitCode === 0 ? 'COMPLETED' : 'ERROR');
      await this.sessionRepo.update(sessionId, {
        status: 'STOPPED',
        completed_at: new Date().toISOString(),
      });
    } catch (error) {
      await this._markSegmentComplete(segment.id, 'ERROR');
      await this.sessionRepo.update(sessionId, { status: 'STOPPED' });
      throw error;
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

    if (await this._canCleanupWorktree(session)) {
      this._cleanupWorktree(session.worktree_path!);
    }

    return await this.sessionRepo.delete(sessionId);
  }

  async exists(sessionId: number) {
    return (await this.sessionRepo.findById(sessionId)) !== null;
  }

  private _requireLaunchableWorktree(session: SessionLike) {
    if (!session.worktree_path || !fs.existsSync(session.worktree_path)) {
      const error = new Error('Session worktree is unavailable') as Error & { statusCode?: number };
      error.statusCode = 409;
      throw error;
    }

    return session.worktree_path;
  }

  private async _canCleanupWorktree(session: SessionLike) {
    if (!session.worktree_path) {
      return false;
    }

    const task = await this.taskService.getById(session.task_id) as TaskLike | null;
    if (task?.worktree_path === session.worktree_path) {
      return false;
    }

    const sessions = await this.sessionRepo.findAll();
    return !sessions.some((candidate) => candidate.id !== session.id && candidate.worktree_path === session.worktree_path);
  }

  _cleanupWorktree(worktreePath: string) {
    return cleanupWorktree(worktreePath);
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
