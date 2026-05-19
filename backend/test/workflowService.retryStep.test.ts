import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import { WorkflowService } from '../src/services/workflow/workflowService.js';
import type { WorkflowRunEntity, WorkflowStepEntity } from '../src/types/entities.js';

function buildStep(stepId: string, status: string): WorkflowStepEntity {
  return {
    step_id: stepId,
    name: `Step ${stepId}`,
    status,
    started_at: '2026-05-10T00:00:00.000Z',
    completed_at: '2026-05-10T00:10:00.000Z',
    retry_count: 0,
    session_id: null,
    summary: `summary for ${stepId}`,
    error: null,
    provider_session_id: `prov-${stepId}`,
    assembled_prompt: `prompt for ${stepId}`,
    inherited_from_run_id: null,
  };
}

function buildRun(steps: WorkflowStepEntity[], overrides: Partial<WorkflowRunEntity> = {}): WorkflowRunEntity {
  return {
    id: 42,
    task_id: 7,
    workflow_instance_id: 'instance-xyz',
    mastra_run_id: 'mastra-abc',
    status: 'COMPLETED',
    current_step: null,
    steps,
    worktree_path: '/tmp/wt',
    branch: 'task/7',
    context: {},
    created_at: '2026-05-10T00:00:00.000Z',
    updated_at: '2026-05-10T00:10:00.000Z',
    parent_run_id: null,
    iteration: 0,
    looped_from_step_id: null,
    loop_failure_context: null,
    loop_trigger_error: null,
    ...overrides,
  };
}

test.test('retryStep resets target + downstream steps, flips run to RUNNING, and drives timeTravel', async () => {
  const steps = [
    buildStep('step-a', 'COMPLETED'),
    buildStep('step-split', 'COMPLETED'),
    buildStep('step-c', 'COMPLETED'),
  ];
  let run = buildRun(steps);

  const stepUpdates: Array<{ stepId: string; update: Record<string, unknown> }> = [];
  const runUpdates: Array<Record<string, unknown>> = [];
  let timeTravelCalled = false;
  let timeTravelStepArg: string | undefined;

  const service = new WorkflowService({
    workflowRunRepo: {
      async findById(id: number) {
        assert.equal(id, 42);
        return run;
      },
      async update(id: number, update: Record<string, unknown>) {
        assert.equal(id, 42);
        runUpdates.push(update);
        run = { ...run, ...update } as WorkflowRunEntity;
        return run;
      },
      async updateStep(id: number, stepId: string, update: Record<string, unknown>) {
        assert.equal(id, 42);
        stepUpdates.push({ stepId, update });
        const idx = run.steps.findIndex((s) => s.step_id === stepId);
        if (idx >= 0) {
          run.steps[idx] = { ...run.steps[idx], ...update } as WorkflowStepEntity;
        }
        return run;
      },
    } as never,
    taskRepo: {
      async findById(taskId: number) {
        assert.equal(taskId, 7);
        return { id: 7, project_id: 3, title: 'T', description: 'D', worktree_path: '/tmp/wt' };
      },
    } as never,
    projectRepo: {
      async findById(projectId: number) {
        assert.equal(projectId, 3);
        return { id: 3, env: { FOO: 'bar' } };
      },
    } as never,
    instanceService: {
      async getByInstanceId() {
        return null;
      },
    } as never,
    agentRepo: {} as never,
    lifecycle: {
      async onWorkflowStart() {},
      async onWorkflowError() {},
    } as never,
  });

  // Stub the private Mastra-bound helper so we don't need a real Mastra runtime.
  (service as any).getMastraRunContext = async (_runId: number) => ({
    run,
    task: { id: 7, project_id: 3, title: 'T', description: 'D' },
    executionPath: '/tmp/wt',
    workflow: null,
    mastraRun: {
      timeTravelStream: (args: { step: string }) => {
        timeTravelCalled = true;
        timeTravelStepArg = args.step;
        return { result: Promise.resolve({ status: 'success', result: { summary: 'ok' } }) };
      },
    },
  });

  await service.retryStep(42, 'step-split');

  // Step-split reset assertions
  const splitUpdate = stepUpdates.find((u) => u.stepId === 'step-split');
  assert.ok(splitUpdate, 'expected step-split to be updated');
  assert.equal(splitUpdate!.update.status, 'PENDING');
  assert.equal(splitUpdate!.update.started_at, null);
  assert.equal(splitUpdate!.update.completed_at, null);
  assert.equal(splitUpdate!.update.error, null);
  assert.equal(splitUpdate!.update.summary, null);
  assert.equal(splitUpdate!.update.provider_session_id, null);
  assert.equal(splitUpdate!.update.assembled_prompt, null);

  // Downstream step-c should also be reset
  const cUpdate = stepUpdates.find((u) => u.stepId === 'step-c');
  assert.ok(cUpdate, 'expected step-c (downstream) to be reset');
  assert.equal(cUpdate!.update.status, 'PENDING');
  assert.equal(cUpdate!.update.summary, null);

  // Upstream step-a must NOT be touched
  const aUpdate = stepUpdates.find((u) => u.stepId === 'step-a');
  assert.equal(aUpdate, undefined, 'step-a (upstream) should not be reset');

  // Run-level update flips to RUNNING with current_step = target
  const runningUpdate = runUpdates.find((u) => u.status === 'RUNNING');
  assert.ok(runningUpdate, 'run should be flipped to RUNNING');
  assert.equal(runningUpdate!.current_step, 'step-split');

  // Wait a tick for the fire-and-forget executeRetry to run.
  await new Promise((r) => setTimeout(r, 20));

  assert.equal(timeTravelCalled, true, 'timeTravelStream should be invoked');
  assert.equal(timeTravelStepArg, 'step-split', 'timeTravelStream should target the retried step');
});

