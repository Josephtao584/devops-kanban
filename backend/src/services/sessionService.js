/**
 * Session Service
 */
const { SessionRepository } = require('../repositories/sessionRepository');
const { TaskService } = require('./taskService');
const { createWorktree, cleanupWorktree } = require('../utils/git');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class SessionService {
  constructor() {
    this.sessionRepo = new SessionRepository();
    this.taskService = new TaskService();
    this.runningProcesses = new Map(); // sessionId -> process
  }

  /**
   * Get all sessions
   * @param {object} filters - Filters (taskId, activeOnly)
   * @returns {Promise<Array>} Sessions
   */
  async getAll(filters = {}) {
    const { taskId, activeOnly } = filters;

    let sessions;
    if (taskId) {
      sessions = await this.sessionRepo.getByTask(taskId);
      if (activeOnly) {
        sessions = sessions.filter(
          (s) => s.status === 'RUNNING' || s.status === 'IDLE'
        );
      }
    } else {
      sessions = await this.sessionRepo.findAll();
    }

    return sessions;
  }

  /**
   * Get session by ID
   * @param {number} sessionId - Session ID
   * @returns {Promise<object|null>} Session or null
   */
  async getById(sessionId) {
    return await this.sessionRepo.findById(sessionId);
  }

  /**
   * Get active session for a task
   * @param {number} taskId - Task ID
   * @returns {Promise<object|null>} Active session or null
   */
  async getActiveByTask(taskId) {
    return await this.sessionRepo.getActiveByTask(taskId);
  }

  /**
   * Create a new session
   * @param {object} sessionData - Session data
   * @returns {Promise<object>} Created session
   */
  async create(sessionData) {
    // Verify task exists
    const task = await this.taskService.getById(sessionData.task_id);
    if (!task) {
      const error = new Error('Task not found');
      error.statusCode = 404;
      throw error;
    }

    // Use existing worktree if available, otherwise create new one
    let worktreePath;
    let branchName = `task/${sessionData.task_id}`;

    if (task.worktree_path && task.worktree_status === 'created') {
      // Use existing worktree
      worktreePath = task.worktree_path;
      branchName = task.worktree_branch || branchName;
    } else {
      // Create new worktree using TaskService
      try {
        const worktreeResult = await this.taskService.createWorktree(sessionData.task_id);
        worktreePath = worktreeResult.worktree_path;
        branchName = worktreeResult.worktree_branch;
      } catch (error) {
        // Fall back to old behavior if task has no project git config
        worktreePath = createWorktree(sessionData.task_id, task.title);
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

  /**
   * Start a session (run Claude Code)
   * @param {number} sessionId - Session ID
   * @param {Function} broadcastFn - Broadcast function for WebSocket
   * @returns {Promise<object>} Started session
   */
  async start(sessionId, broadcastFn) {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      const error = new Error('Session not found');
      error.statusCode = 404;
      throw error;
    }

    if (session.status === 'RUNNING' || session.status === 'IDLE') {
      return session;
    }

    // Get task for prompt
    const task = await this.taskService.getById(session.task_id);
    if (!task) {
      const error = new Error('Task not found');
      error.statusCode = 404;
      throw error;
    }

    // Update session status to RUNNING
    await this.sessionRepo.update(sessionId, { status: 'RUNNING' });

    // Start Claude Code in the worktree
    if (session.worktree_path && fs.existsSync(session.worktree_path)) {
      const prompt = session.initial_prompt || task.description;
      const cmd = 'npx';
      const args = [
        '-y',
        '@anthropic-ai/claude-code',
        '--prompt',
        prompt,
        '--verbose',
      ];

      try {
        const proc = spawn(cmd, args, {
          cwd: session.worktree_path,
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true,
        });

        this.runningProcesses.set(sessionId, proc);

        // Start reading output
        this._readProcessOutput(sessionId, proc, broadcastFn);
      } catch (error) {
        await this.sessionRepo.update(sessionId, { status: 'ERROR' });
        throw new Error(`Failed to start Claude Code: ${error.message}`);
      }
    }

    return await this.sessionRepo.findById(sessionId);
  }

  /**
   * Read process output and broadcast via WebSocket
   * @private
   */
  _readProcessOutput(sessionId, proc, broadcastFn) {
    const output = [];

    proc.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          output.push(trimmed);
          if (broadcastFn) {
            broadcastFn(sessionId, 'output', {
              type: 'chunk',
              content: trimmed,
              stream: 'stdout',
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    });

    proc.stderr.on('data', (data) => {
      const content = data.toString();
      if (broadcastFn) {
        broadcastFn(sessionId, 'output', {
          type: 'chunk',
          content: content,
          stream: 'stderr',
          timestamp: new Date().toISOString(),
        });
      }
    });

    proc.on('close', async (code) => {
      const status = code === 0 ? 'COMPLETED' : 'ERROR';

      await this.sessionRepo.update(sessionId, {
        status,
        output: output.join('\n'),
      });

      if (broadcastFn) {
        broadcastFn(sessionId, 'status', {
          type: 'status',
          status,
        });
      }

      // Clean up process
      this.runningProcesses.delete(sessionId);
    });

    proc.on('error', async (error) => {
      await this.sessionRepo.update(sessionId, { status: 'ERROR' });
      if (broadcastFn) {
        broadcastFn(sessionId, 'output', {
          type: 'chunk',
          content: `Error: ${error.message}`,
          stream: 'stderr',
          timestamp: new Date().toISOString(),
        });
      }
      this.runningProcesses.delete(sessionId);
    });
  }

  /**
   * Stop a running session
   * @param {number} sessionId - Session ID
   * @param {Function} broadcastFn - Broadcast function for WebSocket
   * @returns {Promise<object>} Stopped session
   */
  async stop(sessionId, broadcastFn) {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      const error = new Error('Session not found');
      error.statusCode = 404;
      throw error;
    }

    if (session.status !== 'RUNNING' && session.status !== 'IDLE') {
      return session;
    }

    // Kill the process if running
    const proc = this.runningProcesses.get(sessionId);
    if (proc) {
      proc.kill('SIGTERM');
      try {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            proc.kill('SIGKILL');
            resolve();
          }, 5000);
          proc.on('close', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      } catch (error) {
        // Force kill if needed
        proc.kill('SIGKILL');
      }
      this.runningProcesses.delete(sessionId);
    }

    // Update session status
    const updated = await this.sessionRepo.update(sessionId, {
      status: 'STOPPED',
    });

    if (broadcastFn) {
      broadcastFn(sessionId, 'status', {
        type: 'status',
        status: 'STOPPED',
      });
    }

    return updated;
  }

  /**
   * Continue a stopped session with new input
   * @param {number} sessionId - Session ID
   * @param {string} input - Input to continue with
   * @param {Function} broadcastFn - Broadcast function for WebSocket
   * @returns {Promise<object>} Continued session
   */
  async continue(sessionId, input, broadcastFn) {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      const error = new Error('Session not found');
      error.statusCode = 404;
      throw error;
    }

    if (session.status !== 'STOPPED') {
      const error = new Error('Session is not stopped');
      error.statusCode = 400;
      throw error;
    }

    // Update session status to RUNNING
    await this.sessionRepo.update(sessionId, { status: 'RUNNING' });

    // Resume Claude Code with --resume flag
    if (session.worktree_path && fs.existsSync(session.worktree_path)) {
      const cmd = 'npx';
      const args = [
        '-y',
        '@anthropic-ai/claude-code',
        '--resume',
        '--prompt',
        input,
      ];

      try {
        const proc = spawn(cmd, args, {
          cwd: session.worktree_path,
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true,
        });

        this.runningProcesses.set(sessionId, proc);
        this._readProcessOutput(sessionId, proc, broadcastFn);
      } catch (error) {
        await this.sessionRepo.update(sessionId, { status: 'ERROR' });
        throw new Error(`Failed to resume Claude Code: ${error.message}`);
      }
    }

    return await this.sessionRepo.findById(sessionId);
  }

  /**
   * Send input to a running session
   * @param {number} sessionId - Session ID
   * @param {string} input - Input to send
   * @returns {Promise<boolean>} True if sent
   */
  async sendInput(sessionId, input) {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      const error = new Error('Session not found');
      error.statusCode = 404;
      throw error;
    }

    if (session.status !== 'RUNNING' && session.status !== 'IDLE') {
      const error = new Error('Session is not running');
      error.statusCode = 400;
      throw error;
    }

    const proc = this.runningProcesses.get(sessionId);
    if (proc && proc.stdin.writable) {
      proc.stdin.write(input + '\n');
      return true;
    }

    return false;
  }

  /**
   * Delete a session
   * @param {number} sessionId - Session ID
   * @param {Function} broadcastFn - Broadcast function for WebSocket
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(sessionId, broadcastFn) {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      const error = new Error('Session not found');
      error.statusCode = 404;
      throw error;
    }

    // Stop if running
    if (session.status === 'RUNNING' || session.status === 'IDLE') {
      await this.stop(sessionId, broadcastFn);
    }

    // Cleanup worktree
    if (session.worktree_path) {
      cleanupWorktree(session.worktree_path);
    }

    return await this.sessionRepo.delete(sessionId);
  }

  /**
   * Check if session exists
   * @param {number} sessionId - Session ID
   * @returns {Promise<boolean>} True if exists
   */
  async exists(sessionId) {
    return await this.sessionRepo.findById(sessionId) !== null;
  }
}

module.exports = { SessionService };
