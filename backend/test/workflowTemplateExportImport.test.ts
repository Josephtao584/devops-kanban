import { describe, it, mock, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { WorkflowTemplateService } from '../src/services/workflow/workflowTemplateService.js';
import { NotFoundError } from '../src/utils/errors.js';
import type { WorkflowTemplateEntity, AgentEntity } from '../src/types/entities.js';
import { ExecutorType } from '../src/types/executors.js';
import type { ExportFile } from '../src/types/dto/workflowTemplates.js';

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
  return {
    findAll: mock.fn(async () => agents),
    findById: mock.fn(async (id: number) => agents.find(a => a.id === id) || null),
  };
}

// --- Test data ---

const sampleAgent: AgentEntity = {
  id: 1,
  name: 'Claude Code',
  executorType: ExecutorType.CLAUDE_CODE,
  role: 'Developer',
  description: 'Test agent',
  enabled: true,
  skills: [],
  mcpServers: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const sampleTemplate: WorkflowTemplateEntity = {
  id: 1,
  template_id: 'test-workflow',
  name: 'Test Workflow',
  steps: [
    { id: 'step1', name: 'Step 1', instructionPrompt: 'Do something', agentId: 1, requiresConfirmation: false },
    { id: 'step2', name: 'Step 2', instructionPrompt: 'Do more', agentId: 1, requiresConfirmation: true },
  ],
  order: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

// --- Tests ---

describe('WorkflowTemplateService - Export', () => {
  let service: WorkflowTemplateService;
  let templateRepo: ReturnType<typeof createMockTemplateRepo>;
  let agentRepo: ReturnType<typeof createMockAgentRepo>;

  beforeEach(() => {
    templateRepo = createMockTemplateRepo([sampleTemplate]);
    agentRepo = createMockAgentRepo([sampleAgent]);
    service = new WorkflowTemplateService({
      // @ts-expect-error mock repo
      workflowTemplateRepo: templateRepo,
      // @ts-expect-error mock repo
      agentRepo,
    });
  });

  it('should export a single template with agentName instead of agentId', async () => {
    const result = await service.exportTemplate('test-workflow');

    assert.equal(result.version, '1.0');
    assert.equal(result.templates.length, 1);
    assert.equal(result.templates[0]!.template_id, 'test-workflow');
    assert.equal(result.templates[0]!.steps[0]!.agentName, 'Claude Code');
    assert.equal(result.templates[0]!.steps[1]!.agentName, 'Claude Code');
    assert.ok(result.exportedAt);
  });

  it('should throw NotFoundError for non-existent template', async () => {
    await assert.rejects(
      () => service.exportTemplate('non-existent'),
      (error: unknown) => {
        assert.ok(error instanceof NotFoundError);
        return true;
      }
    );
  });

  it('should export multiple templates by IDs', async () => {
    const secondTemplate = {
      ...sampleTemplate,
      id: 2,
      template_id: 'second-workflow',
      name: 'Second',
    };
    templateRepo = createMockTemplateRepo([sampleTemplate, secondTemplate]);
    agentRepo = createMockAgentRepo([sampleAgent]);
    service = new WorkflowTemplateService({
      // @ts-expect-error mock repo
      workflowTemplateRepo: templateRepo,
      // @ts-expect-error mock repo
      agentRepo,
    });

    const result = await service.exportTemplates(['test-workflow', 'second-workflow']);
    assert.equal(result.templates.length, 2);
  });

  it('should use fallback name when agent not found', async () => {
    templateRepo = createMockTemplateRepo([sampleTemplate]);
    agentRepo = createMockAgentRepo([]); // no agents
    service = new WorkflowTemplateService({
      // @ts-expect-error mock repo
      workflowTemplateRepo: templateRepo,
      // @ts-expect-error mock repo
      agentRepo,
    });

    const result = await service.exportTemplate('test-workflow');
    assert.equal(result.templates[0]!.steps[0]!.agentName, 'Agent#1');
  });
});

describe('WorkflowTemplateService - Import Preview', () => {
  let service: WorkflowTemplateService;
  let templateRepo: ReturnType<typeof createMockTemplateRepo>;
  let agentRepo: ReturnType<typeof createMockAgentRepo>;

  beforeEach(() => {
    templateRepo = createMockTemplateRepo([sampleTemplate]);
    agentRepo = createMockAgentRepo([sampleAgent]);
    service = new WorkflowTemplateService({
      // @ts-expect-error mock repo
      workflowTemplateRepo: templateRepo,
      // @ts-expect-error mock repo
      agentRepo,
    });
  });

  it('should detect existing template IDs', async () => {
    const exportData: ExportFile = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      templates: [{
        template_id: 'test-workflow',
        name: 'Test Workflow',
        steps: [{ id: 's1', name: 'Step', instructionPrompt: 'Do it', agentName: 'Claude Code' }],
      }],
    };

    const preview = await service.previewImport(exportData);
    assert.deepEqual(preview.existingTemplateIds, ['test-workflow']);
    assert.deepEqual(preview.unmatchedAgentNames, []);
  });

  it('should detect unmatched agent names', async () => {
    const exportData: ExportFile = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      templates: [{
        template_id: 'new-template',
        name: 'New',
        steps: [{ id: 's1', name: 'Step', instructionPrompt: 'Do it', agentName: 'Unknown Agent' }],
      }],
    };

    const preview = await service.previewImport(exportData);
    assert.deepEqual(preview.existingTemplateIds, []);
    assert.deepEqual(preview.unmatchedAgentNames, ['Unknown Agent']);
  });

  it('should do case-insensitive agent matching', async () => {
    const exportData: ExportFile = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      templates: [{
        template_id: 'new-template',
        name: 'New',
        steps: [{ id: 's1', name: 'Step', instructionPrompt: 'Do it', agentName: 'claude code' }],
      }],
    };

    const preview = await service.previewImport(exportData);
    assert.deepEqual(preview.unmatchedAgentNames, []);
  });
});

