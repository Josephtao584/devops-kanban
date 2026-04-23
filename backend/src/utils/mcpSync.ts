import { existsSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { logger } from './logger.js';

interface McpServerConfig {
  name: string;
  server_type: string;
  config: Record<string, unknown>;
}

/**
 * Write Claude Code MCP config: .mcp.json at worktree root
 * Format: { "mcpServers": { "name": { command, args, env } | { type: "http", url, headers } } }
 */
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

/**
 * Write OpenCode MCP config: .opencode/opencode.json
 * Format: { "$schema": "https://opencode.ai/config.json", "mcp": { "name": { "type": "local", "command": [...], "enabled": true, "environment": {...} } | { "type": "remote", "url": "...", "enabled": true } } }
 */
async function ensureOpenCodeMcpJson(
  mcpServerConfigs: McpServerConfig[],
  worktreePath: string
): Promise<void> {
  const opencodeDir = resolve(worktreePath, '.opencode');
  const mcpJsonPath = resolve(opencodeDir, 'opencode.json');

  if (mcpServerConfigs.length === 0) {
    if (existsSync(mcpJsonPath)) {
      unlinkSync(mcpJsonPath);
    }
    return;
  }

  const mcpServers: Record<string, unknown> = {};

  for (const server of mcpServerConfigs) {
    if (server.server_type === 'http') {
      const config = server.config;
      const serverEntry: Record<string, unknown> = {
        type: 'remote',
        enabled: true,
      };
      if (config.url) serverEntry.url = config.url;
      if (config.headers) serverEntry.headers = config.headers;
      mcpServers[server.name] = serverEntry;
    } else {
      const config = server.config;
      const serverEntry: Record<string, unknown> = {
        type: 'local',
        enabled: true,
      };
      if (config.command) {
        serverEntry.command = Array.isArray(config.command)
          ? config.command
          : [config.command as string];
      }
      if (config.args && Array.isArray(config.args)) {
        const cmd = Array.isArray(serverEntry.command)
          ? serverEntry.command as unknown[]
          : [];
        serverEntry.command = [...cmd, ...(config.args as unknown[])];
      }
      if (config.env) serverEntry.environment = config.env;
      mcpServers[server.name] = serverEntry;
    }
  }

  mkdirSync(opencodeDir, { recursive: true });
  const mcpJson = {
    $schema: 'https://opencode.ai/config.json',
    mcp: mcpServers,
  };
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

async function cleanupOpenCodeMcpJson(worktreePath: string): Promise<void> {
  const mcpJsonPath = resolve(worktreePath, '.opencode', 'opencode.json');
  if (existsSync(mcpJsonPath)) {
    try {
      unlinkSync(mcpJsonPath);
    } catch (err) {
      logger.warn('McpSync', `Failed to delete .opencode/opencode.json: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

export { ensureMcpJsonInWorktree, ensureOpenCodeMcpJson, cleanupMcpJson, cleanupOpenCodeMcpJson };
export type { McpServerConfig };
