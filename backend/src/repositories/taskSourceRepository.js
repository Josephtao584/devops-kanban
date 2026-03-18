/**
 * Task Source Repository
 */
const { BaseRepository } = require('./base');

class TaskSourceRepository extends BaseRepository {
  constructor() {
    super('task_sources.json');
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

module.exports = { TaskSourceRepository };
