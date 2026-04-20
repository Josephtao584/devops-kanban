import { BaseRepository } from './base.js';
import type { ProjectEntity } from '../types/entities.js';

class ProjectRepository extends BaseRepository<ProjectEntity> {
  constructor() {
    super('projects');
  }

  protected override parseRow(row: Record<string, unknown>): ProjectEntity {
    return {
      ...row,
      env: row.env ? JSON.parse(row.env as string) : {},
    } as ProjectEntity;
  }

  protected override serializeRow(entity: Partial<ProjectEntity>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...entity };
    if (entity.env !== undefined) {
      result.env = JSON.stringify(entity.env);
    }
    return result;
  }
}

export { ProjectRepository };