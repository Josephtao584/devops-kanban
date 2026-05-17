import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { WorkflowLifecycle } from '../../src/services/workflow/workflowLifecycle.js';

interface HarnessOpts {
  step?: { onFailureLoopTo?: string | null };
  runStatus?: string;
  failExit?: boolean;
  iteration?: number;
  maxLoops?: number;
  inFlight?: boolean;
}

function setupHarness(opts: HarnessOpts = {}) {
  const calls: any[] = [];
  const updateStepCalls: any[] = [];
  const updateCalls: any[] = [];

  const baseRun = {
    id: 1,
    task_id: 1,
    workflow_instance_id: 'inst-1',
    status: opts.runStatus ?? 'RUNNING',
    iteration: opts.iteration ?? 1,
    worktree_path: '/tmp',
    current_step: 'step2',
    steps: [
      { step_id: 'step1', name: 'S1', status: 'COMPLETED', session_id: null },
      {
        step_id: 'step2',
        name: 'S2',
        status: 'FAILED',
        error: 'boom',
        summary: null,
        session_id: null,
        early_exit: opts.failExit ? true : null,
        early_exit_reason: opts.failExit ? 'FAIL_EXIT' : null,
      },
    ],
  };

  const workflowRunRepo: any = {
    findById: async () => baseRun,
    updateStep: async (...args: any[]) => {
      updateStepCalls.push(args);
      return null;
    },
    update: async (...args: any[]) => {
      updateCalls.push(args);
      return null;
    },
    findInFlightChild: async () => (opts.inFlight ? { id: 99 } : null),
  };

  const taskRepo: any = {
    findById: async () => ({ id: 1, project_id: 1, title: 'T', description: 'D' }),
    update: async () => null,
  };

  const sessionRepo: any = {
    findById: async () => null,
    update: async () => null,
  };

  const sessionSegmentRepo: any = {
    findLatestBySessionId: async () => null,
    update: async () => null,
  };

  const sessionEventRepo: any = {
    listBySessionId: async () => [],
    append: async () => null,
  };

  const instanceRepo: any = {
    findByInstanceId: async () => ({
      instance_id: 'inst-1',
      template_id: 't1',
      steps: [
        { id: 'step1', name: 'S1', agentId: 1, instructionPrompt: 'p' },
        {
          id: 'step2',
          name: 'S2',
          agentId: 1,
          instructionPrompt: 'p',
          onFailureLoopTo: opts.step?.onFailureLoopTo ?? null,
        },
      ],
    }),
  };

  const lifecycle = new WorkflowLifecycle({
    workflowRunRepo,
    taskRepo,
    sessionRepo,
    sessionSegmentRepo,
    sessionEventRepo,
    instanceRepo,
  });

  const templateService: any = {
    getTemplateById: async () => ({ maxLoops: opts.maxLoops ?? 2 }),
  };

  const workflowService: any = {
    templateService,
    createLoopRun: async (...args: any[]) => {
      calls.push(args);
      return { id: 2 };
    },
  };

  lifecycle.setWorkflowService(workflowService);

  return { lifecycle, calls, updateStepCalls, updateCalls };
}

test.test('onStepError triggers createLoopRun when step has onFailureLoopTo', async () => {
  const { lifecycle, calls } = setupHarness({ step: { onFailureLoopTo: 'step1' } });
  await lifecycle.onStepError(1, 'step2', 'boom');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], 'step1'); // fromStepId
});

test.test('does not trigger when step has no onFailureLoopTo', async () => {
  const { lifecycle, calls } = setupHarness({ step: { onFailureLoopTo: null } });
  await lifecycle.onStepError(1, 'step2', 'boom');
  assert.equal(calls.length, 0);
});

test.test('does not trigger when run is CANCELLED', async () => {
  const { lifecycle, calls } = setupHarness({
    step: { onFailureLoopTo: 'step1' },
    runStatus: 'CANCELLED',
  });
  await lifecycle.onStepError(1, 'step2', 'boom');
  assert.equal(calls.length, 0);
});

test.test('does not trigger on FAIL_EXIT', async () => {
  const { lifecycle, calls } = setupHarness({
    step: { onFailureLoopTo: 'step1' },
    failExit: true,
  });
  await lifecycle.onStepError(1, 'step2', 'boom');
  assert.equal(calls.length, 0);
});

test.test('does not trigger when iteration would exceed maxLoops', async () => {
  const { lifecycle, calls } = setupHarness({
    step: { onFailureLoopTo: 'step1' },
    iteration: 3,
    maxLoops: 2,
  });
  await lifecycle.onStepError(1, 'step2', 'boom');
  assert.equal(calls.length, 0);
});

test.test('does not trigger when an in-flight child already exists', async () => {
  const { lifecycle, calls } = setupHarness({
    step: { onFailureLoopTo: 'step1' },
    inFlight: true,
  });
  await lifecycle.onStepError(1, 'step2', 'boom');
  assert.equal(calls.length, 0);
});

test.test('persists loop_trigger_error when createLoopRun throws', async () => {
  const { lifecycle, updateCalls } = setupHarness({
    step: { onFailureLoopTo: 'step1' },
  });
  // Override createLoopRun to throw a known error.
  (lifecycle as any).workflowService.createLoopRun = async () => {
    throw new Error('template missing');
  };

  await lifecycle.onStepError(1, 'step2', 'boom');

  // Find the update call that recorded the loop_trigger_error.
  const triggerErrorCall = updateCalls.find(
    (args) => args[1] && Object.prototype.hasOwnProperty.call(args[1], 'loop_trigger_error'),
  );
  assert.ok(triggerErrorCall, 'expected workflowRunRepo.update to be called with loop_trigger_error');
  assert.equal(triggerErrorCall[0], 1);
  assert.equal(triggerErrorCall[1].loop_trigger_error, 'template missing');
});

test.test('persists loop_trigger_error with String coercion when non-Error thrown', async () => {
  const { lifecycle, updateCalls } = setupHarness({
    step: { onFailureLoopTo: 'step1' },
  });
  (lifecycle as any).workflowService.createLoopRun = async () => {
    throw 'string-error';
  };

  await lifecycle.onStepError(1, 'step2', 'boom');

  const triggerErrorCall = updateCalls.find(
    (args) => args[1] && Object.prototype.hasOwnProperty.call(args[1], 'loop_trigger_error'),
  );
  assert.ok(triggerErrorCall, 'expected loop_trigger_error update');
  assert.equal(triggerErrorCall[1].loop_trigger_error, 'string-error');
});
