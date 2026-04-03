import { AgentRepository } from '../../repositories/agentRepository.js';
import { McpServerRepository } from '../../repositories/mcpServerRepository.js';
import { execSync } from 'node:child_process';

const agentRepo = new AgentRepository();
const mcpServerRepo = new McpServerRepository();

interface McpServerConfig {
  name: string;
  server_type: string;
  config: Record<string, unknown>;
}

interface McpServerConfigWithMeta extends McpServerConfig {
  auto_install: boolean;
  install_command: string | undefined;
}

async function resolveAgentMcpServers(agentId: number): Promise<McpServerConfig[]> {
  const agent = await agentRepo.findById(agentId);
  if (!agent || !Array.isArray(agent.mcpServers) || agent.mcpServers.length === 0) {
    return [];
  }

  const allServers = await mcpServerRepo.findAll();
  const serverMap = new Map(allServers.map(s => [s.id, s]));

  return agent.mcpServers
    .map(id => {
      const server = serverMap.get(id);
      if (!server) {
        console.warn(`[workflowMcpSync] MCP server ID ${id} not found in DB, skipping`);
        return null;
      }
      return {
        name: server.name,
        server_type: server.server_type,
        config: server.config as Record<string, unknown>,
      };
    })
    .filter((entry) => entry !== null);
}

async function resolveAgentMcpServersWithMeta(agentId: number): Promise<McpServerConfigWithMeta[]> {
  const agent = await agentRepo.findById(agentId);
  if (!agent || !Array.isArray(agent.mcpServers) || agent.mcpServers.length === 0) {
    return [];
  }

  const allServers = await mcpServerRepo.findAll();
  const serverMap = new Map(allServers.map(s => [s.id, s]));

  return agent.mcpServers
    .map(id => {
      const server = serverMap.get(id);
      if (!server) {
        console.warn(`[workflowMcpSync] MCP server ID ${id} not found in DB, skipping`);
        return null;
      }
      return {
        name: server.name,
        server_type: server.server_type,
        config: server.config as Record<string, unknown>,
        auto_install: Boolean(server.auto_install),
        install_command: server.install_command,
      };
    })
    .filter((entry) => entry !== null);
}

/**
 * Check if a stdio MCP server's command is available.
 * Returns true if command exists in PATH.
 */
function isCommandAvailable(command: string): boolean {
  try {
    const whichCmd = process.platform === 'win32' ? 'where' : 'which';
    execSync(`${whichCmd} ${command}`, { stdio: 'pipe', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Pre-check and auto-install MCP server dependencies.
 * For stdio servers: checks if command exists, auto-installs if configured.
 */
async function preCheckMcpServers(servers: McpServerConfigWithMeta[]): Promise<McpServerConfig[]> {
  const validatedServers: McpServerConfig[] = [];

  for (const server of servers) {
    if (server.server_type === 'stdio') {
      const command = server.config.command as string;
      if (!command) {
        console.warn(`[workflowMcpSync] MCP server "${server.name}" has no command, skipping`);
        continue;
      }

      if (!isCommandAvailable(command)) {
        if (server.auto_install && server.install_command) {
          console.log(`[workflowMcpSync] Command "${command}" not found, auto-installing: ${server.install_command}`);
          try {
            execSync(server.install_command, {
              stdio: 'pipe',
              timeout: 120000,
              env: process.env,
            });
            console.log(`[workflowMcpSync] Auto-install completed for "${server.name}"`);
          } catch (err) {
            console.warn(`[workflowMcpSync] Auto-install failed for "${server.name}": ${err instanceof Error ? err.message : String(err)}`);
            // Skip this server — it won't work without the dependency
            continue;
          }

          // Re-check after install
          if (!isCommandAvailable(command)) {
            console.warn(`[workflowMcpSync] Command "${command}" still not available after install, skipping "${server.name}"`);
            continue;
          }
        } else {
          console.warn(`[workflowMcpSync] Command "${command}" not found for MCP server "${server.name}" (auto_install not configured), skipping`);
          continue;
        }
      }
    }

    validatedServers.push({
      name: server.name,
      server_type: server.server_type,
      config: server.config,
    });
  }

  return validatedServers;
}

export { resolveAgentMcpServers, resolveAgentMcpServersWithMeta, preCheckMcpServers };
