import { BaseRepository } from './base.js';
import type { IterationEntity } from '../types/entities.ts';

class IterationRepository extends BaseRepository<IterationEntity> {
  constructor() {
    super('iterations');
  }

  async findByProject(projectId: number): Promise<IterationEntity[]> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM iterations WHERE project_id = ?',
      args: [projectId],
    });
    return result.rows.map(row => this.parseRow(row as Record<string, unknown>));
  }

  async deleteByProject(projectId: number): Promise<number> {
    const result = await this.client.execute({
      sql: 'DELETE FROM iterations WHERE project_id = ?',
      args: [projectId],
    });
    return result.rowsAffected;
  }
}

export { IterationRepository };