import * as fs from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';

import { SessionRepository } from '../repositories/sessionRepository.js';
import { TaskService } from './taskService.js';
import { createWorktree, cleanupWorktree } from '../utils/git.js';
import type { CreateSessionInput } from '../types/dto/sessions.js';
import type { BroadcastFn, BroadcastPayload } from '../types/ws/sessions.js';

interface SessionLike {
  id: number;
  task_id: number;
  status?: string;
  output?: string | null;
  worktree_path?: string | null;
  branch?: string | null;
  initial_prompt?: string | null;
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
  taskService: TaskService;
  runningProcesses: Map<number, ChildProcess>;

  constructor() {
    this.sessionRepo = new SessionRepository();
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
      // Return sessions without output field for lighter payload
      return sessions.map(({ output: _output, ...session }) => session);
    }
    return sessions;
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

    await this.sessionRepo.update(sessionId, { status: 'RUNNING' });

    if (session.worktree_path && fs.existsSync(session.worktree_path)) {
      const prompt = session.initial_prompt || task.description || '';
      const proc = this._spawnClaudeCode(session.worktree_path, ['-y', '@anthropic-ai/claude-code', '--prompt', prompt, '--verbose'], sessionId, 'start');
      this.runningProcesses.set(sessionId, proc);
      this._readProcessOutput(sessionId, proc, broadcastFn);
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
      void this.sessionRepo.update(sessionId, { status: 'ERROR' });
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to ${action} Claude Code: ${message}`);
    }
  }

  _readProcessOutput(sessionId: number, proc: ChildProcess, broadcastFn?: BroadcastFn) {
    const output: string[] = [];

    proc.stdout?.on('data', (data: Buffer | string) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }

        output.push(trimmed);
        broadcastFn?.(sessionId, 'output', {
          type: 'chunk',
          content: trimmed,
          stream: 'stdout',
          timestamp: new Date().toISOString(),
        });
      }
    });

    proc.stderr?.on('data', (data: Buffer | string) => {
      broadcastFn?.(sessionId, 'output', {
        type: 'chunk',
        content: data.toString(),
        stream: 'stderr',
        timestamp: new Date().toISOString(),
      });
    });

    proc.on('close', async (code) => {
      const status = code === 0 ? 'COMPLETED' : 'ERROR';

      await this.sessionRepo.update(sessionId, {
        status,
        output: output.join('\n'),
      });

      broadcastFn?.(sessionId, 'status', {
        type: 'status',
        status,
      });

      this.runningProcesses.delete(sessionId);
    });

    proc.on('error', async (error) => {
      await this.sessionRepo.update(sessionId, { status: 'ERROR' });
      broadcastFn?.(sessionId, 'output', {
        type: 'chunk',
        content: `Error: ${error.message}`,
        stream: 'stderr',
        timestamp: new Date().toISOString(),
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

    const updated = await this.sessionRepo.update(sessionId, { status: 'STOPPED' });

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

    await this.sessionRepo.update(sessionId, { status: 'RUNNING' });

    if (session.worktree_path && fs.existsSync(session.worktree_path)) {
      const proc = this._spawnClaudeCode(session.worktree_path, ['-y', '@anthropic-ai/claude-code', '--resume', '--prompt', input], sessionId, 'resume');
      this.runningProcesses.set(sessionId, proc);
      this._readProcessOutput(sessionId, proc, broadcastFn);
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
}

export { SessionService };
