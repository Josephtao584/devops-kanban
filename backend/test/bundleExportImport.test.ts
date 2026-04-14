import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { BundleService } from '../src/services/bundleService.js';
import { NotFoundError } from '../src/utils/errors.js';
import type { WorkflowTemplateEntity, AgentEntity, SkillEntity, McpServerEntity } from '../src/types/entities.js';
import type { BundleExportFile, BundleImportConfirmInput } from '../src/types/dto/bundle.js';

// --- Mock factories ---

function createMockTemplateRepo(templates: WorkflowTemplateEntity[] = []) {
  const store = new Map(templates.map(t => [t.template_id, t]));

  return {
    findAll: mock.fn(async () => [...store.values()]),
    findByTemplateId: mock.fn(async (id: string) => store.get(id) || null),
    findById: mock.fn(async (id: number) => [...store.values()].find(t => t.id === id) || null),
    create: mock.fn(async (data: Omit<WorkflowTemplateEntity, 'id' | 'created_at' | 'updated_at'>) => {
      const newId = Math.max(0, ...[...store.values()].map(t => t.id)) + 1;
      const entity = { ...data, id: newId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as WorkflowTemplateEntity;
      store.set(entity.template_id, entity);
      return entity;
    }),
    update: mock.fn(async (id: number, data: Partial<WorkflowTemplateEntity>) => {
      const existing = [...store.values()].find(t => t.id === id);
      if (!existing) return null;
      const updated = { ...existing, ...data, updated_at: new Date().toISOString() } as WorkflowTemplateEntity;
      store.set(updated.template_id, updated);
      return updated;
    }),
    delete: mock.fn(async (id: number) => {
      const existing = [...store.values()].find(t => t.id === id);
      if (!existing) return false;
      store.delete(existing.template_id);
      return true;
    }),
  };
}

function createMockAgentRepo(agents: AgentEntity[] = []) {
  const store = new Map(agents.map(a => [a.id, a]));

  return {
    findAll: mock.fn(async () => [...store.values()]),
    findById: mock.fn(async (id: number) => store.get(id) || null),
    create: mock.fn(async (data: Omit<AgentEntity, 'id' | 'created_at' | 'updated_at'>) => {
      const newId = Math.max(0, ...[...store.values()].map(a => a.id)) + 1;
      const entity = { ...data, id: newId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as AgentEntity;
      store.set(entity.id, entity);
      return entity;
    }),
    update: mock.fn(async (id: number, data: Partial<AgentEntity>) => {
      const existing = store.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...data, updated_at: new Date().toISOString() } as AgentEntity;
      store.set(updated.id, updated);
      return updated;
    }),
  };
}

function createMockSkillRepo(skills: SkillEntity[] = []) {
  const store = new Map(skills.map(s => [s.id, s]));

  return {
    findAll: mock.fn(async () => [...store.values()]),
    findById: mock.fn(async (id: number) => store.get(id) || null),
    create: mock.fn(async (data: Omit<SkillEntity, 'id' | 'created_at' | 'updated_at'>) => {
      const newId = Math.max(0, ...[...store.values()].map(s => s.id)) + 1;
      const entity = { ...data, id: newId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as SkillEntity;
      store.set(entity.id, entity);
      return entity;
    }),
    update: mock.fn(async (id: number, data: Partial<SkillEntity>) => {
      const existing = store.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...data, updated_at: new Date().toISOString() } as SkillEntity;
      store.set(updated.id, updated);
      return updated;
    }),
  };
}

function createMockMcpServerRepo(servers: McpServerEntity[] = []) {
  const store = new Map(servers.map(s => [s.id, s]));

  return {
    findAll: mock.fn(async () => [...store.values()]),
    findById: mock.fn(async (id: number) => store.get(id) || null),
    create: mock.fn(async (data: Omit<McpServerEntity, 'id' | 'created_at' | 'updated_at'>) => {
      const newId = Math.max(0, ...[...store.values()].map(s => s.id)) + 1;
      const entity = { ...data, id: newId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as McpServerEntity;
      store.set(entity.id, entity);
      return entity;
    }),
    update: mock.fn(async (id: number, data: Partial<McpServerEntity>) => {
      const existing = store.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...data, updated_at: new Date().toISOString() } as McpServerEntity;
      store.set(updated.id, updated);
      return updated;
    }),
  };
}

// --- Test data ---

const skillGit: SkillEntity = {
  id: 1, identifier: 'git', name: 'Git', description: 'Git version control',
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};

const skillPlaywright: SkillEntity = {
  id: 2, identifier: 'playwright', name: 'Playwright', description: 'Browser testing',
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};

const mcpContext7: McpServerEntity = {
  id: 10, name: 'context7', description: 'Docs lookup', server_type: 'stdio',
  config: { command: 'npx', args: ['-y', '@upstash/context7-mcp'] },
  auto_install: 0, install_command: undefined,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};

const mcpPlaywright: McpServerEntity = {
  id: 20, name: 'playwright-mcp', description: 'Browser automation', server_type: 'stdio',
  config: { command: 'npx', args: ['-y', '@anthropic-ai/mcp-playwright'] },
  auto_install: 0, install_command: undefined,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};

const agentAnalyst: AgentEntity = {
  id: 1, name: '分析师', executorType: 'claude-code', role: 'analyzer',
  description: 'Analyzes code', enabled: true,
  skills: [1], mcpServers: [10],
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};

const agentDev: AgentEntity = {
  id: 2, name: '开发者', executorType: 'claude-code', role: 'developer',
  description: 'Writes code', enabled: true,
  skills: [1, 2], mcpServers: [10, 20],
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};

const agentNoDeps: AgentEntity = {
  id: 3, name: '测试员', executorType: 'claude-code', role: 'tester',
  description: 'Tests code', enabled: true,
  skills: [], mcpServers: [],
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};

const template1: WorkflowTemplateEntity = {
  id: 1, template_id: 'cve-fix', name: 'CVE 漏洞修复',
  steps: [
    { id: 's1', name: '分析', instructionPrompt: 'Analyze', agentId: 1, requiresConfirmation: false },
    { id: 's2', name: '修复', instructionPrompt: 'Fix', agentId: 2, requiresConfirmation: false },
  ],
  order: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};

const template2: WorkflowTemplateEntity = {
  id: 2, template_id: 'code-review', name: '代码审查',
  steps: [
    { id: 's1', name: '审查', instructionPrompt: 'Review', agentId: 1, requiresConfirmation: false },
  ],
  order: 2, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};

// Helper to create a service with all mocks
function createService(templateData: WorkflowTemplateEntity[] = [], agentData: AgentEntity[] = [], skillData: SkillEntity[] = [], mcpData: McpServerEntity[] = []) {
  const templateRepo = createMockTemplateRepo(templateData);
  const agentRepo = createMockAgentRepo(agentData);
  const skillRepo = createMockSkillRepo(skillData);
  const mcpServerRepo = createMockMcpServerRepo(mcpData);

  const service = new BundleService({
    // @ts-expect-error mock repos
    templateRepo,
    // @ts-expect-error mock repos
    agentRepo,
    // @ts-expect-error mock repos
    skillRepo,
    // @ts-expect-error mock repos
    mcpServerRepo,
  });

  return { service, templateRepo, agentRepo, skillRepo, mcpServerRepo };
}

// --- Tests ---

describe('BundleService - resolve', () => {
  it('should resolve dependencies from a single workflow template', async () => {
    const { service } = createService(
      [template1],
      [agentAnalyst, agentDev],
      [skillGit, skillPlaywright],
      [mcpContext7, mcpPlaywright],
    );

    const result = await service.resolve(['cve-fix']);

    assert.equal(result.templates.length, 1);
    assert.equal(result.templates[0].template_id, 'cve-fix');
    assert.equal(result.templates[0].stepCount, 2);

    // Two agents referenced by template1
    assert.equal(result.agents.length, 2);
    const agentNames = result.agents.map(a => a.name);
    assert.ok(agentNames.includes('分析师'));
    assert.ok(agentNames.includes('开发者'));

    // Check agent skill/MCP resolution
    const analyst = result.agents.find(a => a.name === '分析师')!;
    assert.deepEqual(analyst.skillNames, ['git']);
    assert.deepEqual(analyst.mcpServerNames, ['context7']);

    const dev = result.agents.find(a => a.name === '开发者')!;
    assert.deepEqual(dev.skillNames, ['git', 'playwright']);
    assert.deepEqual(dev.mcpServerNames, ['context7', 'playwright-mcp']);

    // Skills and MCP deduped
    assert.equal(result.skills.length, 2);
    assert.equal(result.mcpServers.length, 2);
  });

  it('should deduplicate agents shared across multiple templates', async () => {
    const { service } = createService(
      [template1, template2],
      [agentAnalyst, agentDev],
      [skillGit, skillPlaywright],
      [mcpContext7, mcpPlaywright],
    );

    const result = await service.resolve(['cve-fix', 'code-review']);

    // template1 uses agents 1,2; template2 uses agent 1 — should dedupe to 2 agents
    assert.equal(result.agents.length, 2);
    assert.equal(result.templates.length, 2);
  });

  it('should handle agents with no skills or MCP servers', async () => {
    const templateNoDeps: WorkflowTemplateEntity = {
      id: 3, template_id: 'simple', name: 'Simple',
      steps: [{ id: 's1', name: 'Run', instructionPrompt: 'Go', agentId: 3, requiresConfirmation: false }],
      order: 3, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    };

    const { service } = createService([templateNoDeps], [agentNoDeps], [], []);

    const result = await service.resolve(['simple']);

    assert.equal(result.agents.length, 1);
    assert.deepEqual(result.agents[0].skillNames, []);
    assert.deepEqual(result.agents[0].mcpServerNames, []);
    assert.equal(result.skills.length, 0);
    assert.equal(result.mcpServers.length, 0);
  });

  it('should throw NotFoundError for non-existent template', async () => {
    const { service } = createService([], [], [], []);

    await assert.rejects(
      () => service.resolve(['non-existent']),
      (error: unknown) => {
        assert.ok(error instanceof NotFoundError);
        return true;
      },
    );
  });
});

describe('BundleService - exportBundle', () => {
  it('should build a v2.0 export file with selected entities', async () => {
    const { service } = createService(
      [template1],
      [agentAnalyst, agentDev],
      [skillGit, skillPlaywright],
      [mcpContext7, mcpPlaywright],
    );

    const result = await service.exportBundle({
      templateIds: ['cve-fix'],
      agentNames: ['分析师', '开发者'],
      skillIdentifiers: ['git', 'playwright'],
      mcpServerNames: ['context7'],
    });

    assert.equal(result.version, '2.0');
    assert.ok(result.exportedAt);
    assert.equal(result.templates.length, 1);
    assert.equal(result.templates[0].template_id, 'cve-fix');
    assert.equal(result.templates[0].steps[0].agentName, '分析师');
    assert.equal(result.templates[0].steps[1].agentName, '开发者');
    assert.equal(result.agents.length, 2);
    assert.equal(result.skills.length, 2);
    assert.equal(result.mcpServers.length, 1);
  });

  it('should only include user-selected entities', async () => {
    const { service } = createService(
      [template1],
      [agentAnalyst, agentDev],
      [skillGit, skillPlaywright],
      [mcpContext7, mcpPlaywright],
    );

    const result = await service.exportBundle({
      templateIds: ['cve-fix'],
      agentNames: ['分析师'],           // only one agent
      skillIdentifiers: [],              // no skills
      mcpServerNames: [],                // no MCP servers
    });

    assert.equal(result.agents.length, 1);
    assert.equal(result.agents[0].name, '分析师');
    assert.equal(result.skills.length, 0);
    assert.equal(result.mcpServers.length, 0);
  });
});

describe('BundleService - previewImport', () => {
  it('should detect conflicts for existing entities', async () => {
    const { service } = createService(
      [template1],     // existing template
      [agentAnalyst],  // existing agent
      [skillGit],      // existing skill
      [mcpContext7],   // existing MCP
    );

    const exportData: BundleExportFile = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      templates: [{ template_id: 'cve-fix', name: 'CVE', steps: [] }],
      agents: [{ name: '分析师', executorType: 'claude-code', role: 'analyzer', enabled: true, skillNames: [], mcpServerNames: [] }],
      skills: [{ identifier: 'git', name: 'Git', description: '' }],
      mcpServers: [{ name: 'context7', server_type: 'stdio', config: {}, auto_install: 0, install_command: undefined }],
    };

    const result = await service.previewImport(exportData);

    assert.deepEqual(result.conflicts.templateIds, ['cve-fix']);
    assert.deepEqual(result.conflicts.agentNames, ['分析师']);
    assert.deepEqual(result.conflicts.skillIdentifiers, ['git']);
    assert.deepEqual(result.conflicts.mcpServerNames, ['context7']);
  });

  it('should return empty conflicts when no overlap', async () => {
    const { service } = createService([], [], [], []);

    const exportData: BundleExportFile = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      templates: [{ template_id: 'new-tpl', name: 'New', steps: [] }],
      agents: [{ name: 'New Agent', executorType: 'claude-code', role: 'dev', enabled: true, skillNames: [], mcpServerNames: [] }],
      skills: [{ identifier: 'new-skill', name: 'New Skill' }],
      mcpServers: [{ name: 'new-mcp', server_type: 'stdio', config: {}, auto_install: 0, install_command: undefined }],
    };

    const result = await service.previewImport(exportData);

    assert.deepEqual(result.conflicts.templateIds, []);
    assert.deepEqual(result.conflicts.agentNames, []);
    assert.deepEqual(result.conflicts.skillIdentifiers, []);
    assert.deepEqual(result.conflicts.mcpServerNames, []);
  });
});