test.test('retryStep rejects when run is already RUNNING', async () => {
  const steps = [buildStep('step-a', 'RUNNING')];
  const run = buildRun(steps, { status: 'RUNNING' });

  const service = new WorkflowService({
    workflowRunRepo: {
      async findById() { return run; },
    } as never,
    taskRepo: {} as never,
    projectRepo: {} as never,
    instanceService: {} as never,
    agentRepo: {} as never,
    lifecycle: {} as never,
  });

  await assert.rejects(
    () => service.retryStep(42, 'step-a'),
    (err: Error & { statusCode?: number }) => {
      assert.match(err.message, /running or pending/i);
      return true;
    },
  );
});

test.test('retryStep rejects unknown stepId', async () => {
  const run = buildRun([buildStep('step-a', 'COMPLETED')]);

  const service = new WorkflowService({
    workflowRunRepo: {
      async findById() { return run; },
    } as never,
    taskRepo: {} as never,
    projectRepo: {} as never,
    instanceService: {} as never,
    agentRepo: {} as never,
    lifecycle: {} as never,
  });

  await assert.rejects(
    () => service.retryStep(42, 'step-missing'),
    (err: Error) => {
      assert.match(err.message, /step not found/i);
      return true;
    },
  );
});

test.test('retryStep rejects when workflow run is missing', async () => {
  const service = new WorkflowService({
    workflowRunRepo: {
      async findById() { return null; },
    } as never,
    taskRepo: {} as never,
    projectRepo: {} as never,
    instanceService: {} as never,
    agentRepo: {} as never,
    lifecycle: {} as never,
  });

  await assert.rejects(
    () => service.retryStep(999, 'step-a'),
    (err: Error) => {
      assert.match(err.message, /workflow run not found/i);
      return true;
    },
  );
});

test.test('retryStep evicts cached Mastra Run before createRun to drop stale AbortController', async () => {
  const steps = [buildStep('step-a', 'COMPLETED'), buildStep('step-b', 'COMPLETED')];
  let run = buildRun(steps, { mastra_run_id: 'mastra-stale' });

  const deleted: string[] = [];
  const createRunCalls: Array<{ runId?: string }> = [];
  const fakeWorkflow = {
    runs: {
      delete: (id: string) => {
        deleted.push(id);
        return true;
      },
    },
    async createRun(opts: { runId?: string } = {}) {
      createRunCalls.push(opts);
      return {
        runId: opts.runId,
        timeTravelStream: () => ({ result: Promise.resolve({ status: 'success', result: { summary: 'ok' } }) }),
      };
    },
  };

  const service = new WorkflowService({
    workflowRunRepo: {
      async findById() { return run; },
      async update(_id: number, update: Record<string, unknown>) {
        run = { ...run, ...update } as WorkflowRunEntity;
        return run;
      },
      async updateStep(_id: number, stepId: string, update: Record<string, unknown>) {
        const idx = run.steps.findIndex((s) => s.step_id === stepId);
        if (idx >= 0) {
          run.steps[idx] = { ...run.steps[idx], ...update } as WorkflowStepEntity;
        }
        return run;
      },
    } as never,
    taskRepo: {
      async findById() {
        return { id: 7, project_id: 3, title: 'T', description: 'D', worktree_path: '/tmp/wt' };
      },
    } as never,
    projectRepo: {
      async findById() { return { id: 3, env: {} }; },
    } as never,
    instanceService: {} as never,
    agentRepo: {} as never,
    lifecycle: {
      async onWorkflowStart() {},
      async onWorkflowError() {},
    } as never,
  });

  // Stub the workflow lookup so getMastraRunContext runs its real eviction logic
  // against our fake Mastra workflow. The eviction must happen BEFORE createRun
  // so the new Run instance gets a fresh AbortController.
  (service as any).getOrRegisterWorkflowByInstanceId = async () => ({ workflow: fakeWorkflow });
  (service as any).resolveExecutionPath = async () => '/tmp/wt';

  await service.retryStep(42, 'step-b');
  await new Promise((r) => setTimeout(r, 20));

  assert.deepEqual(deleted, ['mastra-stale'], 'cached Run should be evicted from workflow.runs');
  assert.equal(createRunCalls.length, 1, 'createRun should be called once after eviction');
  assert.equal(createRunCalls[0]?.runId, 'mastra-stale', 'createRun should reuse the same mastraRunId');
});
