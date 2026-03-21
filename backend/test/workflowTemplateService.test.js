import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { WorkflowTemplateRepository } from '../src/repositories/workflowTemplateRepository.js';
import { WorkflowTemplateService } from '../src/services/workflow/workflowTemplateService.js';

function createTempFilePath(name = 'workflow-template.json') {
  return path.join(os.tmpdir(), `kanban-${Date.now()}-${Math.random().toString(16).slice(2)}-${name}`);
}

function buildValidTemplate() {
  return {
    template_id: 'dev-workflow-v1',
    name: '默认研发工作流',
    steps: [
      {
        id: 'requirement-design',
        name: '需求设计',
        instructionPrompt: '先做需求分析和设计拆解。',
        executor: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} },
      },
      {
        id: 'code-development',
        name: '代码开发',
        instructionPrompt: '根据设计摘要完成代码实现。',
        executor: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} },
      },
      {
        id: 'testing',
        name: '测试',
        instructionPrompt: '根据开发结果执行测试验证。',
        executor: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} },
      },
      {
        id: 'code-review',
        name: '代码审查',
        instructionPrompt: '根据测试结果完成代码审查总结。',
        executor: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} },
      },
    ],
  };
}

test('WorkflowTemplateService returns default fixed four-step template when no data exists', async () => {
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
  assert.deepEqual(template.steps.map((step) => step.executor.type), [
    'CLAUDE_CODE',
    'CLAUDE_CODE',
    'CLAUDE_CODE',
    'CLAUDE_CODE',
  ]);
  assert.ok(template.steps.every((step) => typeof step.instructionPrompt === 'string' && step.instructionPrompt.trim()));

  const persisted = JSON.parse(await fs.readFile(filePath, 'utf-8'));
  assert.equal(persisted.template_id, 'dev-workflow-v1');
  assert.ok(persisted.steps.every((step) => typeof step.instructionPrompt === 'string' && step.instructionPrompt.trim()));
});

test('WorkflowTemplateService normalizes legacy template missing instructionPrompt', async () => {
  const filePath = createTempFilePath();
  const repo = new WorkflowTemplateRepository({ filePath });
  await repo.save({
    template_id: 'dev-workflow-v1',
    name: '默认研发工作流',
    steps: [
      { id: 'requirement-design', name: '需求设计', executor: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} } },
      { id: 'code-development', name: '代码开发', executor: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} } },
      { id: 'testing', name: '测试', executor: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} } },
      { id: 'code-review', name: '代码审查', executor: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} } },
    ],
  });
  const service = new WorkflowTemplateService({ workflowTemplateRepo: repo });

  const template = await service.getTemplate();

  assert.ok(template.steps.every((step) => typeof step.instructionPrompt === 'string' && step.instructionPrompt.trim()));
});

test('WorkflowTemplateService rejects templates with non-fixed step ids', async () => {
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
      executor: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} },
    }],
  }), /Invalid workflow template step ids/);
});

test('WorkflowTemplateService rejects unsupported executor types', async () => {
  const filePath = createTempFilePath();
  const service = new WorkflowTemplateService({
    workflowTemplateRepo: new WorkflowTemplateRepository({ filePath }),
  });
  const template = buildValidTemplate();
  template.steps[1].executor.type = 'UNKNOWN';

  await assert.rejects(() => service.updateTemplate(template), /Unsupported executor type/);
});

test('WorkflowTemplateService rejects blank instructionPrompt', async () => {
  const filePath = createTempFilePath();
  const service = new WorkflowTemplateService({
    workflowTemplateRepo: new WorkflowTemplateRepository({ filePath }),
  });
  const template = buildValidTemplate();
  template.steps[1].instructionPrompt = '   ';

  await assert.rejects(() => service.updateTemplate(template), /instructionPrompt must be a non-empty string/);
});

test('WorkflowTemplateService updates valid template', async () => {
  const filePath = createTempFilePath();
  const service = new WorkflowTemplateService({
    workflowTemplateRepo: new WorkflowTemplateRepository({ filePath }),
  });
  const template = buildValidTemplate();
  template.steps[1].executor.type = 'CODEX';
  template.steps[1].instructionPrompt = '根据设计摘要完成代码实现并记录修改结果。';

  const updated = await service.updateTemplate(template);

  assert.equal(updated.steps[1].executor.type, 'CODEX');
  assert.equal(updated.steps[1].instructionPrompt, '根据设计摘要完成代码实现并记录修改结果。');

  const persisted = JSON.parse(await fs.readFile(filePath, 'utf-8'));
  assert.equal(persisted.steps[1].executor.type, 'CODEX');
  assert.equal(persisted.steps[1].instructionPrompt, '根据设计摘要完成代码实现并记录修改结果。');
});
