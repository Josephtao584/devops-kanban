/**
 * Session Repository
 */
import { BaseRepository } from './base.js';

class SessionRepository extends BaseRepository {
  constructor() {
    super('sessions.json');
  }

  /**
   * Get all sessions for a task
   * @param {number} taskId - Task ID
   * @returns {Promise<Array>} Sessions
   */
  async getByTask(taskId) {
    const data = await this._loadAll();
    return data.filter((item) => item.task_id === taskId);
  }

  /**
   * Get the active (running or idle) session for a task
   * @param {number} taskId - Task ID
   * @returns {Promise<object|null>} Active session or null
   */
  async getActiveByTask(taskId) {
    const sessions = await this.getByTask(taskId);
    for (const session of sessions) {
      if (session.status === 'RUNNING' || session.status === 'IDLE') {
        return session;
      }
    }
    return null;
  }

  /**
   * Create a new session
   * @param {object} sessionData - Session data
   * @returns {Promise<object>} Created session
   */
  async create(sessionData) {
    const data = await this._loadAll();
    const newId = this._getNextId(data);

    const now = new Date().toISOString();
    const session = {
      ...sessionData,
      id: newId,
      created_at: now,
      updated_at: now,
      output: '',
    };

    data.push(session);
    await this._saveAll(data);

    return session;
  }

  /**
   * Update an existing session
   * @param {number} sessionId - Session ID
   * @param {object} sessionData - Session data to update
   * @returns {Promise<object|null>} Updated session or null
   */
  async update(sessionId, sessionData) {
    const data = await this._loadAll();
    const index = data.findIndex((item) => item.id === sessionId);

    if (index === -1) {
      return null;
    }

    const updateData = {};
    for (const key of Object.keys(sessionData)) {
      if (sessionData[key] !== undefined) {
        updateData[key] = sessionData[key];
      }
    }
    updateData.updated_at = new Date().toISOString();

    data[index] = { ...data[index], ...updateData };
    await this._saveAll(data);

    return data[index];
  }
}

export { SessionRepository };
