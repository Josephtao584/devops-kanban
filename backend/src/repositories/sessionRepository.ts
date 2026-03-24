import { BaseRepository } from './base.js';
import type { BaseEntity } from './base.js';
import type { SessionEntity } from '../types/entities.ts';

type StoredSessionEntity = Omit<SessionEntity, 'created_at' | 'updated_at'> & Pick<BaseEntity, 'created_at' | 'updated_at'>;

class SessionRepository extends BaseRepository<StoredSessionEntity, Omit<SessionEntity, 'id'>, Partial<SessionEntity>> {
  constructor({ storagePath }: { storagePath?: string } = {}) {
    super('sessions.json', storagePath ? { storagePath } : {});
  }

  async getByTask(taskId: number): Promise<StoredSessionEntity[]> {
    const data = await this._loadAll();
    return data.filter((item) => item.task_id === taskId);
  }

  async getActiveByTask(taskId: number): Promise<StoredSessionEntity | null> {
    const sessions = await this.getByTask(taskId);
    for (const session of sessions) {
      if (session.status === 'RUNNING' || session.status === 'IDLE') {
        return session;
      }
    }
    return null;
  }
}

export { SessionRepository };
export type { StoredSessionEntity };
