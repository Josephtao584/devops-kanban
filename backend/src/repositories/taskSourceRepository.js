/**
 * Task Source Repository
 */
import fs from 'fs/promises';
import path from 'path';
import { TASK_SOURCE_DATA_PATH } from '../config/index.js';

class TaskSourceRepository {
  constructor() {
    this.fileName = 'task_sources.json';
    this.filepath = path.join(TASK_SOURCE_DATA_PATH, this.fileName);
    this._ensureFileExists();
  }

  /**
   * Ensure the data file exists
   * @private
   */
  async _ensureFileExists() {
    try {
      await fs.access(this.filepath);
    } catch {
      await fs.mkdir(TASK_SOURCE_DATA_PATH, { recursive: true });
      await this._saveAll([]);
    }
  }

  /**
   * Load all data from JSON file
   * @returns {Promise<Array>} All data
   */
  async _loadAll() {
    try {
      const data = await fs.readFile(this.filepath, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  }

  /**
   * Save all data to JSON file
   * @param {Array} data - Data to save
   */
  async _saveAll(data) {
    await fs.mkdir(path.dirname(this.filepath), { recursive: true });
    await fs.writeFile(this.filepath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Get the next available ID
   * @param {Array} data - Current data
   * @returns {number} Next ID
   */
  _getNextId(data) {
    if (!data || data.length === 0) {
      return 1;
    }
    return Math.max(...data.map((item) => item.id || 0)) + 1;
  }

  /**
   * Find all entities
   * @returns {Promise<Array>} All entities
   */
  async findAll() {
    const data = await this._loadAll();
    return data;
  }

  /**
   * Find entity by ID
   * @param {number} entityId - Entity ID
   * @returns {Promise<object|null>} Entity or null
   */
  async findById(entityId) {
    const data = await this._loadAll();
    return data.find((item) => item.id === entityId) || null;
  }

  /**
   * Create a new entity
   * @param {object} entityData - Entity data
   * @returns {Promise<object>} Created entity
   */
  async create(entityData) {
    const data = await this._loadAll();
    const newId = this._getNextId(data);

    const now = new Date().toISOString();
    const entity = {
      ...entityData,
      id: newId,
      created_at: now,
      updated_at: now,
    };

    data.push(entity);
    await this._saveAll(data);

    return entity;
  }

  /**
   * Update an existing entity
   * @param {number} entityId - Entity ID
   * @param {object} entityData - Entity data to update
   * @returns {Promise<object|null>} Updated entity or null
   */
  async update(entityId, entityData) {
    const data = await this._loadAll();
    const index = data.findIndex((item) => item.id === entityId);

    if (index === -1) {
      return null;
    }

    const updateData = {};
    for (const key of Object.keys(entityData)) {
      if (entityData[key] !== undefined) {
        updateData[key] = entityData[key];
      }
    }
    updateData.updated_at = new Date().toISOString();

    data[index] = { ...data[index], ...updateData };
    await this._saveAll(data);

    return data[index];
  }

  /**
   * Delete an entity by ID
   * @param {number} entityId - Entity ID
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(entityId) {
    const data = await this._loadAll();
    const initialLength = data.length;
    const filtered = data.filter((item) => item.id !== entityId);

    if (filtered.length < initialLength) {
      await this._saveAll(filtered);
      return true;
    }
    return false;
  }

  /**
   * Get all task sources for a project
   * @param {number} projectId - Project ID
   * @returns {Promise<Array>} Task sources
   */
  async getByProject(projectId) {
    const data = await this._loadAll();
    return data.filter((item) => item.project_id === projectId);
  }

  /**
   * Check if task source exists
   * @param {number} sourceId - Source ID
   * @returns {Promise<boolean>} True if exists
   */
  async exists(sourceId) {
    const source = await this.findById(sourceId);
    return source !== null;
  }
}

export { TaskSourceRepository };
