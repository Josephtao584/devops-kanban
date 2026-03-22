import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import Fastify from 'fastify';

import type { TaskSourceServiceContract } from '../../src/types/fastify.ts';
import type {
  ImportedTask,
  PreviewImportedTask,
  SourceRecord,
  SourceTypeDefinition,
  TaskSourceImportResult,
} from '../../src/types/sources.ts';
import { taskSourceRoutes } from '../../src/routes/taskSources.js';
import { READ_ONLY_ERROR_MESSAGE } from '../../src/services/taskSourceService.js';

type TaskSourceServiceStub = TaskSourceServiceContract;

function buildReadOnlyError() {
  const error = new Error(READ_ONLY_ERROR_MESSAGE) as Error & { statusCode?: number };
  error.statusCode = 405;
  return error;
}

function buildApp(serviceOverrides: Partial<TaskSourceServiceStub> = {}) {
  const app = Fastify();
  const service: TaskSourceServiceStub = {
    getByProject: async () => [],
    getById: async () => null,
    getAvailableSourceTypes: async () => ({
      REQUIREMENT: { key: 'REQUIREMENT', name: '需求池' },
    }),
    create: async () => { throw buildReadOnlyError(); },
    update: async () => { throw buildReadOnlyError(); },
    delete: async () => { throw buildReadOnlyError(); },
    sync: async () => [],
    previewSync: async () => [],
    importIssues: async () => ({ created: 0, skipped: 0, total: 0 }),
    testConnection: async () => true,
    ...serviceOverrides,
  };

  app.decorate('taskSourceService', service);
  app.register(taskSourceRoutes);
  return { app, service };
}

test.test('route module registers and returns project sources', async () => {
  const seenProjectIds: number[] = [];
  const { app } = buildApp({
    getByProject: async (projectId: number): Promise<SourceRecord[]> => {
      seenProjectIds.push(projectId);
      return [{ id: 'requirement-orders', project_id: projectId, type: 'REQUIREMENT', name: 'Orders', config: {} }];
    },
  });

  await app.ready();
  const response = await app.inject({ method: 'GET', url: '/?project_id=12' });
  const payload = response.json();

  assert.equal(response.statusCode, 200);
  assert.deepEqual(seenProjectIds, [12]);
  assert.equal(payload.success, true);
  assert.deepEqual(payload.data, [{ id: 'requirement-orders', project_id: 12, type: 'REQUIREMENT', name: 'Orders', config: {} }]);
});

test.test('GET /types/available is not shadowed by /:id', async () => {
  const { app } = buildApp({
    getAvailableSourceTypes: async (): Promise<Record<string, SourceTypeDefinition>> => ({
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

test.test('write routes return 405 in read-only mode', async () => {
  const { app } = buildApp();

  await app.ready();

  const requests: Array<{ method: 'POST' | 'PUT' | 'DELETE'; url: string; payload?: Record<string, unknown> }> = [
    { method: 'POST', url: '/', payload: { id: 'new-source' } },
    { method: 'PUT', url: '/requirement-orders', payload: { name: 'Updated' } },
    { method: 'DELETE', url: '/requirement-orders' },
  ];

  for (const request of requests) {
    const response = await app.inject(request);
    const payload = response.json();

    assert.equal(response.statusCode, 405);
    assert.equal(payload.success, false);
    assert.equal(payload.message, READ_ONLY_ERROR_MESSAGE);
  }
});
