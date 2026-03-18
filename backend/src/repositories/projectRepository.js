/**
 * Project Repository
 */
const { BaseRepository } = require('./base');

class ProjectRepository extends BaseRepository {
  constructor() {
    super('projects.json');
  }

  /**
   * Find project by ID with stats
   * @param {number} projectId - Project ID
   * @returns {Promise<object|null>} Project with stats or null
   */
  async findByIdWithStats(projectId) {
    const project = await this.findById(projectId);
    if (!project) {
      return null;
    }

    const taskRepo = new (require('./taskRepository'))();
    const counts = await taskRepo.countByProject(projectId);

    return {
      ...project,
      task_count: Object.values(counts).reduce((a, b) => a + b, 0),
      todo_count: counts.TODO || 0,
      in_progress_count: counts.IN_PROGRESS || 0,
      done_count: counts.DONE || 0,
    };
  }

  /**
   * Check if project exists
   * @param {number} projectId - Project ID
   * @returns {Promise<boolean>} True if exists
   */
  async exists(projectId) {
    const project = await this.findById(projectId);
    return project !== null;
  }
}

module.exports = { ProjectRepository };
