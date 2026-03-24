import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import Fastify from 'fastify';

import { taskRoutes } from '../src/routes/tasks.js';
import { TaskService } from '../src/services/taskService.js';

type StartTaskRouteBody = {
  workflow_template_id?: string;
  workflow_template_snapshot?: {
    template_id: string;
    name: string;
    steps: Array<{
      id: string;
      name: string;
      instructionPrompt: string;
      agentId: number | null;
    }>;
  };
};

test.test('POST /:id/start forwards workflow_template_id from the request body', async () => {
  const originalStartTask = TaskService.prototype.startTask;
  const startTaskCalls: Array<{ taskId: number; body?: StartTaskRouteBody }> = [];

  TaskService.prototype.startTask = async function startTask(taskId: number, body?: StartTaskRouteBody) {
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

test.test('POST /:id/start forwards workflow_template_snapshot from the request body', async () => {
  const originalStartTask = TaskService.prototype.startTask;
  const startTaskCalls: Array<{ taskId: number; body?: StartTaskRouteBody }> = [];

  TaskService.prototype.startTask = async function startTask(taskId: number, body?: StartTaskRouteBody) {
    startTaskCalls.push({ taskId, body });
    return { id: taskId, status: 'IN_PROGRESS', workflow_run_id: 78 } as never;
  };

  const app = Fastify();
  app.register(taskRoutes);
  await app.ready();

  const workflowTemplateSnapshot = {
    template_id: 'edited-quick-fix-v2',
    name: 'Edited quick fix',
    steps: [
      {
        id: 'triage',
        name: 'Triage',
        instructionPrompt: 'Review the bug and scope the fix.',
        agentId: 11,
      },
      {
        id: 'ship',
        name: 'Ship',
        instructionPrompt: 'Implement the change and confirm the result.',
        agentId: 12,
      },
    ],
  };

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/9/start',
      payload: {
        workflow_template_id: 'quick-fix-v1',
        workflow_template_snapshot: workflowTemplateSnapshot,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(startTaskCalls, [{
      taskId: 9,
      body: {
        workflow_template_id: 'quick-fix-v1',
        workflow_template_snapshot: workflowTemplateSnapshot,
      },
    }]);
    assert.equal(response.json().data.workflow_run_id, 78);
  } finally {
    TaskService.prototype.startTask = originalStartTask;
    await app.close();
  }
});
