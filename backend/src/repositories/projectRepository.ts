import { BaseRepository } from './base.js';
import type { BaseEntity } from './base.js';
import type { ProjectCreateRecord, ProjectUpdateRecord } from '../types/persistence/projects.js';
import type { ProjectEntity } from '../types/entities.ts';

interface StoredProjectEntity extends ProjectEntity, BaseEntity {}

class ProjectRepository extends BaseRepository<StoredProjectEntity, ProjectCreateRecord, ProjectUpdateRecord> {
  constructor(storagePath?: string) {
    super('projects.json', storagePath ? { storagePath } : undefined);
  }

  async exists(projectId: number): Promise<boolean> {
    const project = await this.findById(projectId);
    return project !== null;
  }
}

export { ProjectRepository };
