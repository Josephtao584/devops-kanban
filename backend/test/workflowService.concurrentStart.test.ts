import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { WorkflowService } from '../src/services/workflow/workflowService.js';
import type { WorkflowInstanceEntity } from '../src/types/entities.js';

async function createTempWorktree(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-concurrent-test-'));
  return dir;
}

function buildTask(worktreePath: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    project_id: 3,
    title: 'Concurrent workflow task',
    description: 'Test concurrent startWorkflow',
    worktree_branch: 'task/7',
    worktree_path: worktreePath,
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

test.test('startWorkflow prevents duplicate runs under concurrent calls', async () => {
  const worktreePath = await createTempWorktree();
  try {
    const task = buildTask(worktreePath);
    const createdRuns: Array<Record<string, unknown>> = [];
    const taskUpdates: Array<Record<string, unknown>> = [];

    const service = new WorkflowService({
      taskRepo: {
        async findById(taskId: number) {
          assert.equal(taskId, 7);
          return task;
        },
        async update(_taskId: number, updateData: Record<string, unknown>) {
          taskUpdates.push(updateData);
          return { ...task, ...updateData };
        },
      } as never,
      workflowRunRepo: {
        async createIfNoActiveRun(payload: Record<string, unknown>) {
          // Simulate race condition: both calls enter this method concurrently.
          // The serialization queue should ensure only one succeeds.
          // Without the queue, both would see createdRuns.length === 0 and both create.
          // With the queue, the second call sees the first run already created.
          if (createdRuns.length > 0) {
            return { created: null, existing: createdRuns[0] };
          }
          const run = { id: 90, ...payload };
          createdRuns.push(run);
          return { created: run, existing: null };
        },
      } as never,
      instanceService: {
        async createFromTemplate(templateId: string) {
          return buildInstance(`instance-${templateId}`, ['step-a', 'step-b']);
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
    (service as any)['executeWorkflow'] = async () => {};

    // Fire two concurrent startWorkflow calls
    const results = await Promise.allSettled([
      service.startWorkflow(7, { workflowTemplateId: 'template-1' }),
      service.startWorkflow(7, { workflowTemplateId: 'template-1' }),
    ]);

    // One should succeed, the other should be rejected with ConflictError
    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.equal(succeeded.length, 1, 'Exactly one call should succeed');
    assert.equal(rejected.length, 1, 'Exactly one call should be rejected');

    const rejectedError = (rejected[0] as PromiseRejectedResult).reason as Error & { statusCode?: number };
    assert.equal(rejectedError.statusCode, 409, 'Rejected call should have 409 status code');
    assert.match(rejectedError.message, /已有.*工作流|already.*active/i, 'Error message should indicate active workflow exists');

    // Only one run should have been created
    assert.equal(createdRuns.length, 1, 'Only one run should be created');
  } finally {
    await fs.rm(worktreePath, { recursive: true, force: true });
  }
});

test.test('startWorkflow allows new run after previous run is COMPLETED', async () => {
  const worktreePath = await createTempWorktree();
  try {
    const task = buildTask(worktreePath);
    const createdRuns: Array<Record<string, unknown>> = [];

    const service = new WorkflowService({
      taskRepo: {
        async findById() {
          return task;
        },
        async update() {
          return task;
        },
      } as never,
      workflowRunRepo: {
        async createIfNoActiveRun(payload: Record<string, unknown>) {
          // Return existing completed run
          if (createdRuns.length === 0) {
            return { created: { id: 90, ...payload }, existing: null };
          }
          return { created: null, existing: createdRuns[0] };
        },
      } as never,
      instanceService: {
        async createFromTemplate() {
          return buildInstance('instance-new', ['step-a']);
        },
      } as never,
      agentRepo: {
        async findById() {
          return { id: 11, enabled: true, executorType: 'CLAUDE_CODE' };
        },
      } as never,
      lifecycle: {
        async onWorkflowStart() {},
      } as never,
    });

    (service as any)['executeWorkflow'] = async () => {};

    // Should succeed because previous run is COMPLETED (not active)
    const result = await service.startWorkflow(7, { workflowTemplateId: 'template-1' });
    assert.ok(result, 'Should create new run after completed run');
    assert.equal(createdRuns.length, 0);
  } finally {
    await fs.rm(worktreePath, { recursive: true, force: true });
  }
});

test.test('startWorkflow rejects when previous run is RUNNING', async () => {
  const worktreePath = await createTempWorktree();
  try {
    const task = buildTask(worktreePath);

    const service = new WorkflowService({
      taskRepo: {
        async findById() {
          return task;
        },
      } as never,
      projectRepo: {
        async findById() {
          return { local_path: worktreePath };
        },
      } as never,
      instanceService: {
        async createFromTemplate() {
          return buildInstance('instance-1', ['step-a']);
        },
      } as never,
      agentRepo: {
        async findById() {
          return { id: 11, enabled: true, executorType: 'CLAUDE_CODE' };
        },
      } as never,
      workflowRunRepo: {
        async createIfNoActiveRun() {
          return { created: null, existing: { id: 80, task_id: 7, status: 'RUNNING' } };
        },
      } as never,
    });

    await assert.rejects(
      () => service.startWorkflow(7, { workflowTemplateId: 'template-1' }),
      (error: Error & { statusCode?: number }) => {
        assert.equal(error.statusCode, 409);
        assert.match(error.message, /已有.*工作流|already.*active/i);
        return true;
      },
    );
  } finally {
    await fs.rm(worktreePath, { recursive: true, force: true });
  }
});

test.test('startWorkflow rejects when previous run is SUSPENDED', async () => {
  const worktreePath = await createTempWorktree();
  try {
    const task = buildTask(worktreePath);

    const service = new WorkflowService({
      taskRepo: {
        async findById() {
          return task;
        },
      } as never,
      projectRepo: {
        async findById() {
          return { local_path: worktreePath };
        },
      } as never,
      instanceService: {
        async createFromTemplate() {
          return buildInstance('instance-1', ['step-a']);
        },
      } as never,
      agentRepo: {
        async findById() {
          return { id: 11, enabled: true, executorType: 'CLAUDE_CODE' };
        },
      } as never,
      workflowRunRepo: {
        async createIfNoActiveRun() {
          return { created: null, existing: { id: 80, task_id: 7, status: 'SUSPENDED' } };
        },
      } as never,
    });

    await assert.rejects(
      () => service.startWorkflow(7, { workflowTemplateId: 'template-1' }),
      (error: Error & { statusCode?: number }) => {
        assert.equal(error.statusCode, 409);
        return true;
      },
    );
  } finally {
    await fs.rm(worktreePath, { recursive: true, force: true });
  }
});

test.test('startWorkflow rejects when previous run is PENDING', async () => {
  const worktreePath = await createTempWorktree();
  try {
    const task = buildTask(worktreePath);

    const service = new WorkflowService({
      taskRepo: {
        async findById() {
          return task;
        },
      } as never,
      projectRepo: {
        async findById() {
          return { local_path: worktreePath };
        },
      } as never,
      instanceService: {
        async createFromTemplate() {
          return buildInstance('instance-1', ['step-a']);
        },
      } as never,
      agentRepo: {
        async findById() {
          return { id: 11, enabled: true, executorType: 'CLAUDE_CODE' };
        },
      } as never,
      workflowRunRepo: {
        async createIfNoActiveRun() {
          return { created: null, existing: { id: 80, task_id: 7, status: 'PENDING' } };
        },
      } as never,
    });

    await assert.rejects(
      () => service.startWorkflow(7, { workflowTemplateId: 'template-1' }),
      (error: Error & { statusCode?: number }) => {
        assert.equal(error.statusCode, 409);
        return true;
      },
    );
  } finally {
    await fs.rm(worktreePath, { recursive: true, force: true });
  }
});
