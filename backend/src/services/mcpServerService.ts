import { McpServerRepository } from '../repositories/mcpServerRepository.js';
import { AgentRepository } from '../repositories/agentRepository.js';
import type { McpServerEntity } from '../types/entities.js';

class McpServerService {
  mcpServerRepo: McpServerRepository;
  agentRepo: AgentRepository;

  constructor(options: { mcpServerRepo?: McpServerRepository; agentRepo?: AgentRepository } = {}) {
    this.mcpServerRepo = options.mcpServerRepo || new McpServerRepository();
    this.agentRepo = options.agentRepo || new AgentRepository();
  }

  async listMcpServers(): Promise<McpServerEntity[]> {
    return await this.mcpServerRepo.findAll();
  }

  async getMcpServer(id: number): Promise<McpServerEntity | null> {
    return await this.mcpServerRepo.findById(id);
  }

  async createMcpServer(data: {
    name: string;
    description?: string;
    server_type: 'stdio' | 'http';
    config: Record<string, unknown>;
  }): Promise<McpServerEntity> {
    const existing = await this.listMcpServers();
    if (existing.some(s => s.name === data.name)) {
      const error: any = new Error(`MCP server "${data.name}" already exists`);
      error.statusCode = 409;
      throw error;
    }

    return await this.mcpServerRepo.create({
      name: data.name,
      description: data.description,
      server_type: data.server_type,
      config: data.config,
    });
  }

  async updateMcpServer(id: number, updates: {
    name?: string;
    description?: string;
    server_type?: 'stdio' | 'http';
    config?: Record<string, unknown>;
  }): Promise<McpServerEntity | null> {
    const existing = await this.mcpServerRepo.findById(id);
    if (!existing) return null;

    if (updates.name !== undefined && updates.name !== existing.name) {
      const allServers = await this.listMcpServers();
      if (allServers.some(s => s.id !== id && s.name === updates.name)) {
        const error: any = new Error(`MCP server "${updates.name}" already exists`);
        error.statusCode = 409;
        throw error;
      }
    }

    const updateData: Record<string, unknown> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.server_type !== undefined) updateData.server_type = updates.server_type;
    if (updates.config !== undefined) updateData.config = updates.config;

    if (Object.keys(updateData).length === 0) return existing;
    return await this.mcpServerRepo.update(id, updateData);
  }

  async deleteMcpServer(id: number): Promise<boolean> {
    const deleted = await this.mcpServerRepo.delete(id);
    if (deleted) {
      await this.cleanupAgentReferences(id);
    }
    return deleted;
  }

  private async cleanupAgentReferences(mcpServerId: number): Promise<void> {
    try {
      const agents = await this.agentRepo.findAll();
      for (const agent of agents) {
        if (Array.isArray(agent.mcpServers) && agent.mcpServers.includes(mcpServerId)) {
          const updatedMcpServers = agent.mcpServers.filter(id => id !== mcpServerId);
          await this.agentRepo.update(agent.id, { mcpServers: updatedMcpServers });
        }
      }
    } catch (err) {
      console.warn(`[McpServerService] Failed to cleanup agent references for MCP server ${mcpServerId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

export { McpServerService };
