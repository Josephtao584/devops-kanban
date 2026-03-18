/**
 * Task Source Service
 */
const { TaskSourceRepository } = require('../repositories/taskSourceRepository');
const { ProjectRepository } = require('../repositories/projectRepository');

class TaskSourceService {
  constructor() {
    this.taskSourceRepo = new TaskSourceRepository();
    this.projectRepo = new ProjectRepository();
  }

  /**
   * Get all task sources
   * @returns {Promise<Array>} All task sources
   */
  async getAll() {
    return await this.taskSourceRepo.findAll();
  }

  /**
   * Get task source by ID
   * @param {number} sourceId - Source ID
   * @returns {Promise<object|null>} Task source or null
   */
  async getById(sourceId) {
    return await this.taskSourceRepo.findById(sourceId);
  }

  /**
   * Get all task sources for a project
   * @param {number} projectId - Project ID
   * @returns {Promise<Array>} Task sources
   */
  async getByProject(projectId) {
    return await this.taskSourceRepo.getByProject(projectId);
  }

  /**
   * Create a new task source
   * @param {object} sourceData - Task source data
   * @returns {Promise<object>} Created task source
   */
  async create(sourceData) {
    // Verify project exists
    const projectExists = await this.projectRepo.exists(sourceData.project_id);
    if (!projectExists) {
      const error = new Error('Project not found');
      error.statusCode = 400;
      throw error;
    }
    return await this.taskSourceRepo.create(sourceData);
  }

  /**
   * Update a task source
   * @param {number} sourceId - Source ID
   * @param {object} sourceData - Task source data to update
   * @returns {Promise<object|null>} Updated task source or null
   */
  async update(sourceId, sourceData) {
    return await this.taskSourceRepo.update(sourceId, sourceData);
  }

  /**
   * Delete a task source
   * @param {number} sourceId - Source ID
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(sourceId) {
    return await this.taskSourceRepo.delete(sourceId);
  }

  /**
   * Check if task source exists
   * @param {number} sourceId - Source ID
   * @returns {Promise<boolean>} True if exists
   */
  async exists(sourceId) {
    return await this.taskSourceRepo.exists(sourceId);
  }

  /**
   * Get available source types
   * @returns {object} Available source types
   */
  getAvailableSourceTypes() {
    return {
      GITHUB: {
        name: 'GitHub Issues',
        description: 'Sync tasks from GitHub Issues',
        config: {
          repo: {
            type: 'string',
            required: true,
            description: 'Repository in format owner/repo',
          },
          token: {
            type: 'string',
            required: false,
            description: 'GitHub Personal Access Token',
          },
          labels: {
            type: 'array',
            required: false,
            description: 'Filter by labels',
          },
        },
      },
    };
  }
}

module.exports = { TaskSourceService };
