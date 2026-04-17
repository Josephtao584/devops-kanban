import { BaseRepository } from './base.js';
import type { SessionEntity } from '../types/entities.ts';

class SessionRepository extends BaseRepository<SessionEntity> {
  constructor() {
    super('sessions');
  }

  protected override parseRow(row: Record<string, unknown>): SessionEntity {
    if (typeof row.metadata === 'string') {
      try {
        return { ...row, metadata: JSON.parse(row.metadata) } as unknown as SessionEntity;
      } catch {
        return { ...row, metadata: {} } as unknown as SessionEntity;
      }
    }
    return row as unknown as SessionEntity;
  }

  protected override serializeRow(entity: Partial<SessionEntity>): Record<string, unknown> {
    const data = { ...entity } as Record<string, unknown>;
    if (data.metadata !== undefined && data.metadata !== null) {
      data.metadata = typeof data.metadata === 'string'
        ? data.metadata
        : JSON.stringify(data.metadata);
    }
    return data;
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

  async getByWorktreePath(worktreePath: string): Promise<SessionEntity[]> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM sessions WHERE worktree_path = ? ORDER BY started_at DESC',
      args: [worktreePath],
    });
    return result.rows.map(row => this.parseRow(row as Record<string, unknown>));
  }

  async countByWorktreePath(worktreePath: string): Promise<number> {
    const result = await this.client.execute({
      sql: 'SELECT COUNT(*) as count FROM sessions WHERE worktree_path = ?',
      args: [worktreePath],
    });
    return Number(result.rows[0]?.count ?? 0);
  }

  async getByWorktreePathPaginated(worktreePath: string, options: { offset: number; limit: number }): Promise<{ rows: SessionEntity[]; total: number }> {
    const [countResult, sessionsResult] = await Promise.all([
      this.client.execute({
        sql: 'SELECT COUNT(*) as count FROM sessions WHERE worktree_path = ?',
        args: [worktreePath],
      }),
      this.client.execute({
        sql: 'SELECT * FROM sessions WHERE worktree_path = ? ORDER BY started_at DESC LIMIT ? OFFSET ?',
        args: [worktreePath, options.limit, options.offset],
      }),
    ]);
    return {
      rows: sessionsResult.rows.map(row => this.parseRow(row as Record<string, unknown>)),
      total: Number(countResult.rows[0]?.count ?? 0),
    };
  }
}

export { SessionRepository };