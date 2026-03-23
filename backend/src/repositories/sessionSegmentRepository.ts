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

  async findBySession(sessionId: number): Promise<StoredSessionSegmentEntity[]> {
    const data = await this._loadAll();
    return data
      .filter((item) => item.session_id === sessionId)
      .sort((left, right) => left.segment_index - right.segment_index || left.id - right.id);
  }

  async getNextSegmentIndex(sessionId: number): Promise<number> {
    const segments = await this.findBySession(sessionId);
    if (segments.length === 0) {
      return 1;
    }
    return Math.max(...segments.map((segment) => segment.segment_index)) + 1;
  }
}

export { SessionSegmentRepository };
export type {
  StoredSessionSegmentEntity,
  CreateSessionSegmentRecord,
  UpdateSessionSegmentRecord,
};
