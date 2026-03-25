import { BaseRepository } from './base.js';
import type { SessionEntity } from '../types/entities.ts';

class SessionRepository extends BaseRepository<SessionEntity> {
  constructor() {
    super('sessions.json');
  }

  async getByTask(taskId: number): Promise<SessionEntity[]> {
    const data = await this._loadAll();
    return data.filter((item) => item.task_id === taskId);
  }

  async getActiveByTask(taskId: number): Promise<SessionEntity | null> {
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
