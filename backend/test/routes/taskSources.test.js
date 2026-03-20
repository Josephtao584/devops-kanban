import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';

import taskSourceRoutes from '../../src/routes/taskSources.js';
import { READ_ONLY_ERROR_MESSAGE } from '../../src/services/taskSourceService.js';

function buildApp(serviceOverrides = {}) {
  const app = Fastify();
  const service = {
    getByProject: async () => [],
    getById: async () => null,
    getAvailableSourceTypes: async () => ({
      REQUIREMENT: { type: 'REQUIREMENT', name: '需求池' },
    }),
    ...serviceOverrides,
  };

  app.decorate('taskSourceService', service);
  app.register(taskSourceRoutes);
  return { app, service };
}

test('GET / returns project sources', async () => {
  const seenProjectIds = [];
  const { app } = buildApp({
    getByProject: async (projectId) => {
      seenProjectIds.push(projectId);
      return [{ id: 'requirement-orders', project_id: projectId, type: 'REQUIREMENT', config: {} }];
    },
  });

  await app.ready();
  const response = await app.inject({ method: 'GET', url: '/?project_id=12' });
  const payload = response.json();

  assert.equal(response.statusCode, 200);
  assert.deepEqual(seenProjectIds, [12]);
  assert.equal(payload.success, true);
  assert.deepEqual(payload.data, [{ id: 'requirement-orders', project_id: 12, type: 'REQUIREMENT', config: {} }]);
});

test('GET / returns 400 when project_id is missing', async () => {
  const { app } = buildApp();

  await app.ready();
  const response = await app.inject({ method: 'GET', url: '/' });
  const payload = response.json();

  assert.equal(response.statusCode, 400);
  assert.equal(payload.success, false);
  assert.equal(payload.message, 'project_id query parameter is required');
});

test('GET /types/available is not shadowed by /:id', async () => {
  const { app } = buildApp({
    getAvailableSourceTypes: async () => ({
      REQUIREMENT: { key: 'REQUIREMENT', name: '需求池', description: 'From config' },
      TICKET: { key: 'TICKET', name: '工单系统', description: 'From config' },
    }),
  });

  await app.ready();
  const response = await app.inject({ method: 'GET', url: '/types/available' });
  const payload = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(payload.success, true);
  assert.deepEqual(Object.keys(payload.data).sort(), ['REQUIREMENT', 'TICKET']);
});

test('GET /:id returns task source by string id', async () => {
  const source = { id: 'ticket-platform', type: 'TICKET', config: {} };
  const { app } = buildApp({
    getById: async (id) => (id === 'ticket-platform' ? source : null),
  });

  await app.ready();
  const response = await app.inject({ method: 'GET', url: '/ticket-platform' });
  const payload = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(payload.success, true);
  assert.deepEqual(payload.data, source);
});

test('write routes return 405 in read-only mode', async () => {
  const { app } = buildApp();

  await app.ready();

  for (const request of [
    { method: 'POST', url: '/', payload: { id: 'new-source' } },
    { method: 'PUT', url: '/requirement-orders', payload: { name: 'Updated' } },
    { method: 'DELETE', url: '/requirement-orders' },
  ]) {
    const response = await app.inject(request);
    const payload = response.json();

    assert.equal(response.statusCode, 405);
    assert.equal(payload.success, false);
    assert.equal(payload.message, READ_ONLY_ERROR_MESSAGE);
  }
});

test('runtime task-source routes return 405 after removal', async () => {
  const { app } = buildApp();

  await app.ready();

  for (const request of [
    { method: 'GET', url: '/requirement-orders/test' },
    { method: 'GET', url: '/requirement-orders/preview' },
    { method: 'POST', url: '/requirement-orders/sync' },
    {
      method: 'POST',
      url: '/requirement-orders/sync/preview',
    },
    {
      method: 'POST',
      url: '/requirement-orders/sync/import',
      payload: {
        items: [{ external_id: '1', title: 'Issue 1' }],
        project_id: 1,
      },
    },
  ]) {
    const response = await app.inject(request);
    const payload = response.json();

    assert.equal(response.statusCode, 405);
    assert.equal(payload.success, false);
  }
});
