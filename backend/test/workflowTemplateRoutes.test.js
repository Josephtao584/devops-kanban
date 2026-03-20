import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkflowTemplateService } from '../src/services/workflowTemplateService.js';
import workflowTemplateRoutes from '../src/routes/workflowTemplate.js';

function buildValidTemplate() {
  return {
    template_id: 'dev-workflow-v1',
    name: '默认研发工作流',
    steps: [
      {
        id: 'requirement-design',
        name: '需求设计',
        executor: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} },
      },
      {
        id: 'code-development',
        name: '代码开发',
        executor: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} },
      },
      {
        id: 'testing',
        name: '测试',
        executor: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} },
      },
      {
        id: 'code-review',
        name: '代码审查',
        executor: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} },
      },
    ],
  };
}

function createFastifyStub(service) {
  const routes = new Map();
  return {
    get(path, handler) {
      routes.set(`GET ${path}`, handler);
    },
    put(path, handler) {
      routes.set(`PUT ${path}`, handler);
    },
    async inject({ method, url, payload }) {
      const handler = routes.get(`${method.toUpperCase()} ${url}`);
      const replyState = { statusCode: 200 };
      const reply = {
        code(statusCode) {
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

test('GET /api/workflow-template returns the global template', async () => {
  const service = new WorkflowTemplateService({
    workflowTemplateRepo: {
      async get() {
        return buildValidTemplate();
      },
      async save(template) {
        return template;
      },
    },
  });
  const app = createFastifyStub(service);
  await workflowTemplateRoutes(app, { service });

  const response = await app.inject({ method: 'GET', url: '/' });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().success, true);
  assert.equal(response.json().data.template_id, 'dev-workflow-v1');
});

test('PUT /api/workflow-template updates step executor bindings', async () => {
  let savedTemplate = null;
  const service = new WorkflowTemplateService({
    workflowTemplateRepo: {
      async get() {
        return buildValidTemplate();
      },
      async save(template) {
        savedTemplate = template;
        return template;
      },
    },
  });
  const app = createFastifyStub(service);
  await workflowTemplateRoutes(app, { service });
  const payload = buildValidTemplate();
  payload.steps[1].executor.type = 'CODEX';

  const response = await app.inject({ method: 'PUT', url: '/', payload });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.steps[1].executor.type, 'CODEX');
  assert.equal(savedTemplate.steps[1].executor.type, 'CODEX');
});
