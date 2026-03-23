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

  async append(event: CreateSessionEventRecord): Promise<StoredSessionEventEntity> {
    return await super.create(event);
  }

  async listBySessionId(
    sessionId: number,
    { afterSeq, limit }: { afterSeq?: number; limit?: number } = {},
  ): Promise<StoredSessionEventEntity[]> {
    const data = await this._loadAll();
    const filtered = data
      .filter((item) => item.session_id === sessionId)
      .sort((left, right) => left.seq - right.seq || left.id - right.id)
      .filter((event) => afterSeq === undefined || event.seq > afterSeq);

    if (limit === undefined) {
      return filtered;
    }

    return filtered.slice(0, limit);
  }

  async getLastSeq(sessionId: number): Promise<number> {
    const events = await this.listBySessionId(sessionId);
    if (events.length === 0) {
      return 0;
    }
    return events[events.length - 1].seq;
  }
}

export { SessionEventRepository };
export type {
  StoredSessionEventEntity,
  CreateSessionEventRecord,
  UpdateSessionEventRecord,
};
