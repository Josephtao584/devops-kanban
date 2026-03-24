import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import Fastify from 'fastify';

import { workflowTemplateRoutes } from '../src/routes/workflowTemplate.js';
import type { WorkflowTemplate } from '../src/services/workflow/workflowTemplateService.js';

type WorkflowTemplateRouteService = {
  getTemplates(): Promise<WorkflowTemplate[]>;
  getTemplateById(id: string): Promise<WorkflowTemplate | null>;
  createTemplate(template: WorkflowTemplate): Promise<WorkflowTemplate>;
  updateTemplate(template: WorkflowTemplate): Promise<WorkflowTemplate>;
  deleteTemplate(id: string): Promise<void>;
};

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

async function buildApp(service: WorkflowTemplateRouteService) {
  const app = Fastify();
  app.register(workflowTemplateRoutes, { service });
  await app.ready();
  return app;
}

test.test('GET /api/workflow-template returns the global template list', async () => {
  const templates = [buildQuickFixTemplate(), buildReviewOnlyTemplate()];
  const service: WorkflowTemplateRouteService = {
    async getTemplates() {
      return templates;
    },
    async getTemplateById(id: string) {
      return templates.find((template) => template.template_id === id) ?? null;
    },
    async createTemplate(template: WorkflowTemplate) {
      return template;
    },
    async updateTemplate(template: WorkflowTemplate) {
      return template;
    },
    async deleteTemplate() {
    },
  };
  const app = await buildApp(service);

  const response = await app.inject({ method: 'GET', url: '/' });
  const payload = response.json() as {
    success: boolean;
    data: WorkflowTemplate[];
  };

  assert.equal(response.statusCode, 200);
  assert.equal(payload.success, true);
  assert.deepEqual(payload.data.map((template) => template.template_id), ['quick-fix-v1', 'review-only-v1']);
  assert.equal(payload.data[0]?.steps[0]?.name, '问题定位');

  await app.close();
});

test.test('GET /api/workflow-template/:id returns template detail by id', async () => {
  const template = buildQuickFixTemplate();
  const service: WorkflowTemplateRouteService = {
    async getTemplates() {
      return [template];
    },
    async getTemplateById(id: string) {
      return id === template.template_id ? template : null;
    },
    async createTemplate(created: WorkflowTemplate) {
      return created;
    },
    async updateTemplate(updated: WorkflowTemplate) {
      return updated;
    },
    async deleteTemplate() {
    },
  };
  const app = await buildApp(service);

  const response = await app.inject({ method: 'GET', url: '/quick-fix-v1' });
  const payload = response.json() as {
    success: boolean;
    data: WorkflowTemplate;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.template_id, 'quick-fix-v1');
  assert.deepEqual(payload.data.steps.map((step) => step.id), ['triage', 'fix', 'verify']);

  await app.close();
});

test.test('GET /api/workflow-template/:id returns 404 when template is missing', async () => {
  const service: WorkflowTemplateRouteService = {
    async getTemplates() {
      return [];
    },
    async getTemplateById() {
      return null;
    },
    async createTemplate(template: WorkflowTemplate) {
      return template;
    },
    async updateTemplate(template: WorkflowTemplate) {
      return template;
    },
    async deleteTemplate() {
    },
  };
  const app = await buildApp(service);

  const response = await app.inject({ method: 'GET', url: '/missing-template' });
  const payload = response.json() as { success: boolean; message: string };

  assert.equal(response.statusCode, 404);
  assert.equal(payload.success, false);
  assert.match(payload.message, /Workflow template not found/);

  await app.close();
});

test.test('POST /api/workflow-template creates a new workflow template', async () => {
  let createdTemplate: WorkflowTemplate | null = null;
  const service: WorkflowTemplateRouteService = {
    async getTemplates() {
      return [];
    },
    async getTemplateById() {
      return null;
    },
    async createTemplate(template: WorkflowTemplate) {
      createdTemplate = template;
      return template;
    },
    async updateTemplate(template: WorkflowTemplate) {
      return template;
    },
    async deleteTemplate() {
    },
  };
  const app = await buildApp(service);

  const payload = buildQuickFixTemplate();
  const response = await app.inject({ method: 'POST', url: '/', payload });
  const body = response.json() as {
    success: boolean;
    data: WorkflowTemplate;
    message: string;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.success, true);
  assert.equal(body.message, 'Workflow template created');
  assert.equal(body.data.template_id, 'quick-fix-v1');
  assert.equal(createdTemplate?.steps[2]?.id, 'verify');

  await app.close();
});

test.test('PUT /api/workflow-template updates a selected template with variable steps', async () => {
  let savedTemplate: WorkflowTemplate | null = null;
  const service: WorkflowTemplateRouteService = {
    async getTemplates() {
      return [buildQuickFixTemplate()];
    },
    async getTemplateById(id: string) {
      return id === 'quick-fix-v1' ? buildQuickFixTemplate() : null;
    },
    async createTemplate(template: WorkflowTemplate) {
      return template;
    },
    async updateTemplate(template: WorkflowTemplate) {
      savedTemplate = template;
      return template;
    },
    async deleteTemplate() {
    },
  };
  const app = await buildApp(service);

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

  await app.close();
});

test.test('DELETE /api/workflow-template/:id deletes a custom workflow template', async () => {
  let deletedTemplateId: string | null = null;
  const service: WorkflowTemplateRouteService = {
    async getTemplates() {
      return [buildQuickFixTemplate()];
    },
    async getTemplateById(id: string) {
      return id === 'quick-fix-v1' ? buildQuickFixTemplate() : null;
    },
    async createTemplate(template: WorkflowTemplate) {
      return template;
    },
    async updateTemplate(template: WorkflowTemplate) {
      return template;
    },
    async deleteTemplate(id: string) {
      deletedTemplateId = id;
    },
  };
  const app = await buildApp(service);

  const response = await app.inject({ method: 'DELETE', url: '/quick-fix-v1' });
  const body = response.json() as {
    success: boolean;
    data: null;
    message: string;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.success, true);
  assert.equal(body.message, 'Workflow template deleted');
  assert.equal(deletedTemplateId, 'quick-fix-v1');

  await app.close();
});

test.test('DELETE /api/workflow-template/:id returns 400 for built-in template deletion', async () => {
  const service: WorkflowTemplateRouteService = {
    async getTemplates() {
      return [];
    },
    async getTemplateById() {
      return null;
    },
    async createTemplate(template: WorkflowTemplate) {
      return template;
    },
    async updateTemplate(template: WorkflowTemplate) {
      return template;
    },
    async deleteTemplate() {
      throw Object.assign(new Error('Cannot delete built-in workflow template: dev-workflow-v1'), { statusCode: 400 });
    },
  };
  const app = await buildApp(service);

  const response = await app.inject({ method: 'DELETE', url: '/dev-workflow-v1' });
  const body = response.json() as {
    success: boolean;
    message: string;
  };

  assert.equal(response.statusCode, 400);
  assert.equal(body.success, false);
  assert.equal(body.message, 'Cannot delete built-in workflow template: dev-workflow-v1');

  await app.close();
});
