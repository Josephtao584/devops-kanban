import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { taskRoutes } from '../src/routes/tasks.js';
import { TaskService } from '../src/services/taskService.js';
import { BusinessError } from '../src/utils/errors.js';

test('PUT /:rootId/dependencies/batch forwards body and returns updated count', async () => {
  const original = TaskService.prototype.updateDependenciesBatch;
  const calls: any[] = [];
  TaskService.prototype.updateDependenciesBatch = async function (rootId: number, edges: any) {
    calls.push({ rootId, edges });
    return { updated: 3 };
  };

  const app = Fastify();
  app.register(taskRoutes);
  await app.ready();
  try {
    const res = await app.inject({
      method: 'PUT',
      url: '/5/dependencies/batch',
      payload: { edges: [{ from: 1, to: 2 }] },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().success, true);
    assert.equal(res.json().data.updated, 3);
    assert.deepEqual(calls, [{ rootId: 5, edges: [{ from: 1, to: 2 }] }]);
  } finally {
    TaskService.prototype.updateDependenciesBatch = original;
    await app.close();
  }
});

test('PUT /:rootId/dependencies/batch returns 400 when body lacks edges', async () => {
  const app = Fastify();
  app.register(taskRoutes);
  await app.ready();
  try {
    const res = await app.inject({
      method: 'PUT',
      url: '/5/dependencies/batch',
      payload: {},
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().success, false);
  } finally {
    await app.close();
  }
});

test('PUT /:rootId/dependencies/batch returns 400 with BusinessError message on cycle', async () => {
  const original = TaskService.prototype.updateDependenciesBatch;
  TaskService.prototype.updateDependenciesBatch = async function () {
    throw new BusinessError('依赖关系存在环路：1 → 2 → 1', 'cycle', { cycle: [1, 2, 1] });
  };

  const app = Fastify();
  app.register(taskRoutes);
  await app.ready();
  try {
    const res = await app.inject({
      method: 'PUT',
      url: '/5/dependencies/batch',
      payload: { edges: [{ from: 1, to: 2 }, { from: 2, to: 1 }] },
    });
    assert.equal(res.statusCode, 400);
    const body = res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /环路/);
  } finally {
    TaskService.prototype.updateDependenciesBatch = original;
    await app.close();
  }
});

test('PUT /:rootId/dependencies/batch returns 400 when edges length exceeds limit', async () => {
  const app = Fastify();
  app.register(taskRoutes);
  await app.ready();
  try {
    const tooMany = Array.from({ length: 1001 }, (_, i) => ({ from: 1, to: i + 2 }));
    const res = await app.inject({
      method: 'PUT',
      url: '/5/dependencies/batch',
      payload: { edges: tooMany },
    });
    assert.equal(res.statusCode, 400);
    assert.match(res.json().message, /<= 1000/);
  } finally {
    await app.close();
  }
});

test('PUT /:rootId/dependencies/batch returns 400 for non-integer or non-positive edge values', async () => {
  const app = Fastify();
  app.register(taskRoutes);
  await app.ready();
  try {
    for (const bad of [
      { from: 1.5, to: 2 },
      { from: 0, to: 2 },
      { from: -1, to: 2 },
      { from: 'x', to: 2 },
      { from: 1, to: null },
    ]) {
      const res = await app.inject({
        method: 'PUT',
        url: '/5/dependencies/batch',
        payload: { edges: [bad] },
      });
      assert.equal(res.statusCode, 400, `expected 400 for edge ${JSON.stringify(bad)}`);
    }
  } finally {
    await app.close();
  }
});
