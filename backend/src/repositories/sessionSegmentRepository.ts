import { BaseRepository } from './base.js';
import type { BaseEntity } from './base.js';
import type { SessionSegmentEntity } from '../types/entities.ts';

type StoredSessionSegmentEntity = Omit<SessionSegmentEntity, 'created_at' | 'updated_at'> &
  Pick<BaseEntity, 'created_at' | 'updated_at'>;

type CreateSessionSegmentRecord = Omit<SessionSegmentEntity, 'id' | 'segment_index'>;
type UpdateSessionSegmentRecord = Partial<Omit<SessionSegmentEntity, 'id' | 'session_id' | 'segment_index'>>;

const sessionSegmentWriteQueues = new Map<string, Promise<void>>();

class SessionSegmentRepository extends BaseRepository<
  StoredSessionSegmentEntity,
  CreateSessionSegmentRecord,
  UpdateSessionSegmentRecord
> {
  constructor({ storagePath }: { storagePath?: string } = {}) {
    super('session_segments.json', storagePath ? { storagePath } : {});
  }

  private async queueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const previous = sessionSegmentWriteQueues.get(this.filepath) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(operation);
    sessionSegmentWriteQueues.set(this.filepath, next.then(() => undefined, () => undefined));
    return await next;
  }

  async findBySessionId(sessionId: number): Promise<StoredSessionSegmentEntity[]> {
    const data = await this._loadAll();
    return data
      .filter((item) => item.session_id === sessionId)
      .sort((left, right) => left.segment_index - right.segment_index || left.id - right.id);
  }

  async findLatestBySessionId(sessionId: number): Promise<StoredSessionSegmentEntity | null> {
    const segments = await this.findBySessionId(sessionId);
    const latestSegment = segments[segments.length - 1];
    return latestSegment ?? null;
  }

  override async create(segment: CreateSessionSegmentRecord): Promise<StoredSessionSegmentEntity> {
    return await this.queueMutation(async () => {
      const data = await this._loadAll();
      const newId = this._getNextId(data);
      const nextSegmentIndex = data.reduce(
        (maxIndex, item) => (item.session_id === segment.session_id ? Math.max(maxIndex, item.segment_index) : maxIndex),
        0,
      ) + 1;
      const now = new Date().toISOString();

      const entity: StoredSessionSegmentEntity = {
        ...segment,
        id: newId,
        segment_index: nextSegmentIndex,
        created_at: now,
        updated_at: now,
      };

      data.push(entity);
      await this._saveAll(data);
      return entity;
    });
  }

  override async update(segmentId: number, update: UpdateSessionSegmentRecord): Promise<StoredSessionSegmentEntity | null> {
    return await this.queueMutation(async () => await super.update(segmentId, update));
  }

  override async delete(segmentId: number): Promise<boolean> {
    return await this.queueMutation(async () => await super.delete(segmentId));
  }
}

export { SessionSegmentRepository };
export type {
  StoredSessionSegmentEntity,
  CreateSessionSegmentRecord,
  UpdateSessionSegmentRecord,
};
