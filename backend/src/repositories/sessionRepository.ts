import { BaseRepository } from './base.js';
import type { BaseEntity } from './base.js';
import type { SessionEntity } from '../types/entities.ts';

interface StoredSessionEntity extends SessionEntity, BaseEntity {}

class SessionRepository extends BaseRepository<StoredSessionEntity, Omit<SessionEntity, 'id'>, Partial<SessionEntity>> {
  constructor() {
    super('sessions.json');
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

  override async create(sessionData: Omit<SessionEntity, 'id'>): Promise<StoredSessionEntity> {
    return await super.create({
      ...sessionData,
      output: '',
    });
  }
}

export { SessionRepository };
export type { StoredSessionEntity };
