import { BaseRepository } from './base.js';
import type { BaseEntity } from './base.js';
import type { SessionEventEntity } from '../types/entities.ts';

interface StoredSessionEventEntity extends SessionEventEntity, BaseEntity {}

type CreateSessionEventRecord = Omit<SessionEventEntity, 'id'>;
type UpdateSessionEventRecord = Partial<Omit<SessionEventEntity, 'id' | 'session_id' | 'segment_id' | 'seq'>>;

class SessionEventRepository extends BaseRepository<
  StoredSessionEventEntity,
  CreateSessionEventRecord,
  UpdateSessionEventRecord
> {
  constructor({ storagePath }: { storagePath?: string } = {}) {
    super('session_events.json', { storagePath });
  }

  async findBySession(sessionId: number): Promise<StoredSessionEventEntity[]> {
    const data = await this._loadAll();
    return data
      .filter((item) => item.session_id === sessionId)
      .sort((left, right) => left.seq - right.seq || left.id - right.id);
  }

  async getNextSeq(sessionId: number): Promise<number> {
    const events = await this.findBySession(sessionId);
    if (events.length === 0) {
      return 1;
    }
    return Math.max(...events.map((event) => event.seq)) + 1;
  }

  async listBySession(sessionId: number, { afterSeq, limit }: { afterSeq?: number; limit?: number } = {}): Promise<StoredSessionEventEntity[]> {
    const events = await this.findBySession(sessionId);
    const filtered = afterSeq === undefined
      ? events
      : events.filter((event) => event.seq > afterSeq);

    if (limit === undefined) {
      return filtered;
    }

    return filtered.slice(0, limit);
  }
}

export { SessionEventRepository };
export type {
  StoredSessionEventEntity,
  CreateSessionEventRecord,
  UpdateSessionEventRecord,
};
