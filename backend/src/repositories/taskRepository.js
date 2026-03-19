/**
 * Task Repository
 */
import { BaseRepository } from './base.js';

class TaskRepository extends BaseRepository {
  constructor() {
    super('tasks.json');
  }

  /**
   * Find all tasks for a project
   * @param {number} projectId - Project ID
   * @returns {Promise<Array>} Tasks
   */
  async findByProject(projectId) {
    const data = await this._loadAll();
    return data.filter((item) => item.project_id === projectId);
  }

  /**
   * Find tasks by project and status
   * @param {number} projectId - Project ID
   * @param {string} status - Task status
   * @returns {Promise<Array>} Tasks
   */
  async findByProjectAndStatus(projectId, status) {
    const data = await this._loadAll();
    return data.filter(
      (item) => item.project_id === projectId && item.status === status
    );
  }

  /**
   * Count tasks by project grouped by status
   * @param {number} projectId - Project ID
   * @returns {Promise<object>} Counts by status
   */
  async countByProject(projectId) {
    const tasks = await this.findByProject(projectId);
    const counts = {
      REQUIREMENTS: 0,
      TODO: 0,
      IN_PROGRESS: 0,
      DONE: 0,
      BLOCKED: 0,
      CANCELLED: 0,
    };

    for (const task of tasks) {
      if (counts[task.status] !== undefined) {
        counts[task.status]++;
      }
    }

    return counts;
  }

  /**
   * Delete all tasks for a project
   * @param {number} projectId - Project ID
   * @returns {Promise<number>} Number of deleted tasks
   */
  async deleteByProject(projectId) {
    const data = await this._loadAll();
    const initialLength = data.length;
    const filtered = data.filter((item) => item.project_id !== projectId);
    await this._saveAll(filtered);
    return initialLength - filtered.length;
  }

  /**
   * Find all tasks with a specific status
   * @param {string} status - Task status
   * @returns {Promise<Array>} Tasks
   */
  async findByStatus(status) {
    const data = await this._loadAll();
    return data.filter((item) => item.status === status);
  }

  /**
   * Group tasks by status for a project
   * @param {number} projectId - Project ID
   * @returns {Promise<object>} Tasks grouped by status
   */
  async groupByStatus(projectId) {
    const tasks = await this.findByProject(projectId);
    const grouped = {
      REQUIREMENTS: [],
      TODO: [],
      IN_PROGRESS: [],
      DONE: [],
      BLOCKED: [],
      CANCELLED: [],
    };

    for (const task of tasks) {
      if (grouped[task.status] !== undefined) {
        grouped[task.status].push(task);
      }
    }

    return grouped;
  }
}

export { TaskRepository };
