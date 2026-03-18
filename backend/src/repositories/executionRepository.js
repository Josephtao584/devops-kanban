/**
 * Execution Repository
 */
const { BaseRepository } = require('./base');

class ExecutionRepository extends BaseRepository {
  constructor() {
    super('executions.json');
  }

  /**
   * Get all executions for a session
   * @param {number} sessionId - Session ID
   * @returns {Promise<Array>} Executions
   */
  async getBySession(sessionId) {
    const data = await this._loadAll();
    return data.filter((item) => item.session_id === sessionId);
  }

  /**
   * Get all executions for a task
   * @param {number} taskId - Task ID
   * @returns {Promise<Array>} Executions
   */
  async getByTask(taskId) {
    const data = await this._loadAll();
    return data.filter((item) => item.task_id === taskId);
  }

  /**
   * Get the latest execution for a session
   * @param {number} sessionId - Session ID
   * @returns {Promise<object|null>} Latest execution or null
   */
  async getLatestBySession(sessionId) {
    const executions = await this.getBySession(sessionId);
    if (executions.length === 0) {
      return null;
    }
    return executions.reduce((latest, current) =>
      current.created_at > latest.created_at ? current : latest
    );
  }
}

module.exports = { ExecutionRepository };
