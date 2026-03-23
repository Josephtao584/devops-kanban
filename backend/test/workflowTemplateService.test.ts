import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { WorkflowTemplateRepository } from '../src/repositories/workflowTemplateRepository.js';
import { WorkflowTemplateService } from '../src/services/workflow/workflowTemplateService.js';
import type { UpdateWorkflowTemplateInput } from '../src/types/dto/workflowTemplates.ts';

function createTempFilePath(name = 'workflow-template.json') {
  return path.join(os.tmpdir(), `kanban-${Date.now()}-${Math.random().toString(16).slice(2)}-${name}`);
}

function buildValidTemplate(): UpdateWorkflowTemplateInput {
  return {
    template_id: 'dev-workflow-v1',
    name: '默认研发工作流',
    steps: [
      {
        id: 'requirement-design',
        name: '需求设计',
        instructionPrompt: '先做需求分析和设计拆解。',
        agentId: 1,
      },
      {
        id: 'code-development',
        name: '代码开发',
        instructionPrompt: '根据设计摘要完成代码实现。',
        agentId: 2,
      },
      {
        id: 'testing',
        name: '测试',
        instructionPrompt: '根据开发结果执行测试验证。',
        agentId: null,
      },
      {
        id: 'code-review',
        name: '代码审查',
        instructionPrompt: '根据测试结果完成代码审查总结。',
        agentId: 4,
      },
    ],
  };
}

test.test('WorkflowTemplateService returns default fixed four-step template when no data exists', async () => {
  const filePath = createTempFilePath();
  const repo = new WorkflowTemplateRepository({ filePath });
  const service = new WorkflowTemplateService({ workflowTemplateRepo: repo });

  const template = await service.getTemplate();

  assert.equal(template.template_id, 'dev-workflow-v1');
  assert.deepEqual(template.steps.map((step) => step.id), [
    'requirement-design',
    'code-development',
    'testing',
    'code-review',
  ]);
  assert.deepEqual(template.steps.map((step) => step.name), [
    '需求设计',
    '代码开发',
    '测试',
    '代码审查',
  ]);
  assert.deepEqual(template.steps.map((step) => step.agentId), [null, null, null, null]);
  assert.ok(template.steps.every((step) => typeof step.instructionPrompt === 'string' && step.instructionPrompt.trim()));

  const persisted = JSON.parse(await fs.readFile(filePath, 'utf-8')) as typeof template;
  assert.equal(persisted.template_id, 'dev-workflow-v1');
  assert.deepEqual(persisted.steps.map((step) => step.agentId), [null, null, null, null]);
  assert.ok(persisted.steps.every((step) => typeof step.instructionPrompt === 'string' && step.instructionPrompt.trim()));
});

test.test('WorkflowTemplateService normalizes legacy template missing instructionPrompt', async () => {
  const filePath = createTempFilePath();
  const repo = new WorkflowTemplateRepository({ filePath });
  await repo.save({
    template_id: 'dev-workflow-v1',
    name: '默认研发工作流',
    steps: [
      { id: 'requirement-design', name: '需求设计' },
      { id: 'code-development', name: '代码开发', agentId: 2 },
      { id: 'testing', name: '测试', agentId: 'bad-value' },
      { id: 'code-review', name: '代码审查', agentId: 4 },
    ],
  } as never);
  const service = new WorkflowTemplateService({ workflowTemplateRepo: repo });

  const template = await service.getTemplate();

  assert.ok(template.steps.every((step) => typeof step.instructionPrompt === 'string' && step.instructionPrompt.trim()));
  assert.deepEqual(template.steps.map((step) => step.agentId), [null, 2, null, 4]);
});

test.test('WorkflowTemplateService normalizes reordered stored steps by step id', async () => {
  const filePath = createTempFilePath();
  const repo = new WorkflowTemplateRepository({ filePath });
  await repo.save({
    template_id: 'dev-workflow-v1',
    name: '默认研发工作流',
    steps: [
      { id: 'testing', name: '测试', instructionPrompt: '测试步骤提示', agentId: 33 },
      { id: 'requirement-design', name: '需求设计', instructionPrompt: '需求步骤提示', agentId: 11 },
      { id: 'code-review', name: '代码审查', instructionPrompt: '审查步骤提示', agentId: 44 },
      { id: 'code-development', name: '代码开发', instructionPrompt: '开发步骤提示', agentId: 22 },
    ],
  } as never);
  const service = new WorkflowTemplateService({ workflowTemplateRepo: repo });

  const template = await service.getTemplate();

  assert.deepEqual(template.steps.map((step) => step.id), [
    'requirement-design',
    'code-development',
    'testing',
    'code-review',
  ]);
  assert.deepEqual(template.steps.map((step) => step.instructionPrompt), [
    '需求步骤提示',
    '开发步骤提示',
    '测试步骤提示',
    '审查步骤提示',
  ]);
  assert.deepEqual(template.steps.map((step) => step.agentId), [11, 22, 33, 44]);
});

