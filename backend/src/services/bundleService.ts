import { WorkflowTemplateRepository } from '../repositories/workflowTemplateRepository.js';
import { AgentRepository } from '../repositories/agentRepository.js';
import { SkillRepository } from '../repositories/skillRepository.js';
import { McpServerRepository } from '../repositories/mcpServerRepository.js';
import type { WorkflowTemplateEntity, AgentEntity, SkillEntity, McpServerEntity } from '../types/entities.js';
import type {
  ExportedAgent,
  ExportedSkill,
  BundleExportFile,
  BundleResolveResult,
  BundleImportPreview,
  BundleImportConfirmInput,
} from '../types/dto/bundle.js';
import type { ExportedWorkflowTemplate, ExportedMcpServer } from '../types/dto/workflowTemplates.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

class BundleService {
  templateRepo: WorkflowTemplateRepository;
  agentRepo: AgentRepository;
  skillRepo: SkillRepository;
  mcpServerRepo: McpServerRepository;

  constructor(options: {
    templateRepo?: WorkflowTemplateRepository;
    agentRepo?: AgentRepository;
    skillRepo?: SkillRepository;
    mcpServerRepo?: McpServerRepository;
  } = {}) {
    this.templateRepo = options.templateRepo || new WorkflowTemplateRepository();
    this.agentRepo = options.agentRepo || new AgentRepository();
    this.skillRepo = options.skillRepo || new SkillRepository();
    this.mcpServerRepo = options.mcpServerRepo || new McpServerRepository();
  }

  // --- Resolve dependencies ---

  async resolve(templateIds: string[]): Promise<BundleResolveResult> {
    const allTemplates = await this.templateRepo.findAll();
    const selected = templateIds.map(id => {
      const t = allTemplates.find(t => t.template_id === id);
      if (!t) throw new NotFoundError(`未找到工作流模板: ${id}`, `Workflow template not found: ${id}`, { templateId: id });
      return t;
    });

    const allAgents = await this.agentRepo.findAll();
    const allSkills = await this.skillRepo.findAll();
    const allMcpServers = await this.mcpServerRepo.findAll();

    // Collect unique agent IDs from template steps
    const agentIds = new Set<number>();
    for (const tpl of selected) {
      for (const step of tpl.steps) {
        if (typeof step.agentId === 'number') agentIds.add(step.agentId);
      }
    }

    // Resolve agents
    const agents: ExportedAgent[] = [];
    const seenAgentIds = new Set<number>();
    for (const id of agentIds) {
      const agent = allAgents.find(a => a.id === id);
      if (agent && !seenAgentIds.has(agent.id)) {
        seenAgentIds.add(agent.id);
        agents.push(this.buildExportedAgent(agent, allSkills, allMcpServers));
      }
    }

    // Collect unique skill identifiers and MCP server names from resolved agents
    const skillMap = new Map<number, SkillEntity>();
    const mcpMap = new Map<number, McpServerEntity>();
    for (const s of allSkills) skillMap.set(s.id, s);
    for (const s of allMcpServers) mcpMap.set(s.id, s);

    const skills: ExportedSkill[] = [];
    const seenSkills = new Set<string>();
    const mcpServers: { name: string; server_type: string }[] = [];
    const seenMcp = new Set<string>();

    for (const id of agentIds) {
      const agent = allAgents.find(a => a.id === id);
      if (!agent) continue;
      for (const skillId of agent.skills) {
        const skill = skillMap.get(skillId);
        if (skill && !seenSkills.has(skill.identifier)) {
          seenSkills.add(skill.identifier);
          const es: ExportedSkill = { identifier: skill.identifier, name: skill.name };
          if (skill.description !== undefined) es.description = skill.description;
          skills.push(es);
        }
      }
      for (const mcpId of agent.mcpServers) {
        const mcp = mcpMap.get(mcpId);
        if (mcp && !seenMcp.has(mcp.name)) {
          seenMcp.add(mcp.name);
          mcpServers.push({ name: mcp.name, server_type: mcp.server_type });
        }
      }
    }

    return {
      templates: selected.map(t => ({ template_id: t.template_id, name: t.name, stepCount: t.steps.length })),
      agents,
      skills,
      mcpServers,
    };
  }

  // --- Export ---

