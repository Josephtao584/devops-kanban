/**
 * Iteration Repository
 */
import { BaseRepository } from './base.js';

class IterationRepository extends BaseRepository {
  constructor() {
    super('iterations.json');
  }

  /**
   * Find all iterations for a project
   * @param {number} projectId - Project ID
   * @returns {Promise<Array>} Iterations
   */
  async findByProject(projectId) {
    const data = await this._loadAll();
    return data.filter((item) => item.project_id === projectId);
  }

  /**
   * Find iteration by ID with task statistics
   * @param {number} iterationId - Iteration ID
   * @returns {Promise<object|null>} Iteration with stats or null
   */
  async findByIdWithStats(iterationId) {
    const iteration = await this.findById(iterationId);
    if (!iteration) {
      return null;
    }

    const taskRepo = new (await import('./taskRepository.js')).TaskRepository();
    const tasks = await taskRepo.findByProject(iteration.project_id);
    const iterationTasks = tasks.filter((t) => t.iteration_id === iterationId);

    const counts = {
      REQUIREMENTS: 0,
      TODO: 0,
      IN_PROGRESS: 0,
      DONE: 0,
      BLOCKED: 0,
      CANCELLED: 0,
    };

    for (const task of iterationTasks) {
      if (counts[task.status] !== undefined) {
        counts[task.status]++;
      }
    }

    const total = iterationTasks.length;
    const done = counts.DONE || 0;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;

    return {
      ...iteration,
      task_count: total,
      done_count: done,
      todo_count: counts.TODO || 0,
      in_progress_count: counts.IN_PROGRESS || 0,
      blocked_count: counts.BLOCKED || 0,
      cancelled_count: counts.CANCELLED || 0,
      progress,
    };
  }

  /**
   * Get tasks for an iteration
   * @param {number} iterationId - Iteration ID
   * @returns {Promise<Array>} Tasks
   */
  async findTasks(iterationId) {
    const taskRepo = new (await import('./taskRepository.js')).TaskRepository();
    const allTasks = await taskRepo.findAll();
    return allTasks.filter((task) => task.iteration_id === iterationId);
  }

  /**
   * Check if iteration exists
   * @param {number} iterationId - Iteration ID
   * @returns {Promise<boolean>} True if exists
   */
  async exists(iterationId) {
    const iteration = await this.findById(iterationId);
    return iteration !== null;
  }
}

export { IterationRepository };
