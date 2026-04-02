import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import { WorkflowService } from '../src/services/workflow/workflowService.js';
import type { WorkflowInstanceEntity } from '../src/types/entities.js';

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

function buildInstance(instanceId: string, stepIds: string[], agentIds: number[] = [11, 12]): WorkflowInstanceEntity {
  return {
    id: 1,
    instance_id: instanceId,
    template_id: 'template-1',
    template_version: '2026-03-22T00:00:00.000Z',
    name: `Instance ${instanceId}`,
    steps: stepIds.map((stepId, index) => ({
      id: stepId,
      name: `Step ${index + 1}`,
      instructionPrompt: `Prompt ${index + 1}`,
      agentId: agentIds[index] ?? agentIds[agentIds.length - 1] ?? 11,
    })),
    created_at: '2026-03-22T00:00:00.000Z',
    updated_at: '2026-03-22T00:00:00.000Z',
  };
}

test.test('startWorkflow creates workflow instance from template', async () => {
  const task = buildTask();
  const createdRuns: Array<Record<string, unknown>> = [];
  const createdInstances: Array<Record<string, unknown>> = [];
  const taskUpdates: Array<Record<string, unknown>> = [];

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
    instanceService: {
      async createFromTemplate(templateId: string) {
        const instance = buildInstance(`instance-${templateId}`, ['step-a', 'step-b']);
        createdInstances.push({ templateId, instance });
        return instance;
      },
    } as never,
    agentRepo: {
      async findById(agentId: number) {
        return { id: agentId, enabled: true, executorType: 'CLAUDE_CODE' };
      },
    } as never,
    lifecycle: {
      async onWorkflowStart() {},
    } as never,
  });

  // Mock executeWorkflow to prevent actual execution
  const executeWorkflow = service['executeWorkflow'];
  (service as any)['executeWorkflow'] = async () => {};

  await service.startWorkflow(7, {
    workflowTemplateId: 'template-1',
  });

  (service as any)['executeWorkflow'] = executeWorkflow;

  assert.equal(createdInstances.length, 1);
  assert.equal(createdInstances[0]?.templateId, 'template-1');
  assert.equal(createdRuns.length, 1);
  const createdRun = createdRuns[0];
  assert.ok(createdRun);
  assert.ok(createdRun.workflow_instance_id);
  assert.deepEqual(taskUpdates, [{ workflow_run_id: 91 }]);
});

test.test('startWorkflow rejects requests without template id', async () => {
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
    // @ts-expect-error - testing invalid input
    () => service.startWorkflow(7, {}),
    (error: Error & { statusCode?: number }) => {
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /workflow template/i);
      return true;
    },
  );
});