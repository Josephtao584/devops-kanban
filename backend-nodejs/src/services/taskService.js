/**
 * Task Service
 */
const { TaskRepository } = require('../repositories/taskRepository');
const { ProjectRepository } = require('../repositories/projectRepository');

class TaskService {
  constructor() {
    this.taskRepo = new TaskRepository();
    this.projectRepo = new ProjectRepository();
  }

  /**
   * Get all tasks
   * @returns {Promise<Array>} All tasks
   */
  async getAll() {
    return await this.taskRepo.findAll();
  }

  /**
   * Get task by ID
   * @param {number} taskId - Task ID
   * @returns {Promise<object|null>} Task or null
   */
  async getById(taskId) {
    return await this.taskRepo.findById(taskId);
  }

  /**
   * Get all tasks for a project
   * @param {number} projectId - Project ID
   * @returns {Promise<Array>} Tasks
   */
  async getByProject(projectId) {
    return await this.taskRepo.findByProject(projectId);
  }

  /**
   * Get tasks for a project grouped by status
   * @param {number} projectId - Project ID
   * @returns {Promise<object>} Tasks grouped by status
   */
  async getByProjectGrouped(projectId) {
    return await this.taskRepo.groupByStatus(projectId);
  }

  /**
   * Create a new task
   * @param {object} taskData - Task data
   * @returns {Promise<object>} Created task
   */
  async create(taskData) {
    // Verify project exists
    const projectExists = await this.projectRepo.exists(taskData.project_id);
    if (!projectExists) {
      const error = new Error('Project not found');
      error.statusCode = 400;
      throw error;
    }
    return await this.taskRepo.create(taskData);
  }

  /**
   * Update a task
   * @param {number} taskId - Task ID
   * @param {object} taskData - Task data to update
   * @returns {Promise<object|null>} Updated task or null
   */
  async update(taskId, taskData) {
    return await this.taskRepo.update(taskId, taskData);
  }

  /**
   * Update task status
   * @param {number} taskId - Task ID
   * @param {string} status - New status
   * @returns {Promise<object|null>} Updated task or null
   */
  async updateStatus(taskId, status) {
    return await this.taskRepo.update(taskId, { status });
  }

  /**
   * Delete a task
   * @param {number} taskId - Task ID
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(taskId) {
    return await this.taskRepo.delete(taskId);
  }

  /**
   * Check if task exists
   * @param {number} taskId - Task ID
   * @returns {Promise<boolean>} True if exists
   */
  async exists(taskId) {
    return await this.taskRepo.findById(taskId) !== null;
  }
}

module.exports = { TaskService };
