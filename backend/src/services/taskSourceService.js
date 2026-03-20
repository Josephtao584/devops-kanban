/**
 * Task Source Service
 */
import { TaskSourceRepository } from '../repositories/taskSourceRepository.js';
import { TaskRepository } from '../repositories/taskRepository.js';
import { loadAdapterTypes } from '../config/taskSources.js';
import { getAdapter, hasAdapter, getAdapterMetadata } from '../sources/index.js';

class TaskSourceService {
  constructor() {
    this.repository = new TaskSourceRepository();
    this.taskRepository = new TaskRepository();
  }

  /**
   * Get all task sources
   * @returns {Promise<Array>} All task sources
   */
  async getAll() {
    return await this.repository.findAll();
  }

  /**
   * Get task source by ID
   * @param {string} sourceId - Source ID
   * @returns {Promise<object|null>} Task source or null
   */
  async getById(sourceId) {
    return await this.repository.findById(parseInt(sourceId, 10));
  }

  /**
   * Get all task sources for a project
   * @param {number} projectId - Project ID
   * @returns {Promise<Array>} Task sources
   */
  async getByProject(projectId) {
    return await this.repository.getByProject(projectId);
  }

  /**
   * Create a new task source
   * @param {object} sourceData - Task source data
   * @returns {Promise<object>} Created task source
   */
  async create(sourceData) {
    const { name, type, project_id, config = {}, enabled = true } = sourceData;

    if (!name || typeof name !== 'string') {
      const error = new Error('name is required and must be a string');
      error.statusCode = 400;
      throw error;
    }

    if (!type || typeof type !== 'string') {
      const error = new Error('type is required and must be a string');
      error.statusCode = 400;
      throw error;
    }

    if (!hasAdapter(type)) {
      const error = new Error(`Unsupported source type: ${type}`);
      error.statusCode = 400;
      throw error;
    }

    if (!project_id || typeof project_id !== 'number') {
      const error = new Error('project_id is required and must be a number');
      error.statusCode = 400;
      throw error;
    }

    const entity = await this.repository.create({
      name,
      type,
      project_id,
      config,
      enabled,
    });

    return entity;
  }

  /**
   * Update a task source
   * @param {string} sourceId - Source ID
   * @param {object} sourceData - Task source data to update
   * @returns {Promise<object|null>} Updated task source or null
   */
  async update(sourceId, sourceData) {
    const existing = await this.repository.findById(parseInt(sourceId, 10));
    if (!existing) {
      return null;
    }

    // If type is being changed, validate the new type
    if (sourceData.type && sourceData.type !== existing.type) {
      if (!hasAdapter(sourceData.type)) {
        const error = new Error(`Unsupported source type: ${sourceData.type}`);
        error.statusCode = 400;
        throw error;
      }
    }

    const updated = await this.repository.update(parseInt(sourceId, 10), sourceData);
    return updated;
  }

  /**
   * Delete a task source
   * @param {string} sourceId - Source ID
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(sourceId) {
    return await this.repository.delete(parseInt(sourceId, 10));
  }

  /**
   * Check if task source exists
   * @param {string} sourceId - Source ID
   * @returns {Promise<boolean>} True if exists
   */
  async exists(sourceId) {
    return await this.repository.exists(parseInt(sourceId, 10));
  }

  /**
   * Get available adapter types
   * @returns {Promise<Array>} Available adapter types
   */
  async getAvailableAdapterTypes() {
    const adapterTypes = await loadAdapterTypes();
    return adapterTypes;
  }

  /**
   * Sync task source - fetch items from external source and create tasks
   * @param {string} sourceId - Source ID
   * @returns {Promise<Array>} Created/synced tasks
   */
  async sync(sourceId) {
    const source = await this.repository.findById(parseInt(sourceId, 10));
    if (!source) {
      const error = new Error('Task source not found');
      error.statusCode = 404;
      throw error;
    }

    const adapter = getAdapter(source.type, source);
    const fetchedTasks = await adapter.fetch();
    const projectId = source.project_id;

    // Create tasks with project_id association, avoiding duplicates by external_id
    const createdTasks = [];
    for (const taskData of fetchedTasks) {
      // Check if task with this external_id already exists
      const existing = await this.taskRepository.findByExternalId(taskData.external_id);
      if (existing) {
        // Update existing task if needed
        if (existing.project_id !== projectId) {
          // Task exists but under different project - update project_id
          await this.taskRepository.update(existing.id, { project_id: projectId });
        }
        createdTasks.push({ ...existing, project_id: projectId });
      } else {
        // Create new task with project_id and source type
        const newTask = await this.taskRepository.create({
          ...taskData,
          project_id: projectId,
          source: source.type, // Track the source adapter type
        });
        createdTasks.push(newTask);
      }
    }

    // Update last_sync_at
    await this.repository.update(parseInt(sourceId, 10), {
      last_sync_at: new Date().toISOString(),
    });

    return createdTasks;
  }

  /**
   * Test connection to task source
   * @param {string} sourceId - Source ID
   * @returns {Promise<boolean>} True if connection successful
   */
  async testConnection(sourceId) {
    const source = await this.repository.findById(parseInt(sourceId, 10));
    if (!source) {
      const error = new Error('Task source not found');
      error.statusCode = 404;
      throw error;
    }

    const adapter = getAdapter(source.type, source);
    return await adapter.testConnection();
  }

  /**
   * Get adapter metadata for a source type
   * @param {string} type - Source type
   * @returns {object|null} Adapter metadata or null
   */
  getAdapterConfigFields(type) {
    return getAdapterMetadata(type);
  }

  /**
   * Preview sync issues (without creating tasks)
   * @param {string} sourceId - Source ID
   * @returns {Promise<Array>} Issues with imported flag
   */
  async previewSync(sourceId) {
    const source = await this.repository.findById(parseInt(sourceId, 10));
    if (!source) {
      const error = new Error('Task source not found');
      error.statusCode = 404;
      throw error;
    }

    const adapter = getAdapter(source.type, source);
    const issues = await adapter.fetch();

    // Check which issues are already imported (by external_id)
    const allTasks = await this.taskRepository.findAll();
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
   * @param {string} sourceId - Source ID
   * @param {Array} selectedItems - Selected issues to import
   * @param {number} projectId - Project ID
   * @param {number|null} iterationId - Iteration ID (optional)
   * @returns {Promise<object>} Import result
   */
  async importIssues(sourceId, selectedItems, projectId, iterationId = null) {
    const source = await this.repository.findById(parseInt(sourceId, 10));
    if (!source) {
      const error = new Error('Task source not found');
      error.statusCode = 404;
      throw error;
    }

    let created = 0;
    let skipped = 0;

    for (const item of selectedItems) {
      // Check if already imported (by external_id)
      const existing = await this.taskRepository.findByExternalId(item.external_id);
      if (existing) {
        skipped++;
        continue;
      }

      // Create task
      await this.taskRepository.create({
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
      });
      created++;
    }

    // Update source last sync time
    await this.repository.update(parseInt(sourceId, 10), {
      last_sync_at: new Date().toISOString(),
    });

    return { created, skipped, total: selectedItems.length };
  }
}

export { TaskSourceService };
