import { BaseRepository } from './base.js';
import type { BaseEntity } from './base.js';
import type { CreateAgentBody, UpdateAgentBody } from '../types/dto/agents.js';

interface AgentEntity extends BaseEntity {
  name: string;
  type: string;
  role: string;
  description?: string;
  enabled: boolean;
  skills: string[];
}

type AgentCreateRecord = CreateAgentBody;
type AgentUpdateRecord = UpdateAgentBody;

class AgentRepository extends BaseRepository<AgentEntity, AgentCreateRecord, AgentUpdateRecord> {
  constructor() {
    super('agents.json');
  }

  override async create(agentData: CreateAgentBody): Promise<AgentEntity> {
    return await super.create(agentData as AgentCreateRecord);
  }

  override async update(agentId: number, agentData: UpdateAgentBody): Promise<AgentEntity | null> {
    return await super.update(agentId, agentData as AgentUpdateRecord);
  }
}

export { AgentRepository };
export type { AgentEntity };
