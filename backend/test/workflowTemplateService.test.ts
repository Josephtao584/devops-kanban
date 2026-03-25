import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { WorkflowTemplateRepository } from '../src/repositories/workflowTemplateRepository.js';
import { WorkflowTemplateService } from '../src/services/workflow/workflowTemplateService.js';
import type { WorkflowTemplate } from '../src/services/workflow/workflowTemplateService.js';

function createTempFilePath(name: string) {
  return path.join(os.tmpdir(), `kanban-${Date.now()}-${Math.random().toString(16).slice(2)}-${name}`);
}

function createRepositoryPaths() {
  return {
    filePath: createTempFilePath('workflow-templates.json'),
    legacyFilePath: createTempFilePath('workflow-template.json'),
  };
}

function buildQuickFixTemplate(): WorkflowTemplate {
  return {
    template_id: 'quick-fix-v1',
    name: '快速修复工作流',
    steps: [
      {
        id: 'triage',
        name: '问题定位',
        instructionPrompt: '先确认问题范围、触发条件和修复策略。',
        agentId: 1,
      },
      {
        id: 'fix',
        name: '实施修复',
        instructionPrompt: '根据定位结果完成最小改动修复。',
        agentId: 2,
      },
      {
        id: 'verify',
        name: '回归验证',
        instructionPrompt: '验证修复结果并确认没有引入明显回归。',
        agentId: 3,
      },
    ],
  };
}

test.test('WorkflowTemplateService seeds only the default built-in template when no stored data exists', async () => {
  const paths = createRepositoryPaths();
  const repo = new WorkflowTemplateRepository(paths);
  const service = new WorkflowTemplateService({ workflowTemplateRepo: repo });

  const templates = await service.getTemplates();

  assert.equal(templates.length, 1);
  assert.equal(templates[0]?.template_id, 'dev-workflow-v1');
  assert.ok(templates.every((template) => template.steps.length >= 2));
  assert.ok(templates.every((template) => template.steps.every((step) => typeof step.id === 'string' && step.id.trim())));
  assert.ok(templates.every((template) => template.steps.every((step) => typeof step.instructionPrompt === 'string' && step.instructionPrompt.trim())));

  const persisted = JSON.parse(await fs.readFile(paths.filePath, 'utf-8')) as WorkflowTemplate[];
  assert.equal(persisted.length, templates.length);
  assert.equal(persisted[0]?.template_id, 'dev-workflow-v1');
});

test.test('WorkflowTemplateService returns template details by id from the stored collection', async () => {
  const paths = createRepositoryPaths();
  const repo = new WorkflowTemplateRepository(paths);
  await repo.saveAll([buildQuickFixTemplate()]);
  const service = new WorkflowTemplateService({ workflowTemplateRepo: repo });

  const template = await service.getTemplateById('quick-fix-v1');

  assert.equal(template?.template_id, 'quick-fix-v1');
  assert.deepEqual(template?.steps.map((step) => step.id), ['triage', 'fix', 'verify']);
  assert.equal(template?.steps[1]?.name, '实施修复');
});

test.test('WorkflowTemplateService migrates legacy singleton storage and preserves its template data', async () => {
  const paths = createRepositoryPaths();
  const repo = new WorkflowTemplateRepository(paths);
  await fs.mkdir(path.dirname(paths.legacyFilePath), { recursive: true });
  await fs.writeFile(paths.legacyFilePath, JSON.stringify({
    template_id: 'dev-workflow-v1',
    name: '旧版研发工作流',
    steps: [
      {
        id: 'requirement-design',
        name: '需求设计',
        instructionPrompt: '先完成旧版需求分析。',
        agentId: 11,
      },
      {
        id: 'code-development',
        name: '代码开发',
        instructionPrompt: '根据旧版设计完成开发。',
        agentId: 12,
      },
      {
        id: 'testing',
        name: '测试',
        instructionPrompt: '执行旧版验证。',
        agentId: 13,
      },
      {
        id: 'code-review',
        name: '代码审查',
        instructionPrompt: '完成旧版审查。',
        agentId: 14,
      },
    ],
  }, null, 2), 'utf-8');
  const service = new WorkflowTemplateService({ workflowTemplateRepo: repo });

  const templates = await service.getTemplates();
  const migrated = templates.find((template) => template.template_id === 'dev-workflow-v1');

  assert.equal(migrated?.name, '旧版研发工作流');
  assert.equal(migrated?.steps[0]?.instructionPrompt, '先完成旧版需求分析。');
  assert.equal(templates.length, 1);

  const persisted = JSON.parse(await fs.readFile(paths.filePath, 'utf-8')) as WorkflowTemplate[];
  assert.ok(Array.isArray(persisted));
  assert.ok(persisted.some((template) => template.template_id === 'dev-workflow-v1'));
});

