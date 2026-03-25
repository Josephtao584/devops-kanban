import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import { TaskService } from '../src/services/taskService.js';

test.test('TaskService no longer exposes createWorkflowTestTask', () => {
  const service = new TaskService({
    taskRepo: {} as never,
    projectRepo: {} as never,
  });

  assert.equal(typeof (service as TaskService & { createWorkflowTestTask?: unknown }).createWorkflowTestTask, 'undefined');
});

test.test('TaskService.startTask forwards workflow_template_id to WorkflowService.startWorkflow', async () => {
  const taskRepo = {
    async findById(taskId: number) {
      return {
        id: taskId,
        status: 'TODO',
      };
    },
    async update() {
      return null;
    },
  };
  const startWorkflowCalls: Array<{ taskId: number; workflowTemplateId?: string }> = [];
  const workflowService = {
    async startWorkflow(taskId: number, workflowTemplateId?: string) {
      startWorkflowCalls.push(workflowTemplateId !== undefined ? { taskId, workflowTemplateId } : { taskId });
      return { id: 99, task_id: taskId };
    },
  };
  const service = new TaskService({
    taskRepo: taskRepo as never,
    projectRepo: {} as never,
    workflowService: workflowService as never,
  });

  await service.startTask(7, { workflow_template_id: 'quick-fix-v1' });

  assert.deepEqual(startWorkflowCalls, [{ taskId: 7, workflowTemplateId: 'quick-fix-v1' }]);
});

test.test('TaskService.startTask starts workflow without template id when body is omitted', async () => {
  const taskRepo = {
    async findById(taskId: number) {
      return {
        id: taskId,
        status: 'TODO',
      };
    },
    async update() {
      return null;
    },
  };
  const startWorkflowCalls: Array<{ taskId: number; workflowTemplateId?: string }> = [];
  const workflowService = {
    async startWorkflow(taskId: number, workflowTemplateId?: string) {
      startWorkflowCalls.push({ taskId, workflowTemplateId });
      return { id: 99, task_id: taskId };
    },
  };
  const service = new TaskService({
    taskRepo: taskRepo as never,
    projectRepo: {} as never,
    workflowService: workflowService as never,
  });

  await service.startTask(8);

  assert.deepEqual(startWorkflowCalls, [{ taskId: 8, workflowTemplateId: undefined }]);
});

test.test('TaskService.startTask allows IN_PROGRESS tasks to re-enter workflow startup', async () => {
  const taskRepo = {
    async findById(taskId: number) {
      return {
        id: taskId,
        status: 'IN_PROGRESS',
      };
    },
    async update() {
      return null;
    },
  };
  let startWorkflowCalled = false;
  const workflowService = {
    async startWorkflow() {
      startWorkflowCalled = true;
      return null;
    },
  };
  const service = new TaskService({
    taskRepo: taskRepo as never,
    projectRepo: {} as never,
    workflowService: workflowService as never,
  });

  await service.startTask(9, { workflow_template_id: 'quick-fix-v1' });
  assert.equal(startWorkflowCalled, true);
});

test.test('TaskService.startTask rejects missing tasks before starting a workflow', async () => {
  const taskRepo = {
    async findById() {
      return null;
    },
    async update() {
      return null;
    },
  };
  let startWorkflowCalled = false;
  const workflowService = {
    async startWorkflow() {
      startWorkflowCalled = true;
      return null;
    },
  };
  const service = new TaskService({
    taskRepo: taskRepo as never,
    projectRepo: {} as never,
    workflowService: workflowService as never,
  });

  await assert.rejects(() => service.startTask(10, { workflow_template_id: 'quick-fix-v1' }), /Task not found/);
  assert.equal(startWorkflowCalled, false);
});

test.test('TaskService.startTask does not leave the task in progress when workflow startup fails', async () => {
  const updates: Array<{ taskId: number; payload: Record<string, unknown> }> = [];
  const taskRepo = {
    async findById(taskId: number) {
      return {
        id: taskId,
        status: 'TODO',
      };
    },
    async update(taskId: number, payload: Record<string, unknown>) {
      updates.push({ taskId, payload });
      return { id: taskId, ...payload };
    },
  };
  const workflowService = {
    async startWorkflow() {
      throw new Error('workflow startup failed');
    },
  };
  const service = new TaskService({
    taskRepo: taskRepo as never,
    projectRepo: {} as never,
    workflowService: workflowService as never,
  });

  await assert.rejects(() => service.startTask(11, { workflow_template_id: 'review-only-v1' }), /workflow startup failed/);

  assert.deepEqual(updates, [
    { taskId: 11, payload: { status: 'IN_PROGRESS' } },
    { taskId: 11, payload: { status: 'TODO' } },
  ]);
});

