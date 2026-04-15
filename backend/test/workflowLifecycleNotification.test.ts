import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { WorkflowLifecycle } from '../src/services/workflow/workflowLifecycle.js';

function createNotificationHarness() {
  const notifications: Array<{ type: string; runId: number; taskId: number; taskTitle: string }> = [];

  const run = {
    id: 7,
    task_id: 42,
    workflow_id: 'test-wf',
    workflow_template_id: 'test-wf',
    workflow_template_snapshot: { steps: [] },
    status: 'RUNNING',
    current_step: 'step-1',
    steps: [
      {
        step_id: 'step-1',
        name: 'Test Step',
        status: 'RUNNING',
        started_at: '2026-01-01T00:00:00.000Z',
        completed_at: null,
        retry_count: 0,
        session_id: null,
        summary: null,
        error: null,
      },
    ],
    worktree_path: '/tmp/workspace',
    branch: 'task/42',
    context: {},
  };

  const task = { id: 42, title: 'My Important Task' };

  const lifecycle = new WorkflowLifecycle({
    workflowRunRepo: {
      async findById() { return run; },
      async update(runId: number, data: Record<string, unknown>) {
        Object.assign(run, data);
        return run;
      },
      async updateStep(runId: number, stepId: string, data: Record<string, unknown>) {
        const step = run.steps.find((s) => s.step_id === stepId);
        if (step) Object.assign(step, data);
        return run;
      },
    } as never,
    taskRepo: {
      async findById(id: number) {
        return id === 42 ? task : null;
      },
      async update() {},
    } as never,
    agentRepo: { async findById() { return null; } } as never,
    instanceRepo: { async findByInstanceId() { return { steps: [] }; } } as never,
    sessionRepo: {
      async findById() { return null; },
      async create() { return { id: 1 }; },
      async update() { return {}; },
    } as never,
    sessionSegmentRepo: {
      async create() { return { id: 1 }; },
      async findLatestBySessionId() { return null; },
      async update() { return {}; },
    } as never,
    sessionEventRepo: { async append() {} } as never,
    onWorkflowNotification: (event) => { notifications.push(event); },
  });

  return { lifecycle, notifications, run };
}

test.test('onWorkflowComplete emits notification with task info', async () => {
  const { lifecycle, notifications } = createNotificationHarness();

  await lifecycle.onWorkflowComplete(7, { result: 'success' });

  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, 'COMPLETED');
  assert.equal(notifications[0].runId, 7);
  assert.equal(notifications[0].taskId, 42);
  assert.equal(notifications[0].taskTitle, 'My Important Task');
});

test.test('onWorkflowError emits notification with task info', async () => {
  const { lifecycle, notifications } = createNotificationHarness();

  await lifecycle.onWorkflowError(7, 'Something went wrong');

  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, 'FAILED');
  assert.equal(notifications[0].runId, 7);
  assert.equal(notifications[0].taskId, 42);
  assert.equal(notifications[0].taskTitle, 'My Important Task');
});

test.test('onStepSuspend emits notification with task info', async () => {
  const { lifecycle, notifications } = createNotificationHarness();

  await lifecycle.onStepSuspend(7, 'step-1', {
    reason: 'Waiting for confirmation',
    summary: 'Please confirm',
  });

  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, 'SUSPENDED');
  assert.equal(notifications[0].runId, 7);
  assert.equal(notifications[0].taskId, 42);
  assert.equal(notifications[0].taskTitle, 'My Important Task');
});

test.test('no notification emitted when callback not provided', async () => {
  // Verify no crash when onWorkflowNotification is not provided
  const lifecycle = new WorkflowLifecycle({
    workflowRunRepo: {
      async findById() {
        return {
          id: 7, task_id: 42, status: 'RUNNING', current_step: null,
          steps: [], worktree_path: null, context: {},
        };
      },
      async update() { return {}; },
      async updateStep() { return {}; },
    } as never,
    taskRepo: {
      async update() {},
    } as never,
    sessionRepo: { async findById() { return null; }, async update() { return {}; } } as never,
    sessionSegmentRepo: { async findLatestBySessionId() { return null; } } as never,
    agentRepo: { async findById() { return null; } } as never,
    instanceRepo: { async findByInstanceId() { return { steps: [] }; } } as never,
    sessionEventRepo: { async append() {} } as never,
  });

  // Should not throw
  await lifecycle.onWorkflowComplete(7, {});
  await lifecycle.onWorkflowError(7, 'error');
});
