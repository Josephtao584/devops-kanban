import { BaseRepository } from './base.js';
import type { BaseEntity } from './base.js';
import type { SessionEventEntity } from '../types/entities.ts';

interface StoredSessionEventEntity extends SessionEventEntity, BaseEntity {}

type CreateSessionEventRecord = Omit<SessionEventEntity, 'id' | 'seq'>;
type UpdateSessionEventRecord = Partial<Omit<SessionEventEntity, 'id' | 'session_id' | 'segment_id' | 'seq'>>;

const sessionEventWriteQueues = new Map<string, Promise<void>>();

class SessionEventRepository extends BaseRepository<
  StoredSessionEventEntity,
  CreateSessionEventRecord,
  UpdateSessionEventRecord
> {
  constructor({ storagePath }: { storagePath?: string } = {}) {
    super('session_events.json', { storagePath });
  }

  private async queueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const previous = sessionEventWriteQueues.get(this.filepath) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(operation);
    sessionEventWriteQueues.set(this.filepath, next.then(() => undefined, () => undefined));
    return await next;
  }

  async create(event: CreateSessionEventRecord): Promise<StoredSessionEventEntity> {
    return await this.append(event);
  }

  async append(event: CreateSessionEventRecord): Promise<StoredSessionEventEntity> {
    return await this.queueMutation(async () => {
      const data = await this._loadAll();
      const newId = this._getNextId(data);
      const nextSeq = data.reduce(
        (maxSeq, item) => (item.session_id === event.session_id ? Math.max(maxSeq, item.seq) : maxSeq),
        0,
      ) + 1;
      const now = new Date().toISOString();

      const entity: StoredSessionEventEntity = {
        ...event,
        id: newId,
        seq: nextSeq,
        created_at: now,
        updated_at: now,
      };

      data.push(entity);
      await this._saveAll(data);
      return entity;
    });
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

  async update(eventId: number, update: UpdateSessionEventRecord): Promise<StoredSessionEventEntity | null> {
    return await this.queueMutation(async () => await super.update(eventId, update));
  }

  async delete(eventId: number): Promise<boolean> {
    return await this.queueMutation(async () => await super.delete(eventId));
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
