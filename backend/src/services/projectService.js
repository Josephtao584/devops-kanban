/**
 * Project Service
 */
import { ProjectRepository } from '../repositories/projectRepository.js';
import { TaskRepository } from '../repositories/taskRepository.js';

class ProjectService {
  constructor() {
    this.projectRepo = new ProjectRepository();
    this.taskRepo = new TaskRepository();
  }

  /**
   * Get all projects
   * @returns {Promise<Array>} All projects
   */
  async getAll() {
    return await this.projectRepo.findAll();
  }

  /**
   * Get project by ID
   * @param {number} projectId - Project ID
   * @returns {Promise<object|null>} Project or null
   */
  async getById(projectId) {
    return await this.projectRepo.findById(projectId);
  }

  /**
   * Get project with task statistics
   * @param {number} projectId - Project ID
   * @returns {Promise<object|null>} Project with stats or null
   */
  async getWithStats(projectId) {
    return await this.projectRepo.findByIdWithStats(projectId);
  }

  /**
   * Create a new project
   * @param {object} projectData - Project data
   * @returns {Promise<object>} Created project
   */
  async create(projectData) {
    return await this.projectRepo.create(projectData);
  }

  /**
   * Update a project
   * @param {number} projectId - Project ID
   * @param {object} projectData - Project data to update
   * @returns {Promise<object|null>} Updated project or null
   */
  async update(projectId, projectData) {
    return await this.projectRepo.update(projectId, projectData);
  }

  /**
   * Delete a project and its tasks
   * @param {number} projectId - Project ID
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(projectId) {
    // Delete associated tasks first
    await this.taskRepo.deleteByProject(projectId);
    return await this.projectRepo.delete(projectId);
  }

  /**
   * Check if project exists
   * @param {number} projectId - Project ID
   * @returns {Promise<boolean>} True if exists
   */
  async exists(projectId) {
    return await this.projectRepo.exists(projectId);
  }
}

export { ProjectService };
