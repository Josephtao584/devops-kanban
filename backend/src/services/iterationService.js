/**
 * Iteration Service
 */
import { IterationRepository } from '../repositories/iterationRepository.js';
import { ProjectRepository } from '../repositories/projectRepository.js';

class IterationService {
  constructor() {
    this.iterationRepo = new IterationRepository();
    this.projectRepo = new ProjectRepository();
  }

  /**
   * Get all iterations for a project
   * @param {number} projectId - Project ID
   * @returns {Promise<Array>} All iterations
   */
  async getByProject(projectId) {
    return await this.iterationRepo.findByProject(projectId);
  }

  /**
   * Get iteration by ID with statistics
   * @param {number} iterationId - Iteration ID
   * @returns {Promise<object|null>} Iteration with stats or null
   */
  async getByIdWithStats(iterationId) {
    return await this.iterationRepo.findByIdWithStats(iterationId);
  }

  /**
   * Get iteration by ID
   * @param {number} iterationId - Iteration ID
   * @returns {Promise<object|null>} Iteration or null
   */
  async getById(iterationId) {
    return await this.iterationRepo.findById(iterationId);
  }

  /**
   * Get tasks for an iteration
   * @param {number} iterationId - Iteration ID
   * @returns {Promise<Array>} Tasks
   */
  async getTasks(iterationId) {
    return await this.iterationRepo.findTasks(iterationId);
  }

  /**
   * Create a new iteration
   * @param {object} iterationData - Iteration data
   * @returns {Promise<object>} Created iteration
   */
  async create(iterationData) {
    // Validate required fields
    if (!iterationData.name || !iterationData.name.trim()) {
      const error = new Error('迭代名称不能为空');
      error.statusCode = 400;
      throw error;
    }

    if (!iterationData.project_id) {
      const error = new Error('项目 ID 不能为空');
      error.statusCode = 400;
      throw error;
    }

    // Verify project exists
    const projectExists = await this.projectRepo.exists(iterationData.project_id);
    if (!projectExists) {
      const error = new Error('项目不存在');
      error.statusCode = 400;
      throw error;
    }

    // Set default values
    if (!iterationData.status) {
      iterationData.status = 'PLANNED';
    }

    return await this.iterationRepo.create(iterationData);
  }

  /**
   * Update an iteration
   * @param {number} iterationId - Iteration ID
   * @param {object} iterationData - Iteration data to update
   * @returns {Promise<object|null>} Updated iteration or null
   */
  async update(iterationId, iterationData) {
    return await this.iterationRepo.update(iterationId, iterationData);
  }

  /**
   * Update iteration status
   * @param {number} iterationId - Iteration ID
   * @param {string} status - New status
   * @returns {Promise<object|null>} Updated iteration or null
   */
  async updateStatus(iterationId, status) {
    return await this.iterationRepo.update(iterationId, { status });
  }

  /**
   * Delete an iteration
   * @param {number} iterationId - Iteration ID
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(iterationId) {
    return await this.iterationRepo.delete(iterationId);
  }

  /**
   * Check if iteration exists
   * @param {number} iterationId - Iteration ID
   * @returns {Promise<boolean>} True if exists
   */
  async exists(iterationId) {
    return await this.iterationRepo.exists(iterationId);
  }
}

export { IterationService };
