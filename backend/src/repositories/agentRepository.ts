import { BaseRepository } from './base.js';
import type { BaseEntity } from './base.js';

interface AgentEntity extends BaseEntity {
  name?: string;
  type?: string;
  [key: string]: unknown;
}

class AgentRepository extends BaseRepository<AgentEntity, Omit<AgentEntity, 'id' | 'created_at' | 'updated_at'>, Partial<AgentEntity>> {
  constructor() {
    super('agents.json');
  }
}

export { AgentRepository };
export type { AgentEntity };
