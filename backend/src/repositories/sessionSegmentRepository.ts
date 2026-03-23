import { BaseRepository } from './base.js';
import type { BaseEntity } from './base.js';
import type { SessionSegmentEntity } from '../types/entities.ts';

interface StoredSessionSegmentEntity extends SessionSegmentEntity, BaseEntity {}

type CreateSessionSegmentRecord = Omit<SessionSegmentEntity, 'id' | 'segment_index'>;
type UpdateSessionSegmentRecord = Partial<Omit<SessionSegmentEntity, 'id' | 'session_id' | 'segment_index'>>;

class SessionSegmentRepository extends BaseRepository<
  StoredSessionSegmentEntity,
  CreateSessionSegmentRecord & { segment_index: number },
  UpdateSessionSegmentRecord
> {
  constructor({ storagePath }: { storagePath?: string } = {}) {
    super('session_segments.json', { storagePath });
  }

  async findBySessionId(sessionId: number): Promise<StoredSessionSegmentEntity[]> {
    const data = await this._loadAll();
    return data
      .filter((item) => item.session_id === sessionId)
      .sort((left, right) => left.segment_index - right.segment_index || left.id - right.id);
  }

  async findLatestBySessionId(sessionId: number): Promise<StoredSessionSegmentEntity | null> {
    const segments = await this.findBySessionId(sessionId);
    return segments.length > 0 ? segments[segments.length - 1] : null;
  }

  async create(segment: CreateSessionSegmentRecord & { segment_index: number }): Promise<StoredSessionSegmentEntity> {
    return await super.create(segment);
  }

  async update(segmentId: number, update: UpdateSessionSegmentRecord): Promise<StoredSessionSegmentEntity | null> {
    return await super.update(segmentId, update);
  }
}

export { SessionSegmentRepository };
export type {
  StoredSessionSegmentEntity,
  CreateSessionSegmentRecord,
  UpdateSessionSegmentRecord,
};
