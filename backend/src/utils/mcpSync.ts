import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

import { logger } from './logger.js';

interface McpServerConfig {
  name: string;
  server_type: string;
  config: Record<string, unknown>;
}

async function ensureMcpJsonInWorktree(
  mcpServerConfigs: McpServerConfig[],
  worktreePath: string
): Promise<void> {
  const mcpJsonPath = resolve(worktreePath, '.mcp.json');

  if (mcpServerConfigs.length === 0) {
    if (existsSync(mcpJsonPath)) {
      unlinkSync(mcpJsonPath);
    }
    return;
  }

  const mcpServers: Record<string, unknown> = {};
  const mcpJson = { mcpServers };

  for (const server of mcpServerConfigs) {
    if (server.server_type === 'http') {
      const serverConfig: Record<string, unknown> = { type: 'http' };
      const config = server.config;
      if (config.url) serverConfig.url = config.url;
      if (config.headers) serverConfig.headers = config.headers;
      mcpJson.mcpServers[server.name] = serverConfig;
    } else {
      const serverConfig: Record<string, unknown> = {};
      const config = server.config;
      if (config.command) serverConfig.command = config.command;
      if (config.args) serverConfig.args = config.args;
      if (config.env) serverConfig.env = config.env;
      mcpJson.mcpServers[server.name] = serverConfig;
    }
  }

  writeFileSync(mcpJsonPath, JSON.stringify(mcpJson, null, 2), 'utf-8');
}

async function cleanupMcpJson(worktreePath: string): Promise<void> {
  const mcpJsonPath = resolve(worktreePath, '.mcp.json');
  if (existsSync(mcpJsonPath)) {
    try {
      unlinkSync(mcpJsonPath);
    } catch (err) {
      logger.warn('McpSync', `Failed to delete .mcp.json: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

export { ensureMcpJsonInWorktree, cleanupMcpJson };
export type { McpServerConfig };
