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
      env: row.env ? JSON.parse(row.env as string) : {},
      enabled: Boolean(row.enabled),
      settingsPath: (row.settings_path as string) || undefined,
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
    if (entity.env !== undefined) {
      result.env = JSON.stringify(entity.env);
    }
    if ('settingsPath' in entity) {
      result.settings_path = entity.settingsPath || null;
      delete result.settingsPath;
    }
    return result;
  }
}

export { AgentRepository };