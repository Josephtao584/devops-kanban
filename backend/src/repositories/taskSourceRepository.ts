import { BaseRepository } from './base.js';
import type { TaskSourceEntity } from '../types/entities.js';

class TaskSourceRepository extends BaseRepository<TaskSourceEntity> {
  constructor() {
    super('task_sources');
  }

  protected override parseRow(row: Record<string, unknown>): TaskSourceEntity {
    return {
      ...row,
      config: row.config ? JSON.parse(row.config as string) : {},
    } as TaskSourceEntity;
  }

  protected override serializeRow(entity: Partial<TaskSourceEntity>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...entity };
    if (entity.config !== undefined) {
      result.config = JSON.stringify(entity.config);
    }
    return result;
  }

  async getByProject(projectId: number): Promise<TaskSourceEntity[]> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM task_sources WHERE project_id = ?',
      args: [projectId],
    });
    return result.rows.map(row => this.parseRow(row as Record<string, unknown>));
  }

  async exists(sourceId: number): Promise<boolean> {
    const source = await this.findById(sourceId);
    return source !== null;
  }

  async deleteByProject(projectId: number): Promise<number> {
    const result = await this.client.execute({
      sql: 'DELETE FROM task_sources WHERE project_id = ?',
      args: [projectId],
    });
    return result.rowsAffected;
  }
}

export { TaskSourceRepository };