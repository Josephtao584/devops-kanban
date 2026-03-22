import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { buildApp } from '../../src/app.js';

test.test('root route preserves success, message, version and endpoint data shape', async () => {
  const app = await buildApp();
  const response = await app.inject({ method: 'GET', url: '/' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    success: true,
    message: 'DevOps Kanban API',
    version: '0.1.0 (Node.js)',
    data: {
      endpoints: {
        projects: '/api/projects',
        tasks: '/api/tasks',
        sessions: '/api/sessions',
        taskSources: '/api/task-sources',
        executions: '/api/executions',
        agents: '/api/agents',
        workflows: '/api/workflows',
        websocket: '/ws',
        health: '/health',
      },
    },
  });
  await app.close();
});

test.test('health route preserves status ok shape', async () => {
  const app = await buildApp();
  const response = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: 'ok' });
  await app.close();
});