  async exportBundle(input: {
    templateIds: string[];
    agentNames: string[];
    skillIdentifiers: string[];
    mcpServerNames: string[];
  }): Promise<BundleExportFile> {
    const allTemplates = await this.templateRepo.findAll();
    const allAgents = await this.agentRepo.findAll();
    const allSkills = await this.skillRepo.findAll();
    const allMcpServers = await this.mcpServerRepo.findAll();

    // Templates
    const templates: ExportedWorkflowTemplate[] = input.templateIds.map(id => {
      const t = allTemplates.find(t => t.template_id === id);
      if (!t) throw new NotFoundError(`未找到工作流模板: ${id}`, `Workflow template not found: ${id}`, { templateId: id });
      return this.buildExportedTemplate(t, allAgents);
    });

    // Agents (selected by name)
    const agents: ExportedAgent[] = input.agentNames.map(name => {
      const agent = allAgents.find(a => a.name === name);
      if (!agent) throw new NotFoundError(`未找到 Agent: ${name}`, `Agent not found: ${name}`, { name });
      return this.buildExportedAgent(agent, allSkills, allMcpServers);
    });

    // Skills (selected by identifier)
    const skills: ExportedSkill[] = input.skillIdentifiers.map(id => {
      const skill = allSkills.find(s => s.identifier === id);
      if (!skill) throw new NotFoundError(`未找到 Skill: ${id}`, `Skill not found: ${id}`, { identifier: id });
      const es: ExportedSkill = { identifier: skill.identifier, name: skill.name };
      if (skill.description !== undefined) es.description = skill.description;
      return es;
    });

    // MCP Servers (selected by name)
    const mcpServers: ExportedMcpServer[] = input.mcpServerNames.map(name => {
      const server = allMcpServers.find(s => s.name === name);
      if (!server) throw new NotFoundError(`未找到 MCP 服务器: ${name}`, `MCP server not found: ${name}`, { name });
      return this.buildExportedMcpServer(server);
    });

    return {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      templates,
      agents,
      skills,
      mcpServers,
    };
  }

  // --- Import preview ---

  async previewImport(data: BundleExportFile): Promise<BundleImportPreview> {
    const existingTemplates = await this.templateRepo.findAll();
    const existingAgents = await this.agentRepo.findAll();
    const existingSkills = await this.skillRepo.findAll();
    const existingMcpServers = await this.mcpServerRepo.findAll();

    const existingTplIds = new Set(existingTemplates.map(t => t.template_id));
    const existingAgentNames = new Set(existingAgents.map(a => a.name));
    const existingSkillIds = new Set(existingSkills.map(s => s.identifier));
    const existingMcpNames = new Set(existingMcpServers.map(s => s.name));

    return {
      templates: data.templates,
      agents: data.agents,
      skills: data.skills,
      mcpServers: data.mcpServers,
      conflicts: {
        templateIds: data.templates.filter(t => existingTplIds.has(t.template_id)).map(t => t.template_id),
        agentNames: data.agents.filter(a => existingAgentNames.has(a.name)).map(a => a.name),
        skillIdentifiers: data.skills.filter(s => existingSkillIds.has(s.identifier)).map(s => s.identifier),
        mcpServerNames: data.mcpServers.filter(s => existingMcpNames.has(s.name)).map(s => s.name),
      },
    };
  }

  // --- Import confirm ---

