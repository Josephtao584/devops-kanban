import { BaseRepository } from './base.js';
import type { ExecutionEntity } from '../types/entities.js';

class ExecutionRepository extends BaseRepository<ExecutionEntity> {
  constructor() {
    super('executions.json');
  }

  async getBySession(sessionId: number): Promise<ExecutionEntity[]> {
    const data = await this._loadAll();
    return data.filter((item) => item.session_id === sessionId);
  }

  async getByTask(taskId: number): Promise<ExecutionEntity[]> {
    const data = await this._loadAll();
    return data.filter((item) => item.task_id === taskId);
  }

  async getLatestBySession(sessionId: number): Promise<ExecutionEntity | null> {
    const executions = await this.getBySession(sessionId);
    if (!executions.length) {
      return null;
    }
    return executions.reduce((latest, current) =>
      current.created_at > latest.created_at ? current : latest,
    );
  }
}

export { ExecutionRepository };
