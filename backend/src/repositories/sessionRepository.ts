import { BaseRepository } from './base.js';
import type { SessionEntity } from '../types/entities.ts';

class SessionRepository extends BaseRepository<SessionEntity> {
  constructor() {
    super('sessions');
  }

  async getByTask(taskId: number): Promise<SessionEntity[]> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM sessions WHERE task_id = ?',
      args: [taskId],
    });
    return result.rows.map(row => this.parseRow(row as Record<string, unknown>));
  }

  async getActiveByTask(taskId: number): Promise<SessionEntity | null> {
    const result = await this.client.execute({
      sql: "SELECT * FROM sessions WHERE task_id = ? AND (status = 'RUNNING' OR status = 'IDLE') LIMIT 1",
      args: [taskId],
    });
    if (result.rows.length === 0) return null;
    return this.parseRow(result.rows[0] as Record<string, unknown>);
  }
}

export { SessionRepository };