import { BaseRepository } from './base.js';
import type { ProjectEntity } from '../types/entities.js';

class ProjectRepository extends BaseRepository<ProjectEntity> {
  constructor() {
    super('projects');
  }

  async exists(projectId: number): Promise<boolean> {
    const project = await this.findById(projectId);
    return project !== null;
  }
}

export { ProjectRepository };