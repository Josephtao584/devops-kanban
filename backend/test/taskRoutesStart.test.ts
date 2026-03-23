import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import Fastify from 'fastify';

import { taskRoutes } from '../src/routes/tasks.js';
import { TaskService } from '../src/services/taskService.js';

test.test('POST /:id/start forwards workflow_template_id from the request body', async () => {
  const originalStartTask = TaskService.prototype.startTask;
  const startTaskCalls: Array<{ taskId: number; body?: { workflow_template_id?: string } }> = [];

  TaskService.prototype.startTask = async function startTask(taskId: number, body?: { workflow_template_id?: string }) {
    startTaskCalls.push({ taskId, body });
    return { id: taskId, status: 'IN_PROGRESS', workflow_run_id: 77 } as never;
  };

  const app = Fastify();
  app.register(taskRoutes);
  await app.ready();

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/7/start',
      payload: { workflow_template_id: 'quick-fix-v1' },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(startTaskCalls, [{
      taskId: 7,
      body: { workflow_template_id: 'quick-fix-v1' },
    }]);
    assert.equal(response.json().data.workflow_run_id, 77);
  } finally {
    TaskService.prototype.startTask = originalStartTask;
    await app.close();
  }
});
