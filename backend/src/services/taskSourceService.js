/**
 * Task Source Service
 */
import { TaskSourceRepository } from '../repositories/taskSourceRepository.js';
import { ProjectRepository } from '../repositories/projectRepository.js';
import { BaseRepository } from '../repositories/base.js';
import { getAdapter, getAvailableTypes } from '../adapters/index.js';

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
    return getAvailableTypes();
  }

  /**
   * Get adapter based on source type
   * @param {object} source - Task source
   * @returns {object} Adapter instance
   */
  getAdapter(source) {
    return getAdapter(source.type, source);
  }

  /**
   * Preview issues from task source (without creating tasks)
   * @param {number} sourceId - Source ID
   * @returns {Promise<Array>} Issues list
   */
  async previewSync(sourceId) {
    const source = await this.getById(sourceId);
    if (!source) {
      throw new Error('Task source not found');
    }

    const adapter = this.getAdapter(source);
    const issues = await adapter.fetch();

    // Check which issues are already imported (using task repository)
    const taskRepo = new BaseRepository('tasks.json');
    const allTasks = await taskRepo.findAll();
    const importedExternalIds = new Set(
      allTasks
        .filter((task) => task.external_id)
        .map((task) => task.external_id)
    );

    // Mark each issue with import status
    return issues.map((issue) => ({
      ...issue,
      imported: importedExternalIds.has(issue.external_id),
    }));
  }

  /**
   * Import selected issues as tasks
   * @param {number} sourceId - Source ID
   * @param {Array} selectedItems - Selected issues to import
   * @param {number} projectId - Project ID
   * @param {number|null} iterationId - Iteration ID (optional)
   * @returns {Promise<object>} Import result
   */
  async importIssues(sourceId, selectedItems, projectId, iterationId = null) {
    const source = await this.getById(sourceId);
    if (!source) {
      throw new Error('Task source not found');
    }

    // Verify project exists
    const projectExists = await this.projectRepo.exists(projectId);
    if (!projectExists) {
      throw new Error('Project not found');
    }

    // Use task repository instead of requirement repository
    const taskRepo = new BaseRepository('tasks.json');

    let created = 0;
    let skipped = 0;

    for (const item of selectedItems) {
      // Check if already imported (by external_id)
      const allTasks = await taskRepo.findAll();
      const existing = allTasks.find(t => t.external_id === item.external_id);
      if (existing) {
        skipped++;
        continue;
      }

      // Create task
      await taskRepo.create({
        project_id: projectId,
        title: item.title,
        description: item.description,
        status: 'TODO',
        priority: 'MEDIUM',
        external_id: item.external_id,
        external_url: item.external_url,
        source: source.type,
        labels: item.labels || [],
        iteration_id: iterationId || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      created++;
    }

    // Update source last sync time
    await this.update(sourceId, { last_sync_at: new Date().toISOString() });

    return { created, skipped, total: selectedItems.length };
  }
}

export { TaskSourceService };
