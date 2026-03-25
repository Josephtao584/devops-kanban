import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import { WorkflowService } from '../src/services/workflow/workflowService.js';
import type { WorkflowTemplate } from '../src/services/workflow/workflowTemplateService.ts';

function buildTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    project_id: 3,
    title: 'Workflow task',
    description: 'Use edited workflow snapshot',
    worktree_branch: 'task/7',
    worktree_path: '/tmp/task-7',
    ...overrides,
  };
}

function buildTemplate(templateId: string, stepIds: string[], agentIds: number[] = [11, 12]): WorkflowTemplate {
  return {
    template_id: templateId,
    name: `Template ${templateId}`,
    steps: stepIds.map((stepId, index) => ({
      id: stepId,
      name: `Step ${index + 1}`,
      instructionPrompt: `Prompt ${index + 1}`,
      agentId: agentIds[index] ?? agentIds[agentIds.length - 1] ?? 11,
    })),
  };
}

test.test('startWorkflow prefers workflow_template_snapshot over stored template', async () => {
  const task = buildTask();
  const storedTemplate = buildTemplate('stored-template', ['stored-a', 'stored-b']);
  const snapshotTemplate = buildTemplate('snapshot-template', ['snapshot-a', 'snapshot-b']);
  const createdRuns: Array<Record<string, unknown>> = [];
  const templateLookupCalls: string[] = [];
  const taskUpdates: Array<Record<string, unknown>> = [];
  const executeCalls: Array<{ runId: number; task: Record<string, unknown>; templateSnapshot: WorkflowTemplate }> = [];

  const service = new WorkflowService({
    taskRepo: {
      async findById(taskId: number) {
        assert.equal(taskId, 7);
        return task;
      },
      async update(taskId: number, updateData: Record<string, unknown>) {
        assert.equal(taskId, 7);
        taskUpdates.push(updateData);
        return { ...task, ...updateData };
      },
    } as never,
    workflowRunRepo: {
      async findLatestByTaskId(taskId: number) {
        assert.equal(taskId, 7);
        return null;
      },
      async create(payload: Record<string, unknown>) {
        createdRuns.push(payload);
        return { id: 91, ...payload };
      },
    } as never,
    workflowTemplateService: {
      async getTemplateById(templateId: string) {
        templateLookupCalls.push(templateId);
        return storedTemplate;
      },
    } as never,
    agentRepo: {
      async findById(agentId: number) {
        return { id: agentId, enabled: true, executorType: 'CLAUDE_CODE' };
      },
    } as never,
  });

  service._executeWorkflow = (async (runId: number, runTask: Record<string, unknown>, templateSnapshot: WorkflowTemplate) => {
    executeCalls.push({ runId, task: runTask, templateSnapshot });
  }) as never;

  await service.startWorkflow(7, {
    workflowTemplateId: 'stored-template',
    workflowTemplateSnapshot: snapshotTemplate,
  });

  assert.deepEqual(templateLookupCalls, []);
  assert.equal(createdRuns.length, 1);
  const createdRun = createdRuns[0];
  assert.ok(createdRun);
  assert.equal(createdRun.workflow_id, 'snapshot-template');
  assert.equal(createdRun.workflow_template_id, 'stored-template');
  assert.deepEqual(createdRun.workflow_template_snapshot, snapshotTemplate);
  assert.deepEqual(
    (createdRun.steps as Array<{ step_id: string }>).map((step) => step.step_id),
    ['snapshot-a', 'snapshot-b'],
  );
  assert.deepEqual(taskUpdates, [{ workflow_run_id: 91 }]);
  assert.equal(executeCalls.length, 1);
  const executeCall = executeCalls[0];
  assert.ok(executeCall);
  assert.deepEqual(executeCall.templateSnapshot, snapshotTemplate);
});

test.test('startWorkflow falls back to stored template when snapshot is absent', async () => {
  const task = buildTask({ id: 8, worktree_path: '/tmp/task-8', worktree_branch: 'task/8' });
  const storedTemplate = buildTemplate('stored-template', ['stored-a', 'stored-b']);
  const templateLookupCalls: string[] = [];
  const createdRuns: Array<Record<string, unknown>> = [];
  const executeCalls: Array<WorkflowTemplate> = [];

  const service = new WorkflowService({
    taskRepo: {
      async findById(taskId: number) {
        assert.equal(taskId, 8);
        return task;
      },
      async update() {
        return { ...task, workflow_run_id: 92 };
      },
    } as never,
    workflowRunRepo: {
      async findLatestByTaskId() {
        return null;
      },
      async create(payload: Record<string, unknown>) {
        createdRuns.push(payload);
        return { id: 92, ...payload };
      },
    } as never,
    workflowTemplateService: {
      async getTemplateById(templateId: string) {
        templateLookupCalls.push(templateId);
        return storedTemplate;
      },
    } as never,
    agentRepo: {
      async findById(agentId: number) {
        return { id: agentId, enabled: true, executorType: 'CLAUDE_CODE' };
      },
    } as never,
  });

  service._executeWorkflow = (async (_runId: number, _runTask: Record<string, unknown>, templateSnapshot: WorkflowTemplate) => {
    executeCalls.push(templateSnapshot);
  }) as never;

  await service.startWorkflow(8, {
    workflowTemplateId: 'stored-template',
  });

  assert.deepEqual(templateLookupCalls, ['stored-template']);
  assert.equal(createdRuns.length, 1);
  const createdRun = createdRuns[0];
  assert.ok(createdRun);
  assert.equal(createdRun.workflow_id, 'stored-template');
  assert.deepEqual(createdRun.workflow_template_snapshot, storedTemplate);
  assert.deepEqual(executeCalls, [storedTemplate]);
});

test.test('startWorkflow rejects requests without template id or snapshot', async () => {
  const service = new WorkflowService({
    taskRepo: {
      async findById() {
        return buildTask();
      },
    } as never,
    workflowRunRepo: {
      async findLatestByTaskId() {
        return null;
      },
    } as never,
  });

  await assert.rejects(
    () => service.startWorkflow(7, {}),
    (error: Error & { statusCode?: number }) => {
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /workflow template/i);
      return true;
    },
  );
});

test.test('startWorkflow validates agents from workflow_template_snapshot', async () => {
  const snapshotTemplate = buildTemplate('snapshot-template', ['snapshot-a', 'snapshot-b'], [11, 12]);
  const invalidStep = snapshotTemplate.steps[1];
  assert.ok(invalidStep);
  invalidStep.agentId = 404;

  const service = new WorkflowService({
    taskRepo: {
      async findById() {
        return buildTask();
      },
    } as never,
    workflowRunRepo: {
      async findLatestByTaskId() {
        return null;
      },
      async create() {
        assert.fail('workflow run should not be created when validation fails');
      },
    } as never,
    workflowTemplateService: {
      async getTemplateById() {
        assert.fail('stored template should not be loaded when snapshot is supplied');
      },
    } as never,
    agentRepo: {
      async findById(agentId: number) {
        if (agentId === 11) {
          return { id: agentId, enabled: true, executorType: 'CLAUDE_CODE' };
        }
        return null;
      },
    } as never,
  });

  await assert.rejects(
    () => service.startWorkflow(7, { workflowTemplateSnapshot: snapshotTemplate }),
    (error: Error & { statusCode?: number }) => {
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /references agent 404/);
      return true;
    },
  );
});
