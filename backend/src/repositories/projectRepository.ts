import { BaseRepository } from './base.js';
import type { ProjectEntity } from '../types/entities.ts';

class ProjectRepository extends BaseRepository<ProjectEntity> {
  constructor() {
    super('projects.json');
  }

  async exists(projectId: number): Promise<boolean> {
    const project = await this.findById(projectId);
    return project !== null;
  }
}

export { ProjectRepository };
