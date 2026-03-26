import { BaseRepository } from './base.js';
import type { AgentEntity } from '../types/entities.js';

class AgentRepository extends BaseRepository<AgentEntity> {
  constructor() {
    super('agents.json');
  }
}

export { AgentRepository };