  async confirmImport(input: BundleImportConfirmInput): Promise<{
    imported: { templates: number; agents: number; skills: number; mcpServers: number };
    skipped: { templates: number; agents: number; skills: number; mcpServers: number };
  }> {
    const validStrategies = new Set(['skip', 'overwrite', 'copy']);
    if (!validStrategies.has(input.strategy)) {
      throw new ValidationError('无效的导入策略', `Invalid import strategy: ${input.strategy}`);
    }

    const imported = { templates: 0, agents: 0, skills: 0, mcpServers: 0 };
    const skipped = { templates: 0, agents: 0, skills: 0, mcpServers: 0 };

    // Track name→id mappings for dependency resolution
    const skillIdMap = new Map<string, number>();    // identifier → id
    const mcpIdMap = new Map<string, number>();       // name → id
    const agentIdMap = new Map<string, number>();     // name → id

    // Load existing entities into maps
    const existingSkills = await this.skillRepo.findAll();
    for (const s of existingSkills) skillIdMap.set(s.identifier, s.id);

    const existingMcpServers = await this.mcpServerRepo.findAll();
    for (const s of existingMcpServers) mcpIdMap.set(s.name, s.id);

    const existingAgents = await this.agentRepo.findAll();
    for (const a of existingAgents) agentIdMap.set(a.name, a.id);

    // 1. Import Skills
    for (const skill of input.skills) {
      const existingId = skillIdMap.get(skill.identifier);
      if (existingId !== undefined) {
        if (input.strategy === 'skip') { skipped.skills++; continue; }
        if (input.strategy === 'overwrite') {
          const upd: Record<string, unknown> = { name: skill.name };
          if (skill.description !== undefined) upd.description = skill.description;
          await this.skillRepo.update(existingId, upd);
          imported.skills++;
          continue;
        }
        if (input.strategy === 'copy') {
          const newId = await this.createUniqueSkill(skill.identifier, skill.name, skill.description);
          // Point original identifier to the new copy so downstream entities reference the copy
          skillIdMap.set(skill.identifier, newId);
          imported.skills++;
          continue;
        }
      }
      // New skill
      const skillData: Record<string, unknown> = { identifier: skill.identifier, name: skill.name };
      if (skill.description !== undefined) skillData.description = skill.description;
      const created = await this.skillRepo.create(skillData as Omit<SkillEntity, 'id' | 'created_at' | 'updated_at'>);
      skillIdMap.set(skill.identifier, created.id);
      imported.skills++;
    }

    // 2. Import MCP Servers
    for (const server of input.mcpServers) {
      const existingId = mcpIdMap.get(server.name);
      if (existingId !== undefined) {
        if (input.strategy === 'skip') { skipped.mcpServers++; continue; }
        if (input.strategy === 'overwrite') {
          const upd: Record<string, unknown> = {
            server_type: server.server_type,
            config: server.config,
            auto_install: server.auto_install,
          };
          if (server.install_command !== undefined) upd.install_command = server.install_command;
          if (server.description !== undefined) upd.description = server.description;
          await this.mcpServerRepo.update(existingId, upd);
          imported.mcpServers++;
          continue;
        }
        if (input.strategy === 'copy') {
          const newId = await this.createUniqueMcpServer(server);
          mcpIdMap.set(server.name, newId);
          imported.mcpServers++;
          continue;
        }
      }
      const mcpData: Record<string, unknown> = {
        name: server.name,
        server_type: server.server_type,
        config: server.config,
        auto_install: server.auto_install,
      };
      if (server.install_command !== undefined) mcpData.install_command = server.install_command;
      if (server.description !== undefined) mcpData.description = server.description;
      const created = await this.mcpServerRepo.create(mcpData as Omit<McpServerEntity, 'id' | 'created_at' | 'updated_at'>);
      mcpIdMap.set(server.name, created.id);
      imported.mcpServers++;
    }

    // 3. Import Agents
    for (const agent of input.agents) {
      const skillIds = agent.skillNames.map(name => skillIdMap.get(name) || 0);
      const mcpIds = agent.mcpServerNames.map(name => mcpIdMap.get(name) || 0);

      const existingId = agentIdMap.get(agent.name);
      if (existingId !== undefined) {
        if (input.strategy === 'skip') { skipped.agents++; continue; }
        if (input.strategy === 'overwrite') {
          const upd: Record<string, unknown> = {
            executorType: agent.executorType as AgentEntity['executorType'],
            role: agent.role,
            enabled: agent.enabled,
            skills: skillIds,
            mcpServers: mcpIds,
          };
          if (agent.description !== undefined) upd.description = agent.description;
          await this.agentRepo.update(existingId, upd);
          imported.agents++;
          continue;
        }
        if (input.strategy === 'copy') {
          const newId = await this.createUniqueAgent(agent, skillIds, mcpIds);
          agentIdMap.set(agent.name, newId);
          imported.agents++;
          continue;
        }
      }
      const agentData: Record<string, unknown> = {
        name: agent.name,
        executorType: agent.executorType as AgentEntity['executorType'],
        role: agent.role,
        enabled: agent.enabled,
        skills: skillIds,
        mcpServers: mcpIds,
      };
      if (agent.description !== undefined) agentData.description = agent.description;
      const created = await this.agentRepo.create(agentData as Omit<AgentEntity, 'id' | 'created_at' | 'updated_at'>);
      agentIdMap.set(agent.name, created.id);
      imported.agents++;
    }

    // 4. Import Templates
    for (const tpl of input.templates) {
      const steps = tpl.steps.map(step => ({
        id: step.id,
        name: step.name,
        instructionPrompt: step.instructionPrompt,
        agentId: agentIdMap.get(step.agentName) || 0,
        requiresConfirmation: step.requiresConfirmation || false,
      }));

      const allTemplates = await this.templateRepo.findAll();
      const existing = allTemplates.find(t => t.template_id === tpl.template_id);

      if (existing) {
        if (input.strategy === 'skip') { skipped.templates++; continue; }
        if (input.strategy === 'overwrite') {
          await this.templateRepo.update(existing.id, { name: tpl.name, steps });
          imported.templates++;
          continue;
        }
        if (input.strategy === 'copy') {
          await this.createUniqueTemplate(tpl.template_id, tpl.name, steps);
          imported.templates++;
          continue;
        }
      }
      await this.templateRepo.create({ template_id: tpl.template_id, name: tpl.name, steps });
      imported.templates++;
    }

    return { imported, skipped };
  }

