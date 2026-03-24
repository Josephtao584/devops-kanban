import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import { workflowTemplateRoutes } from '../src/routes/workflowTemplate.js';
import type { WorkflowTemplate } from '../src/services/workflow/workflowTemplateService.js';

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

function buildReviewOnlyTemplate(): WorkflowTemplate {
  return {
    template_id: 'review-only-v1',
    name: '审查工作流',
    steps: [
      {
        id: 'review',
        name: '代码审查',
        instructionPrompt: '审查现有改动并记录风险。',
        agentId: 4,
      },
      {
        id: 'report',
        name: '输出结论',
        instructionPrompt: '汇总结论并给出建议。',
        agentId: 5,
      },
    ],
  };
}

function createFastifyStub(service: {
  getTemplates(): Promise<WorkflowTemplate[]>;
  getTemplateById(id: string): Promise<WorkflowTemplate | null>;
  updateTemplate(template: WorkflowTemplate): Promise<WorkflowTemplate>;
}) {
  const routes = new Map<string, (request: { body?: unknown; params?: Record<string, string>; log: { error(): void } }, reply: { code(statusCode: number): unknown }) => Promise<unknown>>();
  return {
    get(path: string, handler: (request: { body?: unknown; params?: Record<string, string>; log: { error(): void } }, reply: { code(statusCode: number): unknown }) => Promise<unknown>) {
      routes.set(`GET ${path}`, handler);
    },
    put(path: string, handler: (request: { body?: unknown; params?: Record<string, string>; log: { error(): void } }, reply: { code(statusCode: number): unknown }) => Promise<unknown>) {
      routes.set(`PUT ${path}`, handler);
    },
    async inject({ method, url, payload }: { method: string; url: string; payload?: unknown }) {
      const upperMethod = method.toUpperCase();
      let matched: { handler: (request: { body?: unknown; params?: Record<string, string>; log: { error(): void } }, reply: { code(statusCode: number): unknown }) => Promise<unknown>; params: Record<string, string> } | null = null;

      for (const [key, handler] of routes.entries()) {
        const [registeredMethod, registeredPath] = key.split(' ');
        if (registeredMethod !== upperMethod) {
          continue;
        }

        if (registeredPath === url) {
          matched = { handler, params: {} };
          break;
        }

        if (registeredPath.includes('/:id')) {
          const prefix = registeredPath.slice(0, registeredPath.indexOf('/:id'));
          if (url.startsWith(prefix + '/')) {
            matched = {
              handler,
              params: { id: url.slice(prefix.length + 1) },
            };
            break;
          }
        }
      }

      if (!matched) {
        throw new Error(`Missing route handler for ${upperMethod} ${url}`);
      }

      const replyState = { statusCode: 200 };
      const reply = {
        code(statusCode: number) {
          replyState.statusCode = statusCode;
          return reply;
        },
      };
      const result = await matched.handler({ body: payload, params: matched.params, log: { error() {} } }, reply);
      return {
        statusCode: replyState.statusCode,
        json() {
          return result;
        },
      };
    },
  };
}

test.test('GET /api/workflow-template returns the global template list', async () => {
  const templates = [buildQuickFixTemplate(), buildReviewOnlyTemplate()];
  const service = {
    async getTemplates() {
      return templates;
    },
    async getTemplateById(id: string) {
      return templates.find((template) => template.template_id === id) ?? null;
    },
    async updateTemplate(template: WorkflowTemplate) {
      return template;
    },
  };
  const app = createFastifyStub(service);
  await workflowTemplateRoutes(app as never, { service: service as never });

  const response = await app.inject({ method: 'GET', url: '/' });
  const payload = response.json() as {
    success: boolean;
    data: WorkflowTemplate[];
  };

  assert.equal(response.statusCode, 200);
  assert.equal(payload.success, true);
  assert.deepEqual(payload.data.map((template) => template.template_id), ['quick-fix-v1', 'review-only-v1']);
  assert.equal(payload.data[0]?.steps[0]?.name, '问题定位');
});

test.test('GET /api/workflow-template/:id returns template detail by id', async () => {
  const template = buildQuickFixTemplate();
  const service = {
    async getTemplates() {
      return [template];
    },
    async getTemplateById(id: string) {
      return id === template.template_id ? template : null;
    },
    async updateTemplate(updated: WorkflowTemplate) {
      return updated;
    },
  };
  const app = createFastifyStub(service);
  await workflowTemplateRoutes(app as never, { service: service as never });

  const response = await app.inject({ method: 'GET', url: '/quick-fix-v1' });
  const payload = response.json() as {
    success: boolean;
    data: WorkflowTemplate;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.template_id, 'quick-fix-v1');
  assert.deepEqual(payload.data.steps.map((step) => step.id), ['triage', 'fix', 'verify']);
});

test.test('GET /api/workflow-template/:id returns 404 when template is missing', async () => {
  const service = {
    async getTemplates() {
      return [];
    },
    async getTemplateById() {
      return null;
    },
    async updateTemplate(template: WorkflowTemplate) {
      return template;
    },
  };
  const app = createFastifyStub(service);
  await workflowTemplateRoutes(app as never, { service: service as never });

  const response = await app.inject({ method: 'GET', url: '/missing-template' });
  const payload = response.json() as { success: boolean; message: string };

  assert.equal(response.statusCode, 404);
  assert.equal(payload.success, false);
  assert.match(payload.message, /Workflow template not found/);
});

test.test('PUT /api/workflow-template updates a selected template with variable steps', async () => {
  let savedTemplate: WorkflowTemplate | null = null;
  const service = {
    async getTemplates() {
      return [buildQuickFixTemplate()];
    },
    async getTemplateById(id: string) {
      return id === 'quick-fix-v1' ? buildQuickFixTemplate() : null;
    },
    async updateTemplate(template: WorkflowTemplate) {
      savedTemplate = template;
      return template;
    },
  };
  const app = createFastifyStub(service);
  await workflowTemplateRoutes(app as never, { service: service as never });

  const payload: WorkflowTemplate = {
    template_id: 'quick-fix-v1',
    name: '快速修复工作流',
    steps: [
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
    ],
  };

  const response = await app.inject({ method: 'PUT', url: '/', payload });
  const body = response.json() as {
    success: boolean;
    data: WorkflowTemplate;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.success, true);
  assert.deepEqual(body.data.steps.map((step) => step.id), ['investigate', 'implement']);
  assert.equal(savedTemplate?.steps[1]?.agentId, 9);
});
