import * as fs from 'node:fs';

import { SessionRepository } from '../repositories/sessionRepository.js';
import { SessionSegmentRepository } from '../repositories/sessionSegmentRepository.js';
import { SessionEventRepository } from '../repositories/sessionEventRepository.js';
import { TaskService } from './taskService.js';
import { cleanupWorktree } from '../utils/git.js';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { SessionSegmentEntity } from '../types/entities.ts';
import {Executor, ExecutorType} from "../types/executors.js";

interface SessionLike {
  id: number;
  task_id: number;
  status?: string;
  worktree_path?: string | null;
  branch?: string | null;
  initial_prompt?: string | null;
  agent_id?: number | null;
  executor_type: ExecutorType;
  started_at?: string | null;
  completed_at?: string | null;
}
class SessionService {
  sessionRepo: SessionRepository;
  sessionSegmentRepo: SessionSegmentRepository;
  sessionEventRepo: SessionEventRepository;
  taskService: TaskService;
  stopRequestedSessions: Set<number>;
  sessionCompletionPromises: Map<number, Promise<void>>;

  constructor() {
    this.sessionRepo = new SessionRepository();
    this.sessionSegmentRepo = new SessionSegmentRepository();
    this.sessionEventRepo = new SessionEventRepository();
    this.taskService = new TaskService();
    this.stopRequestedSessions = new Set();
    this.sessionCompletionPromises = new Map();
  }


  async getById(sessionId: number) {
    return await this.sessionRepo.findById(sessionId);
  }

  async listEvents(sessionId: number, options: { afterSeq?: number; limit?: number } = {}) {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new NotFoundError('未找到会话', 'Session not found', { sessionId });
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

  async continue(sessionId: number, input: string) {
    const session = await this.sessionRepo.findById(sessionId) as SessionLike | null;
    if (!session) {
      throw new NotFoundError('未找到会话', 'Session not found', { sessionId });
    }

    if (session.status !== 'STOPPED' && session.status !== 'SUSPENDED' && session.status !== 'COMPLETED' && session.status !== 'FAILED' && session.status !== 'CANCELLED') {
      throw new ValidationError('会话未处于可恢复状态', 'Session is not in a resumable state', { sessionId, status: session.status });
    }

    if (!session.executor_type) {
      throw new ValidationError('会话没有执行器类型', 'Session has no executor type', { sessionId });
    }

    const worktreePath = this._requireLaunchableWorktree(session);
    const latestSegment = await this.sessionSegmentRepo.findLatestBySessionId(sessionId);

    const { AgentExecutorRegistry } = await import('./workflow/agentExecutorRegistry.js');
    const registry = new AgentExecutorRegistry();
    const executor = registry.getExecutor(session.executor_type);

    const segment = await this._createSegment(session, 'CONTINUE', latestSegment?.id ?? null);
    await this.sessionRepo.update(sessionId, { status: 'RUNNING', completed_at: null });

    // Save user message to session events
    await this.sessionEventRepo.append({
      session_id: sessionId,
      segment_id: segment.id,
      kind: 'message',
      role: 'user',
      content: input,
      payload: {},
    });

    // Execute in background, return immediately
    this._executeContinue(session, segment, executor, worktreePath, latestSegment, input).catch((err) => {
      logger.error('SessionService', `Continue failed for session #${sessionId}: ${err instanceof Error ? err.message : String(err)}`);
    });

    return await this.sessionRepo.findById(sessionId);
  }

  private async _executeContinue(
    session: SessionLike,
    segment: { id: number },
    executor: Executor,
    worktreePath: string,
    latestSegment: { provider_session_id?: string | null } | null,
    input: string
  ) {
    try {
      const result = await executor.continue({
        prompt: input,
        worktreePath,
        ...(latestSegment?.provider_session_id ? { providerSessionId: latestSegment.provider_session_id } : {}),
        onEvent: async (event) => {
          await this.sessionEventRepo.append({
            session_id: session.id,
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
      await this.sessionRepo.update(session.id, {
        status: 'STOPPED',
        completed_at: new Date().toISOString(),
      });
    } catch (error) {
      await this._markSegmentComplete(segment.id, 'ERROR');
      await this.sessionRepo.update(session.id, { status: 'STOPPED' });
    }
  }

  async exists(sessionId: number) {
    return (await this.sessionRepo.findById(sessionId)) !== null;
  }

  async listByTask(taskId: number) {
    return await this.sessionRepo.getByTask(taskId);
  }

  async getActiveByTask(taskId: number) {
    return await this.sessionRepo.getActiveByTask(taskId);
  }

  async delete(sessionId: number) {
    return await this.sessionRepo.delete(sessionId);
  }

  async updateSessionStatus(sessionId: number, status: string) {
    return await this.sessionRepo.update(sessionId, { status, completed_at: new Date().toISOString() });
  }

  private _requireLaunchableWorktree(session: SessionLike) {
    if (!session.worktree_path || !fs.existsSync(session.worktree_path)) {
      throw new ConflictError('会话工作区不可用', 'Session worktree is unavailable', { sessionId: session.id });
    }

    return session.worktree_path;
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
      executor_type: session.executor_type,
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