test.test('WorkflowTemplateService creates a new custom workflow template', async () => {
  const paths = createRepositoryPaths();
  const service = new WorkflowTemplateService({
    workflowTemplateRepo: new WorkflowTemplateRepository(paths),
  });

  const created = await service.createTemplate(buildQuickFixTemplate());

  assert.equal(created.template_id, 'quick-fix-v1');
  const persisted = await service.getTemplateById('quick-fix-v1');
  assert.deepEqual(persisted?.steps.map((step) => step.id), ['triage', 'fix', 'verify']);
});

test.test('WorkflowTemplateService rejects creating a duplicate workflow template id', async () => {
  const paths = createRepositoryPaths();
  const service = new WorkflowTemplateService({
    workflowTemplateRepo: new WorkflowTemplateRepository(paths),
  });

  await service.createTemplate(buildQuickFixTemplate());

  await assert.rejects(
    () => service.createTemplate(buildQuickFixTemplate()),
    /Workflow template already exists: quick-fix-v1/
  );
});

test.test('WorkflowTemplateService updates an existing custom workflow template with variable linear step definitions', async () => {
  const paths = createRepositoryPaths();
  const repo = new WorkflowTemplateRepository(paths);
  const service = new WorkflowTemplateService({ workflowTemplateRepo: repo });
  await service.createTemplate(buildQuickFixTemplate());
  const template = buildQuickFixTemplate();
  template.steps = [
    {
      id: 'investigate',
      name: '调查问题',
      instructionPrompt: '先梳理现象与根因。',
      agentId: 8,
    },
    {
      id: 'implement',
      name: '实施修改',
      instructionPrompt: '基于调查结论完成实现。',
      agentId: 9,
    },
  ];

  const updated = await service.updateTemplate(template);

  assert.deepEqual(updated.steps.map((step) => step.id), ['investigate', 'implement']);
  assert.equal(updated.steps[0]?.agentId, 8);

  const persisted = await service.getTemplateById('quick-fix-v1');
  assert.deepEqual(persisted?.steps.map((step) => step.name), ['调查问题', '实施修改']);
});

test.test('WorkflowTemplateService updates the default built-in template', async () => {
  const paths = createRepositoryPaths();
  const service = new WorkflowTemplateService({
    workflowTemplateRepo: new WorkflowTemplateRepository(paths),
  });
  const template = await service.getTemplateById('dev-workflow-v1');
  assert.ok(template);
  template.steps = [
    {
      id: 'design',
      name: '设计',
      instructionPrompt: '更新默认模板设计步骤。',
      agentId: 1,
    },
    {
      id: 'build',
      name: '开发',
      instructionPrompt: '更新默认模板开发步骤。',
      agentId: 1,
    },
  ];

  const updated = await service.updateTemplate(template);

  assert.deepEqual(updated.steps.map((step) => step.id), ['design', 'build']);
  const persisted = await service.getTemplateById('dev-workflow-v1');
  assert.deepEqual(persisted?.steps.map((step) => step.name), ['设计', '开发']);
});

test.test('WorkflowTemplateService rejects updating a missing workflow template', async () => {
  const paths = createRepositoryPaths();
  const service = new WorkflowTemplateService({
    workflowTemplateRepo: new WorkflowTemplateRepository(paths),
  });

  await assert.rejects(
    () => service.updateTemplate(buildQuickFixTemplate()),
    /Workflow template not found: quick-fix-v1/
  );
});

