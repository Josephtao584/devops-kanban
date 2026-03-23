import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import { WorkflowTemplateService } from '../src/services/workflow/workflowTemplateService.js';
import type { WorkflowTemplate } from '../src/services/workflow/workflowTemplateService.js';
import { workflowTemplateRoutes } from '../src/routes/workflowTemplate.js';
import type { UpdateWorkflowTemplateInput } from '../src/types/dto/workflowTemplates.ts';

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

function createFastifyStub(service: WorkflowTemplateService) {
  const routes = new Map<string, (request: { body?: unknown; log: { error(): void } }, reply: { code(statusCode: number): unknown }) => Promise<unknown>>();
  return {
    get(path: string, handler: (request: { body?: unknown; log: { error(): void } }, reply: { code(statusCode: number): unknown }) => Promise<unknown>) {
      routes.set(`GET ${path}`, handler);
    },
    put(path: string, handler: (request: { body?: unknown; log: { error(): void } }, reply: { code(statusCode: number): unknown }) => Promise<unknown>) {
      routes.set(`PUT ${path}`, handler);
    },
    async inject({ method, url, payload }: { method: string; url: string; payload?: unknown }) {
      const handler = routes.get(`${method.toUpperCase()} ${url}`);
      if (!handler) {
        throw new Error(`Missing route handler for ${method.toUpperCase()} ${url}`);
      }
      const replyState = { statusCode: 200 };
      const reply = {
        code(statusCode: number) {
          replyState.statusCode = statusCode;
          return reply;
        },
      };
      const result = await handler({ body: payload, log: { error() {} } }, reply);
      return {
        statusCode: replyState.statusCode,
        json() {
          return result;
        },
      };
    },
    service,
  };
}

test.test('GET /api/workflow-template returns the global template', async () => {
  const service = new WorkflowTemplateService({
    workflowTemplateRepo: {
      async get() {
        return buildValidTemplate();
      },
      async save(template: WorkflowTemplate) {
        return template;
      },
    } as never,
  });
  const app = createFastifyStub(service);
  await workflowTemplateRoutes(app as never, { service });

  const response = await app.inject({ method: 'GET', url: '/' });
  const payload = response.json() as {
    success: boolean;
    data: { template_id: string; steps: Array<{ name: string; instructionPrompt: string; agentId: number | null }> };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.template_id, 'dev-workflow-v1');
  assert.equal(payload.data.steps[0]!.name, '需求设计');
  assert.equal(payload.data.steps[0]!.instructionPrompt, '先做需求分析和设计拆解。');
  assert.equal(payload.data.steps[1]!.agentId, 2);
});

test.test('PUT /api/workflow-template updates step agent bindings with fixed step names', async () => {
  let savedTemplate: WorkflowTemplate | null = null;
  const service = new WorkflowTemplateService({
    workflowTemplateRepo: {
      async get() {
        return buildValidTemplate();
      },
      async save(template: WorkflowTemplate) {
        savedTemplate = template;
        return template;
      },
    } as never,
  });
  const app = createFastifyStub(service);
  await workflowTemplateRoutes(app as never, { service });
  const payload = buildValidTemplate();
  payload.steps[1]!.agentId = 7;
  payload.steps[1]!.instructionPrompt = '根据设计摘要完成代码实现并记录主要改动。';

  const response = await app.inject({ method: 'PUT', url: '/', payload });
  const body = response.json() as {
    success: boolean;
    data: { steps: Array<{ name: string; agentId: number | null; instructionPrompt: string }> };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.steps[1]!.name, '代码开发');
  assert.equal(body.data.steps[1]!.agentId, 7);
  assert.equal(body.data.steps[1]!.instructionPrompt, '根据设计摘要完成代码实现并记录主要改动。');
  if (savedTemplate === null) {
    throw new Error('Expected template to be saved');
  }
  const persistedTemplate: WorkflowTemplate = savedTemplate;
  assert.equal(persistedTemplate.steps[1]!.name, '代码开发');
  assert.equal(persistedTemplate.steps[1]!.agentId, 7);
  assert.equal(persistedTemplate.steps[1]!.instructionPrompt, '根据设计摘要完成代码实现并记录主要改动。');
});

test.test('PUT /api/workflow-template rejects renamed fixed step names', async () => {
  const service = new WorkflowTemplateService({
    workflowTemplateRepo: {
      async get() {
        return buildValidTemplate();
      },
      async save(template: WorkflowTemplate) {
        return template;
      },
    } as never,
  });
  const app = createFastifyStub(service);
  await workflowTemplateRoutes(app as never, { service });
  const payload = buildValidTemplate();
  payload.steps[1]!.name = '开发实现';

  const response = await app.inject({ method: 'PUT', url: '/', payload });
  const body = response.json() as { success: boolean; message: string };

  assert.equal(response.statusCode, 400);
  assert.equal(body.success, false);
  assert.match(body.message, /Invalid workflow template step names/);
});
