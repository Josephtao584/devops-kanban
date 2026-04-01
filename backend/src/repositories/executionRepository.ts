import { BaseRepository } from './base.js';
import type { ExecutionEntity } from '../types/entities.js';

class ExecutionRepository extends BaseRepository<ExecutionEntity> {
  constructor() {
    super('executions');
  }

  async getBySession(sessionId: number): Promise<ExecutionEntity[]> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM executions WHERE session_id = ?',
      args: [sessionId],
    });
    return result.rows.map(row => this.parseRow(row as Record<string, unknown>));
  }

  async getByTask(taskId: number): Promise<ExecutionEntity[]> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM executions WHERE task_id = ?',
      args: [taskId],
    });
    return result.rows.map(row => this.parseRow(row as Record<string, unknown>));
  }

  async getLatestBySession(sessionId: number): Promise<ExecutionEntity | null> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM executions WHERE session_id = ? ORDER BY created_at DESC LIMIT 1',
      args: [sessionId],
    });
    if (result.rows.length === 0) return null;
    return this.parseRow(result.rows[0] as Record<string, unknown>);
  }
}

export { ExecutionRepository };