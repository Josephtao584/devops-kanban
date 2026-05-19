import { BaseRepository } from './base.js';
import { withRetry } from '../db/retry.js';
import type { InValue } from '@libsql/client';
import type { SessionEventEntity } from '../types/entities.ts';
import { safeJsonParse } from '../utils/safeJson.js';

type CreateSessionEventRecord = Omit<SessionEventEntity, 'id' | 'seq' | 'created_at' | 'updated_at'>;

class SessionEventRepository extends BaseRepository<SessionEventEntity> {
  constructor() {
    super('session_events');
  }

  protected override parseRow(row: Record<string, unknown>): SessionEventEntity {
    return {
      ...row,
      payload: safeJsonParse(row.payload, {} as Record<string, unknown>, 'session_events.payload'),
    } as SessionEventEntity;
  }

  protected override serializeRow(entity: Partial<SessionEventEntity>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...entity };
    if (entity.payload !== undefined) {
      result.payload = JSON.stringify(entity.payload);
    }
    return result;
  }

  override async create(event: CreateSessionEventRecord): Promise<SessionEventEntity> {
    return await this.append(event);
  }

  async append(event: CreateSessionEventRecord): Promise<SessionEventEntity> {
    return withRetry(async () => {
      const txn = await this.client.transaction('write');
      let committed = false;
      try {
        // Get max seq in transaction
        const maxResult = await txn.execute({
          sql: 'SELECT MAX(seq) as max_seq FROM session_events WHERE session_id = ?',
          args: [event.session_id],
        });
        const nextSeq = (Number(maxResult.rows[0]?.max_seq) || 0) + 1;
        const now = new Date().toISOString();

        // Insert with computed seq
        const serialized = this.serializeRow(event as Partial<SessionEventEntity>);
        const columns = Object.keys(serialized);
        const values = Object.values(serialized);

        const insertResult = await txn.execute({
          sql: `INSERT INTO session_events (${columns.join(', ')}, seq, created_at, updated_at) VALUES (${columns.map(() => '?').join(', ')}, ?, ?, ?)`,
          args: [...values as InValue[], nextSeq, now, now],
        });

        await txn.commit();
        committed = true;

        // Fetch the created record
        const created = await this.findById(Number(insertResult.lastInsertRowid));
        if (!created) {
          throw new Error('Failed to fetch created session event');
        }
        return created;
      } catch (error) {
        if (!committed) {
          try {
            await txn.rollback();
          } catch {
            // rollback may fail if the txn is already closed/aborted
          }
        }
        throw error;
      } finally {
        try {
          txn.close();
        } catch {
          // close may throw if already closed
        }
      }
    });
  }

  async listBySessionId(
    sessionId: number,
    options: { afterSeq?: number; limit?: number } = {},
  ): Promise<SessionEventEntity[]> {
    let sql = 'SELECT * FROM session_events WHERE session_id = ?';
    const args: (number | string)[] = [sessionId];

    if (options.afterSeq !== undefined) {
      sql += ' AND seq > ?';
      args.push(options.afterSeq);
    }

    sql += ' ORDER BY seq, id';

    if (options.limit !== undefined) {
      sql += ' LIMIT ?';
      args.push(options.limit);
    }

    const result = await this.client.execute({ sql, args });
    return result.rows.map(row => this.parseRow(row as Record<string, unknown>));
  }

  async getLastSeq(sessionId: number): Promise<number> {
    const result = await this.client.execute({
      sql: 'SELECT MAX(seq) as max_seq FROM session_events WHERE session_id = ?',
      args: [sessionId],
    });
    return Number(result.rows[0]?.max_seq) || 0;
  }
}

export { SessionEventRepository };
export type { CreateSessionEventRecord };