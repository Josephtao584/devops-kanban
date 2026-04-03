import { BaseRepository } from './base.js';
import type { McpServerEntity } from '../types/entities.js';

class McpServerRepository extends BaseRepository<McpServerEntity> {
  constructor() {
    super('mcp_servers');
  }

  protected override parseRow(row: Record<string, unknown>): McpServerEntity {
    return {
      ...row,
      config: row.config ? JSON.parse(row.config as string) : {},
      server_type: row.server_type as 'stdio' | 'http',
    } as McpServerEntity;
  }

  protected override serializeRow(entity: Partial<McpServerEntity>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...entity };
    if (entity.config !== undefined) {
      result.config = JSON.stringify(entity.config);
    }
    return result;
  }
}

export { McpServerRepository };