test.test('WorkflowTemplateService rejects stored template with renamed fixed step names on read', async () => {
  const filePath = createTempFilePath();
  const repo = new WorkflowTemplateRepository({ filePath });
  await repo.save({
    template_id: 'dev-workflow-v1',
    name: '默认研发工作流',
    steps: [
      { id: 'requirement-design', name: '需求分析', instructionPrompt: '先做需求分析和设计拆解。', agentId: 1 },
      { id: 'code-development', name: '代码开发', instructionPrompt: '根据设计摘要完成代码实现。', agentId: 2 },
      { id: 'testing', name: '测试', instructionPrompt: '根据开发结果执行测试验证。', agentId: null },
      { id: 'code-review', name: '代码审查', instructionPrompt: '根据测试结果完成代码审查总结。', agentId: 4 },
    ],
  } as never);
  const service = new WorkflowTemplateService({ workflowTemplateRepo: repo });

  await assert.rejects(() => service.getTemplate(), /Invalid workflow template step names/);
});

test.test('WorkflowTemplateService rejects stored template with invalid template id on read', async () => {
  const filePath = createTempFilePath();
  const repo = new WorkflowTemplateRepository({ filePath });
  await repo.save({
    template_id: 'other-workflow',
    name: '默认研发工作流',
    steps: buildValidTemplate().steps,
  } as never);
  const service = new WorkflowTemplateService({ workflowTemplateRepo: repo });

  await assert.rejects(() => service.getTemplate(), /Invalid workflow template id/);
});

test.test('WorkflowTemplateService rejects stored template with non-array steps on read', async () => {
  const filePath = createTempFilePath();
  const repo = new WorkflowTemplateRepository({ filePath });
  await repo.save({
    template_id: 'dev-workflow-v1',
    name: '默认研发工作流',
    steps: {} as never,
  } as never);
  const service = new WorkflowTemplateService({ workflowTemplateRepo: repo });

  await assert.rejects(() => service.getTemplate(), /Invalid workflow template steps/);
});

test.test('WorkflowTemplateService rejects templates with non-fixed step ids', async () => {
  const filePath = createTempFilePath();
  const service = new WorkflowTemplateService({
    workflowTemplateRepo: new WorkflowTemplateRepository({ filePath }),
  });

  await assert.rejects(() => service.updateTemplate({
    template_id: 'dev-workflow-v1',
    name: 'x',
    steps: [{
      id: 'custom-step',
      name: '自定义',
      instructionPrompt: 'foo',
      agentId: 1,
    }],
  } as never), /Invalid workflow template step ids/);
});

test.test('WorkflowTemplateService rejects templates with renamed fixed steps', async () => {
  const filePath = createTempFilePath();
  const service = new WorkflowTemplateService({
    workflowTemplateRepo: new WorkflowTemplateRepository({ filePath }),
  });
  const template = buildValidTemplate();
  template.steps[1]!.name = '开发实现';

  await assert.rejects(() => service.updateTemplate(template), /Invalid workflow template step names/);
});

test.test('WorkflowTemplateService rejects non-number non-null agentId', async () => {
  const filePath = createTempFilePath();
  const service = new WorkflowTemplateService({
    workflowTemplateRepo: new WorkflowTemplateRepository({ filePath }),
  });
  const template = buildValidTemplate();
  template.steps[1]!.agentId = 'x' as never;

  await assert.rejects(() => service.updateTemplate(template), /agentId must be a number or null/);
});

test.test('WorkflowTemplateService rejects blank instructionPrompt', async () => {
  const filePath = createTempFilePath();
  const service = new WorkflowTemplateService({
    workflowTemplateRepo: new WorkflowTemplateRepository({ filePath }),
  });
  const template = buildValidTemplate();
  template.steps[1]!.instructionPrompt = '   ';

  await assert.rejects(() => service.updateTemplate(template), /instructionPrompt must be a non-empty string/);
});

test.test('WorkflowTemplateService updates valid template', async () => {
  const filePath = createTempFilePath();
  const service = new WorkflowTemplateService({
    workflowTemplateRepo: new WorkflowTemplateRepository({ filePath }),
  });
  const template = buildValidTemplate();
  template.steps[1]!.agentId = 7;
  template.steps[1]!.instructionPrompt = '根据设计摘要完成代码实现并记录修改结果。';

  const updated = await service.updateTemplate(template);

  assert.equal(updated.steps[1]!.name, '代码开发');
  assert.equal(updated.steps[1]!.agentId, 7);
  assert.equal(updated.steps[1]!.instructionPrompt, '根据设计摘要完成代码实现并记录修改结果。');

  const persisted = JSON.parse(await fs.readFile(filePath, 'utf-8')) as typeof updated;
  assert.equal(persisted.steps[1]!.name, '代码开发');
  assert.equal(persisted.steps[1]!.agentId, 7);
  assert.equal(persisted.steps[1]!.instructionPrompt, '根据设计摘要完成代码实现并记录修改结果。');
});
