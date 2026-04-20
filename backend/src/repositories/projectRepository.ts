import { BaseRepository } from './base.js';
import type { ProjectEntity } from '../types/entities.js';

class ProjectRepository extends BaseRepository<ProjectEntity> {
  constructor() {
    super('projects');
  }

  protected override parseRow(row: Record<string, unknown>): ProjectEntity {
    let env: Record<string, string> = {};
    if (row.env) {
      try {
        const parsed = JSON.parse(row.env as string);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          env = parsed;
        }
      } catch {
        // Malformed JSON in database — fall back to empty env
      }
    }
    return {
      ...row,
      env,
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