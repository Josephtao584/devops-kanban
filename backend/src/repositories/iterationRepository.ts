import { BaseRepository } from './base.js';
import type { IterationEntity } from '../types/entities.ts';

class IterationRepository extends BaseRepository<IterationEntity> {
  constructor() {
    super('iterations.json');
  }

  async findByProject(projectId: number): Promise<IterationEntity[]> {
    const data = await this._loadAll();
    return data.filter((item) => item.project_id === projectId);
  }

  async exists(iterationId: number): Promise<boolean> {
    const iteration = await this.findById(iterationId);
    return iteration !== null;
  }

  async deleteByProject(projectId: number): Promise<number> {
    const data = await this._loadAll();
    const initialLength = data.length;
    const filtered = data.filter((item) => item.project_id !== projectId);
    await this._saveAll(filtered);
    return initialLength - filtered.length;
  }
}

export { IterationRepository };
