import { BaseRepository } from './base.js';
import type { ProjectEntity } from '../types/entities.js';

class ProjectRepository extends BaseRepository<ProjectEntity> {
  constructor() {
    super('projects');
  }
}

export { ProjectRepository };