  // --- Helpers ---

  private buildExportedAgent(agent: AgentEntity, allSkills: SkillEntity[], allMcpServers: McpServerEntity[]): ExportedAgent {
    const skillMap = new Map(allSkills.map(s => [s.id, s.identifier]));
    const mcpMap = new Map(allMcpServers.map(s => [s.id, s.name]));

    const result: ExportedAgent = {
      name: agent.name,
      executorType: agent.executorType,
      role: agent.role,
      enabled: agent.enabled,
      skillNames: agent.skills.map(id => skillMap.get(id) || `Skill#${id}`),
      mcpServerNames: agent.mcpServers.map(id => mcpMap.get(id) || `MCP#${id}`),
    };
    if (agent.description !== undefined) result.description = agent.description;
    return result;
  }

  private buildExportedMcpServer(server: McpServerEntity): ExportedMcpServer {
    const result: ExportedMcpServer = {
      name: server.name,
      server_type: server.server_type,
      config: server.config,
      auto_install: server.auto_install,
    };
    if (server.description !== undefined) result.description = server.description;
    if (server.install_command !== undefined) result.install_command = server.install_command;
    return result;
  }

  private buildExportedTemplate(template: WorkflowTemplateEntity, allAgents: AgentEntity[]): ExportedWorkflowTemplate {
    const agentNameMap = new Map(allAgents.map(a => [a.id, a.name]));
    return {
      template_id: template.template_id,
      name: template.name,
      steps: template.steps.map((step): ExportedWorkflowTemplate['steps'][number] => ({
        id: step.id,
        name: step.name,
        instructionPrompt: step.instructionPrompt,
        agentName: agentNameMap.get(step.agentId) || `Agent#${step.agentId}`,
        requiresConfirmation: step.requiresConfirmation || false,
      })),
    };
  }

  private async createUniqueSkill(baseIdentifier: string, name: string, description?: string): Promise<number> {
    let suffix = 1;
    let candidate = `${baseIdentifier}-copy`;
    const existing = await this.skillRepo.findAll();
    while (existing.some(s => s.identifier === candidate)) {
      suffix++;
      candidate = `${baseIdentifier}-copy-${suffix}`;
    }
    const data: Record<string, unknown> = { identifier: candidate, name: `${name} (副本)` };
    if (description !== undefined) data.description = description;
    const created = await this.skillRepo.create(data as Omit<SkillEntity, 'id' | 'created_at' | 'updated_at'>);
    return created.id;
  }

  private async createUniqueMcpServer(server: ExportedMcpServer): Promise<number> {
    let suffix = 1;
    let candidate = `${server.name}-copy`;
    const existing = await this.mcpServerRepo.findAll();
    while (existing.some(s => s.name === candidate)) {
      suffix++;
      candidate = `${server.name}-copy-${suffix}`;
    }
    const data: Record<string, unknown> = {
      name: candidate,
      server_type: server.server_type,
      config: server.config,
      auto_install: server.auto_install,
    };
    if (server.install_command !== undefined) data.install_command = server.install_command;
    if (server.description !== undefined) data.description = server.description;
    const created = await this.mcpServerRepo.create(data as Omit<McpServerEntity, 'id' | 'created_at' | 'updated_at'>);
    return created.id;
  }

  private async createUniqueAgent(agent: ExportedAgent, skillIds: number[], mcpIds: number[]): Promise<number> {
    let suffix = 1;
    let candidate = `${agent.name}-copy`;
    const existing = await this.agentRepo.findAll();
    while (existing.some(a => a.name === candidate)) {
      suffix++;
      candidate = `${agent.name}-copy-${suffix}`;
    }
    const data: Record<string, unknown> = {
      name: candidate,
      executorType: agent.executorType as AgentEntity['executorType'],
      role: agent.role,
      enabled: agent.enabled,
      skills: skillIds,
      mcpServers: mcpIds,
    };
    if (agent.description !== undefined) data.description = agent.description;
    const created = await this.agentRepo.create(data as Omit<AgentEntity, 'id' | 'created_at' | 'updated_at'>);
    return created.id;
  }

  private async createUniqueTemplate(baseId: string, name: string, steps: WorkflowTemplateEntity['steps']): Promise<string> {
    let suffix = 1;
    let candidate = `${baseId}-copy`;
    const existing = await this.templateRepo.findAll();
    while (existing.some(t => t.template_id === candidate)) {
      suffix++;
      candidate = `${baseId}-copy-${suffix}`;
    }
    await this.templateRepo.create({ template_id: candidate, name: `${name} (副本)`, steps });
    return candidate;
  }
}

export { BundleService };