test.test('TaskService constructor allows injecting a workflow service dependency', () => {
  const workflowService = { startWorkflow() { return Promise.resolve(null); } };
  const service = new TaskService({
    taskRepo: {} as never,
    projectRepo: {} as never,
    workflowService: workflowService as never,
  });

  assert.equal((service as TaskService & { workflowService: unknown }).workflowService, workflowService);
});

test.test('TaskService.startTask can pass a nullish workflow template body through optional input handling', async () => {
  const taskRepo = {
    async findById(taskId: number) {
      return {
        id: taskId,
        status: 'TODO',
      };
    },
    async update() {
      return null;
    },
  };
  const startWorkflowCalls: Array<{ taskId: number; workflowTemplateId?: string }> = [];
  const workflowService = {
    async startWorkflow(taskId: number, workflowTemplateId?: string) {
      startWorkflowCalls.push({ taskId, workflowTemplateId });
      return null;
    },
  };
  const service = new TaskService({
    taskRepo: taskRepo as never,
    projectRepo: {} as never,
    workflowService: workflowService as never,
  });

  await service.startTask(12, {});

  assert.deepEqual(startWorkflowCalls, [{ taskId: 12, workflowTemplateId: undefined }]);
});

test.test('TaskService.startTask returns the refreshed task record after workflow kickoff', async () => {
  const records = new Map<number, Array<Record<string, unknown> | null>>([
    [13, [
      { id: 13, status: 'TODO' },
      { id: 13, status: 'IN_PROGRESS', workflow_run_id: 55 },
    ]],
  ]);
  const taskRepo = {
    async findById(taskId: number) {
      const queue = records.get(taskId);
      return queue?.shift() ?? null;
    },
    async update() {
      return null;
    },
  };
  const workflowService = {
    async startWorkflow() {
      return { id: 55 };
    },
  };
  const service = new TaskService({
    taskRepo: taskRepo as never,
    projectRepo: {} as never,
    workflowService: workflowService as never,
  });

  const result = await service.startTask(13, { workflow_template_id: 'quick-fix-v1' });

  assert.deepEqual(result, { id: 13, status: 'IN_PROGRESS', workflow_run_id: 55 });
});

test.test('TaskService.startTask keeps template forwarding isolated from unrelated repo operations', async () => {
  let projectRepoTouched = false;
  const taskRepo = {
    async findById(taskId: number) {
      return {
        id: taskId,
        status: 'TODO',
      };
    },
    async update() {
      return null;
    },
  };
  const workflowService = {
    async startWorkflow() {
      return null;
    },
  };
  const service = new TaskService({
    taskRepo: taskRepo as never,
    projectRepo: new Proxy({}, {
      get() {
        projectRepoTouched = true;
        return undefined;
      },
    }) as never,
    workflowService: workflowService as never,
  });

  await service.startTask(14, { workflow_template_id: 'quick-fix-v1' });

  assert.equal(projectRepoTouched, false);
});

test.test('TaskService.startTask forwards selected template ids verbatim', async () => {
  const taskRepo = {
    async findById(taskId: number) {
      return {
        id: taskId,
        status: 'TODO',
      };
    },
    async update() {
      return null;
    },
  };
  const startWorkflowCalls: string[] = [];
  const workflowService = {
    async startWorkflow(_taskId: number, workflowTemplateId?: string) {
      startWorkflowCalls.push(String(workflowTemplateId));
      return null;
    },
  };
  const service = new TaskService({
    taskRepo: taskRepo as never,
    projectRepo: {} as never,
    workflowService: workflowService as never,
  });

  await service.startTask(15, { workflow_template_id: 'custom-template-v2' });

  assert.deepEqual(startWorkflowCalls, ['custom-template-v2']);
});

test.test('TaskService.startTask accepts the selection body shape expected by the task start route', async () => {
  const records = new Map<number, Array<Record<string, unknown> | null>>([
    [16, [
      { id: 16, status: 'TODO' },
      { id: 16, status: 'IN_PROGRESS', workflow_run_id: 101 },
    ]],
  ]);
  const taskRepo = {
    async findById(taskId: number) {
      const queue = records.get(taskId);
      return queue?.shift() ?? null;
    },
    async update() {
      return null;
    },
  };
  const workflowService = {
    async startWorkflow() {
      return null;
    },
  };
  const service = new TaskService({
    taskRepo: taskRepo as never,
    projectRepo: {} as never,
    workflowService: workflowService as never,
  });

  const result = await service.startTask(16, { workflow_template_id: 'review-only-v1' });

  assert.deepEqual(result, { id: 16, status: 'IN_PROGRESS', workflow_run_id: 101 });
});
