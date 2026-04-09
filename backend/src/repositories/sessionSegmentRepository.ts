import { BaseRepository } from './base.js';
import { withRetry } from '../db/retry.js';
import type { InValue } from '@libsql/client';
import type { SessionSegmentEntity } from '../types/entities.ts';

type CreateSessionSegmentRecord = Omit<SessionSegmentEntity, 'id' | 'segment_index' | 'created_at' | 'updated_at'>;

class SessionSegmentRepository extends BaseRepository<SessionSegmentEntity> {
  constructor() {
    super('session_segments');
  }

  protected override parseRow(row: Record<string, unknown>): SessionSegmentEntity {
    return {
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
    } as SessionSegmentEntity;
  }

  protected override serializeRow(entity: Partial<SessionSegmentEntity>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...entity };
    if (entity.metadata !== undefined) {
      result.metadata = JSON.stringify(entity.metadata);
    }
    return result;
  }

  async findBySessionId(sessionId: number): Promise<SessionSegmentEntity[]> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM session_segments WHERE session_id = ? ORDER BY segment_index, id',
      args: [sessionId],
    });
    return result.rows.map(row => this.parseRow(row as Record<string, unknown>));
  }

  async findLatestBySessionId(sessionId: number): Promise<SessionSegmentEntity | null> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM session_segments WHERE session_id = ? ORDER BY segment_index DESC LIMIT 1',
      args: [sessionId],
    });
    if (result.rows.length === 0) return null;
    return this.parseRow(result.rows[0] as Record<string, unknown>);
  }

  override async create(segment: CreateSessionSegmentRecord): Promise<SessionSegmentEntity> {
    return withRetry(async () => {
      const txn = await this.client.transaction('write');
      try {
        // Get max segment_index in transaction
        const maxResult = await txn.execute({
          sql: 'SELECT MAX(segment_index) as max_index FROM session_segments WHERE session_id = ?',
          args: [segment.session_id],
        });
        const nextSegmentIndex = (Number(maxResult.rows[0]?.max_index) || 0) + 1;
        const now = new Date().toISOString();

        // Insert with computed segment_index
        const serialized = this.serializeRow(segment as Partial<SessionSegmentEntity>);
        const columns = Object.keys(serialized);
        const values = Object.values(serialized);

        const insertResult = await txn.execute({
          sql: `INSERT INTO session_segments (${columns.join(', ')}, segment_index, created_at, updated_at) VALUES (${columns.map(() => '?').join(', ')}, ?, ?, ?)`,
          args: [...values as InValue[], nextSegmentIndex, now, now],
        });

        await txn.commit();

        // Fetch the created record
        const created = await this.findById(Number(insertResult.lastInsertRowid));
        if (!created) {
          throw new Error('Failed to fetch created session segment');
        }
        return created;
      } catch (error) {
        await txn.rollback();
        throw error;
      } finally {
        txn.close();
      }
    });
  }
}

export { SessionSegmentRepository };
export type { CreateSessionSegmentRecord };