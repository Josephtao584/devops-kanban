import { BaseRepository } from './base.js';
import type { BaseEntity } from './base.js';
import type { CreateAgentBody, UpdateAgentBody, AgentExecutorType } from '../types/dto/agents.js';

interface AgentEntity extends BaseEntity {
  name: string;
  executorType: AgentExecutorType;
  role: string;
  description?: string;
  enabled: boolean;
  skills: string[];
}

class AgentRepository extends BaseRepository<AgentEntity, CreateAgentBody, UpdateAgentBody> {
  constructor() {
    super('agents.json');
  }
}

export { AgentRepository };
export type { AgentEntity };
