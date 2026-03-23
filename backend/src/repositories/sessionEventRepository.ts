import { BaseRepository } from './base.js';
import type { BaseEntity } from './base.js';
import type { SessionEventEntity } from '../types/entities.ts';

type StoredSessionEventEntity = Omit<SessionEventEntity, 'created_at' | 'updated_at'> &
  Pick<BaseEntity, 'created_at' | 'updated_at'>;

type CreateSessionEventRecord = Omit<SessionEventEntity, 'id' | 'seq'>;
type UpdateSessionEventRecord = Partial<Omit<SessionEventEntity, 'id' | 'session_id' | 'segment_id' | 'seq'>>;

const sessionEventWriteQueues = new Map<string, Promise<void>>();

class SessionEventRepository extends BaseRepository<
  StoredSessionEventEntity,
  CreateSessionEventRecord,
  UpdateSessionEventRecord
> {
  constructor({ storagePath }: { storagePath?: string } = {}) {
    super('session_events.json', storagePath ? { storagePath } : {});
  }

  private async queueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const previous = sessionEventWriteQueues.get(this.filepath) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(operation);
    sessionEventWriteQueues.set(this.filepath, next.then(() => undefined, () => undefined));
    return await next;
  }

  override async create(event: CreateSessionEventRecord): Promise<StoredSessionEventEntity> {
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
    options: { afterSeq?: number; limit?: number } = {},
  ): Promise<StoredSessionEventEntity[]> {
    const data = await this._loadAll();
    const filtered = data
      .filter((item) => item.session_id === sessionId)
      .sort((left, right) => left.seq - right.seq || left.id - right.id)
      .filter((event) => options.afterSeq === undefined || event.seq > options.afterSeq);

    if (options.limit === undefined) {
      return filtered;
    }

    return filtered.slice(0, options.limit);
  }

  override async update(eventId: number, update: UpdateSessionEventRecord): Promise<StoredSessionEventEntity | null> {
    return await this.queueMutation(async () => await super.update(eventId, update));
  }

  override async delete(eventId: number): Promise<boolean> {
    return await this.queueMutation(async () => await super.delete(eventId));
  }

  async getLastSeq(sessionId: number): Promise<number> {
    const events = await this.listBySessionId(sessionId);
    const lastEvent = events[events.length - 1];
    return lastEvent?.seq ?? 0;
  }
}

export { SessionEventRepository };
export type {
  StoredSessionEventEntity,
  CreateSessionEventRecord,
  UpdateSessionEventRecord,
};
