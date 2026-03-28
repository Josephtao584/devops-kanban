import { BaseRepository } from './base.js';
import type { SkillEntity } from '../types/entities.js';

class SkillRepository extends BaseRepository<SkillEntity> {
  constructor(options: { storagePath?: string } = {}) {
    super('skills.json', options);
  }
}

export { SkillRepository };
