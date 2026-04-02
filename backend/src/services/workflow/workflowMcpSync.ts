import { AgentRepository } from '../../repositories/agentRepository.js';
import { McpServerRepository } from '../../repositories/mcpServerRepository.js';

const agentRepo = new AgentRepository();
const mcpServerRepo = new McpServerRepository();

interface McpServerConfig {
  name: string;
  server_type: string;
  config: Record<string, unknown>;
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

export { resolveAgentMcpServers };
