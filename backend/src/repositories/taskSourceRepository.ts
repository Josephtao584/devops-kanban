import { BaseRepository } from './base.js';
import type { TaskSourceEntity } from '../types/entities.js';

class TaskSourceRepository extends BaseRepository<TaskSourceEntity> {
  constructor() {
    super('task_sources.json');
  }

  async getByProject(projectId: number): Promise<TaskSourceEntity[]> {
    const data = await this._loadAll();
    return data.filter((item) => item.project_id === projectId);
  }

  async exists(sourceId: number): Promise<boolean> {
    const source = await this.findById(sourceId);
    return source !== null;
  }

  async deleteByProject(projectId: number): Promise<number> {
    const data = await this._loadAll();
    const initialLength = data.length;
    const filtered = data.filter((item) => item.project_id !== projectId);
    await this._saveAll(filtered);
    return initialLength - filtered.length;
  }
}

export { TaskSourceRepository };