describe('WorkflowTemplateService - Import Confirm', () => {
  let service: WorkflowTemplateService;
  let templateRepo: ReturnType<typeof createMockTemplateRepo>;
  let agentRepo: ReturnType<typeof createMockAgentRepo>;

  beforeEach(() => {
    templateRepo = createMockTemplateRepo([sampleTemplate]);
    agentRepo = createMockAgentRepo([sampleAgent]);
    service = new WorkflowTemplateService({
      // @ts-expect-error mock repo
      workflowTemplateRepo: templateRepo,
      // @ts-expect-error mock repo
      agentRepo,
    });
  });

  it('should create new template when no conflict', async () => {
    const result = await service.confirmImport({
      templates: [{
        template_id: 'brand-new',
        name: 'Brand New',
        steps: [{ id: 's1', name: 'Step', instructionPrompt: 'Do it', agentName: 'Claude Code' }],
      }],
      strategy: 'copy',
      agentMappings: {},
    });

    assert.equal(result.imported.length, 1);
    assert.equal(result.imported[0]!.template_id, 'brand-new');
    assert.equal(result.imported[0]!.steps[0]!.agentId, 1);
    assert.deepEqual(result.skipped, []);
  });

  it('should skip existing template with skip strategy', async () => {
    const result = await service.confirmImport({
      templates: [{
        template_id: 'test-workflow',
        name: 'Test Workflow',
        steps: [{ id: 's1', name: 'Step', instructionPrompt: 'Do it', agentName: 'Claude Code' }],
      }],
      strategy: 'skip',
      agentMappings: {},
    });

    assert.equal(result.imported.length, 0);
    assert.deepEqual(result.skipped, ['test-workflow']);
  });

  it('should overwrite existing template with overwrite strategy', async () => {
    const result = await service.confirmImport({
      templates: [{
        template_id: 'test-workflow',
        name: 'Updated Name',
        steps: [{ id: 's1', name: 'Updated Step', instructionPrompt: 'New instruction', agentName: 'Claude Code' }],
      }],
      strategy: 'overwrite',
      agentMappings: {},
    });

    assert.equal(result.imported.length, 1);
    assert.equal(result.imported[0]!.name, 'Updated Name');
  });

  it('should create a copy with renamed ID with copy strategy', async () => {
    const result = await service.confirmImport({
      templates: [{
        template_id: 'test-workflow',
        name: 'Test Workflow',
        steps: [{ id: 's1', name: 'Step', instructionPrompt: 'Do it', agentName: 'Claude Code' }],
      }],
      strategy: 'copy',
      agentMappings: {},
    });

    assert.equal(result.imported.length, 1);
    assert.equal(result.imported[0]!.template_id, 'test-workflow-copy');
    assert.ok(result.imported[0]!.name.includes('副本'));
  });

  it('should use agentMappings for unmatched agents', async () => {
    const result = await service.confirmImport({
      templates: [{
        template_id: 'new-one',
        name: 'New',
        steps: [{ id: 's1', name: 'Step', instructionPrompt: 'Do it', agentName: 'Missing Agent' }],
      }],
      strategy: 'copy',
      agentMappings: { 'Missing Agent': 1 },
    });

    assert.equal(result.imported[0]!.steps[0]!.agentId, 1);
  });

  it('should fallback to agentId 0 when agent not found and no mapping', async () => {
    const result = await service.confirmImport({
      templates: [{
        template_id: 'new-one',
        name: 'New',
        steps: [{ id: 's1', name: 'Step', instructionPrompt: 'Do it', agentName: 'Missing Agent' }],
      }],
      strategy: 'copy',
      agentMappings: {},
    });

    assert.equal(result.imported[0]!.steps[0]!.agentId, 0);
  });

  it('should reject invalid strategy', async () => {
    await assert.rejects(
      () => service.confirmImport({
        templates: [{ template_id: 'test', name: 'Test', steps: [{ id: 's1', name: 'Step', instructionPrompt: 'Do it', agentName: 'Claude Code' }] }],
        strategy: 'invalid' as 'skip',
        agentMappings: {},
      }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.ok((error as any).code === 'VALIDATION_ERROR');
        return true;
      }
    );
  });

  it('should handle multiple templates with mixed strategies', async () => {
    const result = await service.confirmImport({
      templates: [
        {
          template_id: 'test-workflow',
          name: 'Existing',
          steps: [{ id: 's1', name: 'Step', instructionPrompt: 'Do it', agentName: 'Claude Code' }],
        },
        {
          template_id: 'brand-new',
          name: 'New',
          steps: [{ id: 's1', name: 'Step', instructionPrompt: 'Do it', agentName: 'Claude Code' }],
        },
      ],
      strategy: 'copy',
      agentMappings: {},
    });

    // First template gets a copy, second is new
    assert.equal(result.imported.length, 2);
  });
});
