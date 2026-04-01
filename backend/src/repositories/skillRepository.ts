import { BaseRepository } from './base.js';
import type { SkillEntity } from '../types/entities.js';

class SkillRepository extends BaseRepository<SkillEntity> {
  constructor() {
    super('skills');
  }
}

export { SkillRepository };