test.test('WorkflowTemplateService deletes a custom workflow template', async () => {
  const paths = createRepositoryPaths();
  const service = new WorkflowTemplateService({
    workflowTemplateRepo: new WorkflowTemplateRepository(paths),
  });

  await service.createTemplate(buildQuickFixTemplate());
  await service.deleteTemplate('quick-fix-v1');

  const deleted = await service.getTemplateById('quick-fix-v1');
  assert.equal(deleted, null);
});

test.test('WorkflowTemplateService rejects deleting the default built-in template', async () => {
  const paths = createRepositoryPaths();
  const service = new WorkflowTemplateService({
    workflowTemplateRepo: new WorkflowTemplateRepository(paths),
  });

  await assert.rejects(
    () => service.deleteTemplate('dev-workflow-v1'),
    /Cannot delete built-in workflow template: dev-workflow-v1/
  );
});

test.test('WorkflowTemplateService rejects deleting a missing workflow template', async () => {
  const paths = createRepositoryPaths();
  const service = new WorkflowTemplateService({
    workflowTemplateRepo: new WorkflowTemplateRepository(paths),
  });

  await assert.rejects(
    () => service.deleteTemplate('missing-template'),
    /Workflow template not found: missing-template/
  );
});

test.test('WorkflowTemplateService surfaces malformed current storage instead of reseeding built-ins', async () => {
  const paths = createRepositoryPaths();
  await fs.mkdir(path.dirname(paths.filePath), { recursive: true });
  await fs.writeFile(paths.filePath, '{not valid json', 'utf-8');
  const service = new WorkflowTemplateService({
    workflowTemplateRepo: new WorkflowTemplateRepository(paths),
  });

  await assert.rejects(
    () => service.getTemplates(),
    /Failed to read workflow template storage/
  );

  const persisted = await fs.readFile(paths.filePath, 'utf-8');
  assert.equal(persisted, '{not valid json');
});

test.test('WorkflowTemplateService surfaces malformed legacy storage instead of reseeding built-ins', async () => {
  const paths = createRepositoryPaths();
  await fs.mkdir(path.dirname(paths.legacyFilePath), { recursive: true });
  await fs.writeFile(paths.legacyFilePath, '{not valid json', 'utf-8');
  const service = new WorkflowTemplateService({
    workflowTemplateRepo: new WorkflowTemplateRepository(paths),
  });

  await assert.rejects(
    () => service.getTemplates(),
    /Failed to read legacy workflow template storage/
  );

  await assert.rejects(() => fs.access(paths.filePath));
});

test.test('WorkflowTemplateService rejects templates with duplicate step ids', async () => {
  const paths = createRepositoryPaths();
  const service = new WorkflowTemplateService({
    workflowTemplateRepo: new WorkflowTemplateRepository(paths),
  });
  const template = buildQuickFixTemplate();
  template.steps = [
    template.steps[0]!,
    {
      ...template.steps[1]!,
      id: 'triage',
    },
  ];

  await assert.rejects(() => service.updateTemplate(template), /step ids must be unique/i);
});

test.test('WorkflowTemplateService rejects templates with blank step prompts', async () => {
  const paths = createRepositoryPaths();
  const service = new WorkflowTemplateService({
    workflowTemplateRepo: new WorkflowTemplateRepository(paths),
  });
  const template = buildQuickFixTemplate();
  template.steps[1]!.instructionPrompt = '   ';

  await assert.rejects(() => service.createTemplate(template), /instructionPrompt must be a non-empty string/i);
});

test.test('WorkflowTemplateService rejects templates with negative agent ids', async () => {
  const paths = createRepositoryPaths();
  const service = new WorkflowTemplateService({
    workflowTemplateRepo: new WorkflowTemplateRepository(paths),
  });
  const template = buildQuickFixTemplate();
  template.steps[0]!.agentId = -1;

  await assert.rejects(() => service.createTemplate(template), /agentId must be null or a non-negative integer/i);
});

test.test('WorkflowTemplateService rejects templates with fractional agent ids', async () => {
  const paths = createRepositoryPaths();
  const service = new WorkflowTemplateService({
    workflowTemplateRepo: new WorkflowTemplateRepository(paths),
  });
  const template = buildQuickFixTemplate();
  template.steps[0]!.agentId = 1.5;

  await assert.rejects(() => service.createTemplate(template), /agentId must be null or a non-negative integer/i);
});
