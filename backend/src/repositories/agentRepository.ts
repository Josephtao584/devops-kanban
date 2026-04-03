import { BaseRepository } from './base.js';
import type { AgentEntity } from '../types/entities.js';

class AgentRepository extends BaseRepository<AgentEntity> {
  constructor() {
    super('agents');
  }

  protected override parseRow(row: Record<string, unknown>): AgentEntity {
    return {
      ...row,
      skills: row.skills ? JSON.parse(row.skills as string) : [],
      mcpServers: row.mcp_servers ? JSON.parse(row.mcp_servers as string) : [],
      enabled: Boolean(row.enabled),
    } as AgentEntity;
  }

  protected override serializeRow(entity: Partial<AgentEntity>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...entity };
    if (entity.skills !== undefined) {
      result.skills = JSON.stringify(entity.skills);
    }
    if (entity.mcpServers !== undefined) {
      result.mcp_servers = JSON.stringify(entity.mcpServers);
      delete result.mcpServers;
    }
    return result;
  }
}

export { AgentRepository };