import { McpServerRepository } from '../repositories/mcpServerRepository.js';
import { AgentRepository } from '../repositories/agentRepository.js';
import type { McpServerEntity } from '../types/entities.js';
import type { ExportedMcpServer, McpServerExportFile, McpServerImportPreview, McpServerImportConfirmInput } from '../types/dto/workflowTemplates.js';
import { execSync } from 'node:child_process';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

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
    auto_install?: number;
    install_command?: string | undefined;
  }): Promise<McpServerEntity> {
    const existing = await this.listMcpServers();
    if (existing.some(s => s.name === data.name)) {
      throw new ConflictError(`MCP 服务器 "${data.name}" 已存在`, `MCP server "${data.name}" already exists`, { name: data.name });
    }

    return await this.mcpServerRepo.create({
      name: data.name,
      description: data.description,
      server_type: data.server_type,
      config: data.config,
      auto_install: data.auto_install ?? 0,
      install_command: data.install_command,
    });
  }

  async updateMcpServer(id: number, updates: {
    name?: string;
    description?: string;
    server_type?: 'stdio' | 'http';
    config?: Record<string, unknown>;
    auto_install?: number;
    install_command?: string;
  }): Promise<McpServerEntity | null> {
    const existing = await this.mcpServerRepo.findById(id);
    if (!existing) return null;

    if (updates.name !== undefined && updates.name !== existing.name) {
      const allServers = await this.listMcpServers();
      if (allServers.some(s => s.id !== id && s.name === updates.name)) {
        throw new ConflictError(`MCP 服务器 "${updates.name}" 已存在`, `MCP server "${updates.name}" already exists`, { name: updates.name });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.server_type !== undefined) updateData.server_type = updates.server_type;
    if (updates.config !== undefined) updateData.config = updates.config;
    if (updates.auto_install !== undefined) updateData.auto_install = updates.auto_install;
    if (updates.install_command !== undefined) updateData.install_command = updates.install_command;

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

  // --- Export/Import ---

  async exportMcpServer(id: number): Promise<McpServerExportFile> {
    const server = await this.mcpServerRepo.findById(id);
    if (!server) {
      throw new NotFoundError(`未找到 MCP 服务器: ${id}`, `MCP server not found: ${id}`, { id });
    }
    return this.buildExportFile([server]);
  }

  async exportMcpServers(ids: number[]): Promise<McpServerExportFile> {
    const servers: McpServerEntity[] = [];
    for (const id of ids) {
      const server = await this.mcpServerRepo.findById(id);
      if (server) servers.push(server);
    }
    if (servers.length === 0) {
      throw new NotFoundError('未找到指定的 MCP 服务器', 'No matching MCP servers found');
    }
    return this.buildExportFile(servers);
  }

  private buildExportFile(servers: McpServerEntity[]): McpServerExportFile {
    const exportedServers: ExportedMcpServer[] = servers.map(s => {
      const result: ExportedMcpServer = {
        name: s.name,
        server_type: s.server_type,
        config: s.config,
        auto_install: s.auto_install,
      };
      if (s.description !== undefined) result.description = s.description;
      if (s.install_command !== undefined) result.install_command = s.install_command;
      return result;
    });

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      servers: exportedServers,
    };
  }

  async previewImport(exportData: McpServerExportFile): Promise<McpServerImportPreview> {
    const existingServers = await this.listMcpServers();
    const existingNames = new Set(existingServers.map(s => s.name));

    return {
      servers: exportData.servers,
      existingServerNames: exportData.servers
        .filter(s => existingNames.has(s.name))
        .map(s => s.name),
    };
  }

  async confirmImport(input: McpServerImportConfirmInput): Promise<{ imported: McpServerEntity[]; skipped: string[] }> {
    const validStrategies = new Set(['skip', 'overwrite', 'copy']);
    if (!validStrategies.has(input.strategy)) {
      throw new ValidationError('无效的导入策略', `Invalid import strategy: ${input.strategy}`);
    }

    const imported: McpServerEntity[] = [];
    const skipped: string[] = [];

    for (const server of input.servers) {
      const existingServers = await this.listMcpServers();
      const existing = existingServers.find(s => s.name === server.name);

      if (existing && input.strategy === 'skip') {
        skipped.push(server.name);
        continue;
      }

      if (existing && input.strategy === 'copy') {
        const mappedName = input.nameMappings[server.name];
        let finalName = mappedName || `${server.name}-copy`;
        // Ensure uniqueness
        let suffix = 1;
        let candidate = finalName;
        while (existingServers.some(s => s.name === candidate) || imported.some(s => s.name === candidate)) {
          suffix += 1;
          candidate = `${server.name}-copy-${suffix}`;
        }
        finalName = candidate;

        const created = await this.mcpServerRepo.create({
          name: finalName,
          description: server.description,
          server_type: server.server_type,
          config: server.config,
          auto_install: server.auto_install,
          install_command: server.install_command,
        });
        imported.push(created);
      } else if (existing && input.strategy === 'overwrite') {
        const updated = await this.mcpServerRepo.update(existing.id, {
          description: server.description,
          server_type: server.server_type,
          config: server.config,
          auto_install: server.auto_install,
          install_command: server.install_command,
        });
        if (updated) imported.push(updated);
      } else {
        // New server (no existing conflict)
        const created = await this.mcpServerRepo.create({
          name: server.name,
          description: server.description,
          server_type: server.server_type,
          config: server.config,
          auto_install: server.auto_install,
          install_command: server.install_command,
        });
        imported.push(created);
      }
    }

    return { imported, skipped };
  }

  /**
   * Validate an MCP server config by checking if the command/URL is reachable.
   * For stdio: checks if command exists in PATH, optionally tries to start it.
   * For http: checks if URL is reachable.
   */
  async validateMcpServer(data: {
    server_type: 'stdio' | 'http';
    config: Record<string, unknown>;
  }): Promise<{ valid: boolean; message: string; details?: string }> {
    if (data.server_type === 'stdio') {
      return this._validateStdioServer(data.config);
    }
    if (data.server_type === 'http') {
      return this._validateHttpServer(data.config);
    }
    return { valid: false, message: `Unknown server_type: ${data.server_type}` };
  }

  private _validateStdioServer(config: Record<string, unknown>): { valid: boolean; message: string; details?: string } {
    const command = config.command as string | undefined;
    if (!command) {
      return { valid: false, message: 'stdio server missing "command" in config' };
    }

    // Check if command exists in PATH
    try {
      const whichCmd = process.platform === 'win32' ? 'where' : 'which';
      execSync(`${whichCmd} ${command}`, { stdio: 'pipe', timeout: 5000 });
    } catch {
      return {
        valid: false,
        message: `Command "${command}" not found in PATH`,
        details: this._suggestInstallHint(command, config.args as string[] | undefined),
      };
    }

    // Try a quick start test — spawn the process and kill after 3s
    try {
      const args = Array.isArray(config.args) ? (config.args as string[]).join(' ') : '';
      const testCmd = args ? `${command} ${args}` : command;
      execSync(testCmd, {
        stdio: 'pipe',
        timeout: 3000,
        env: { ...process.env, ...(config.env as Record<string, string> || {}) },
      });
    } catch (err: any) {
      const stderr = (err.stderr instanceof Buffer) ? err.stderr.toString('utf-8') : (err.stderr || '');
      const timedOut = err.killed === true || String(err.message).includes('ETIMEDOUT') || String(err.message).includes('timed out');

      // Timeout = server started and waited for input (good!)
      if (timedOut) {
        return { valid: true, message: `Command "${command}" 启动正常，可用于 MCP` };
      }

      // Clear errors
      if (stderr.includes('ENOENT') || stderr.includes('command not found')) {
        return { valid: false, message: `Command "${command}" not found`, details: stderr };
      }
      if (stderr.includes('ECONNREFUSED') || stderr.includes('ModuleNotFoundError')) {
        return { valid: false, message: `"${command}" 缺少依赖`, details: stderr };
      }

      // Server exited quickly but cleanly — that's fine for stdio servers
      return { valid: true, message: `Command "${command}" 验证通过` };
    }

    return { valid: true, message: `Command "${command}" 验证通过` };
  }

  private _suggestInstallHint(command: string, args?: string[]): string {
    // Try to extract package name from args (e.g. "mcp-server-weather" or "mcp_server_weather")
    let packageName: string | null = null;
    if (args && args.length > 0) {
      for (const arg of args) {
        if (arg && !arg.startsWith('-') && (arg.includes('-') || arg.includes('_'))) {
          packageName = arg;
          break;
        }
      }
    }

    const hint = (cmd: string, pkg: string | null) => {
      if (cmd === 'uvx') {
        return pkg ? `安装 uv 后执行：uv pip install ${pkg}` : '安装 uv：curl -LsSf https://astral.sh/uv/install.sh | sh';
      }
      if (cmd === 'npx') {
        return pkg ? `直接执行：npx -y ${pkg}` : '安装 Node.js：https://nodejs.org';
      }
      if (cmd === 'python' || cmd === 'python3') {
        return pkg ? `pip3 install ${pkg}` : '安装 Python：https://www.python.org';
      }
      if (cmd === 'node') {
        return pkg ? `npm install -g ${pkg}` : '安装 Node.js：https://nodejs.org';
      }
      return pkg ? `安装 ${pkg} 后重试` : `请先安装 ${cmd} 后重试`;
    };

    return hint(command, packageName);
  }

  private async _validateHttpServer(config: Record<string, unknown>): Promise<{ valid: boolean; message: string; details?: string }> {
    const url = config.url as string | undefined;
    if (!url) {
      return { valid: false, message: 'http server missing "url" in config' };
    }

    try {
      const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      return { valid: true, message: `URL "${url}" reachable (status ${response.status})` };
    } catch (err: any) {
      return {
        valid: false,
        message: `URL "${url}" not reachable`,
        details: err.message,
      };
    }
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
      logger.warn('McpServerService', `Failed to cleanup agent references for MCP server ${mcpServerId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

export { McpServerService };