describe('BundleService - confirmImport', () => {
  it('should import new entities with correct dependency resolution', async () => {
    const { service, skillRepo, mcpServerRepo, agentRepo, templateRepo } = createService([], [], [], []);

    const input: BundleImportConfirmInput = {
      templates: [{
        template_id: 'new-tpl', name: 'New Template',
        steps: [{ id: 's1', name: 'Step 1', instructionPrompt: 'Do it', agentName: 'New Agent' }],
      }],
      agents: [{
        name: 'New Agent', executorType: 'claude-code', role: 'dev',
        enabled: true, skillNames: ['new-skill'], mcpServerNames: ['new-mcp'],
      }],
      skills: [{ identifier: 'new-skill', name: 'New Skill', description: 'A skill' }],
      mcpServers: [{ name: 'new-mcp', server_type: 'stdio', config: { command: 'npx' }, auto_install: 0, install_command: undefined }],
      strategy: 'skip',
    };

    const result = await service.confirmImport(input);

    assert.equal(result.imported.skills, 1);
    assert.equal(result.imported.mcpServers, 1);
    assert.equal(result.imported.agents, 1);
    assert.equal(result.imported.templates, 1);

    // Verify agent has correct skill and MCP references (resolved by name → ID)
    const createdAgent = (await agentRepo.findAll())[0];
    assert.equal(createdAgent.skills.length, 1);
    assert.equal(createdAgent.mcpServers.length, 1);

    // Verify template step references the created agent
    const createdTemplate = (await templateRepo.findAll())[0];
    assert.equal(createdTemplate.steps[0].agentId, createdAgent.id);
  });

  it('should skip conflicting entities with skip strategy', async () => {
    const existingSkill: SkillEntity = {
      id: 1, identifier: 'git', name: 'Git',
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    };

    const { service } = createService([], [], [existingSkill], []);

    const input: BundleImportConfirmInput = {
      templates: [],
      agents: [],
      skills: [{ identifier: 'git', name: 'Git', description: 'Existing' }],
      mcpServers: [],
      strategy: 'skip',
    };

    const result = await service.confirmImport(input);

    assert.equal(result.skipped.skills, 1);
    assert.equal(result.imported.skills, 0);
  });

  it('should overwrite existing entities with overwrite strategy', async () => {
    const existingSkill: SkillEntity = {
      id: 1, identifier: 'git', name: 'Git', description: 'Old desc',
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    };

    const { service, skillRepo } = createService([], [], [existingSkill], []);

    const input: BundleImportConfirmInput = {
      templates: [],
      agents: [],
      skills: [{ identifier: 'git', name: 'Git', description: 'New desc' }],
      mcpServers: [],
      strategy: 'overwrite',
    };

    const result = await service.confirmImport(input);

    assert.equal(result.imported.skills, 1);
    const updated = (await skillRepo.findAll())[0];
    assert.equal(updated.description, 'New desc');
  });

  it('should create copies with unique names with copy strategy', async () => {
    const existingSkill: SkillEntity = {
      id: 1, identifier: 'git', name: 'Git',
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    };

    const { service, skillRepo } = createService([], [], [existingSkill], []);

    const input: BundleImportConfirmInput = {
      templates: [],
      agents: [],
      skills: [{ identifier: 'git', name: 'Git' }],
      mcpServers: [],
      strategy: 'copy',
    };

    const result = await service.confirmImport(input);

    assert.equal(result.imported.skills, 1);
    const allSkills = await skillRepo.findAll();
    assert.equal(allSkills.length, 2);
    assert.ok(allSkills.some(s => s.identifier === 'git-copy'));
  });

  it('should wire copy dependencies correctly — agent references copied skill', async () => {
    const existingSkill: SkillEntity = {
      id: 1, identifier: 'git', name: 'Git',
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    };

    const { service, skillRepo, agentRepo } = createService([], [], [existingSkill], []);

    const input: BundleImportConfirmInput = {
      templates: [],
      agents: [{
        name: 'New Agent', executorType: 'claude-code', role: 'dev',
        enabled: true, skillNames: ['git'], mcpServerNames: [],
      }],
      skills: [{ identifier: 'git', name: 'Git' }],
      mcpServers: [],
      strategy: 'copy',
    };

    const result = await service.confirmImport(input);

    assert.equal(result.imported.skills, 1);
    assert.equal(result.imported.agents, 1);

    // Agent should reference the NEW copied skill, not the old one
    const allSkills = await skillRepo.findAll();
    const copiedSkill = allSkills.find(s => s.identifier === 'git-copy');
    assert.ok(copiedSkill);

    const agent = (await agentRepo.findAll())[0];
    assert.equal(agent.skills[0], copiedSkill.id);
  });
});
