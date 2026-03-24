import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { WorkflowService } from '../src/services/workflow/workflowService.js';
import type { ExecutorProcessHandle } from '../src/types/executors.js';
import type { WorkflowTemplate } from '../src/services/workflow/workflowTemplateService.js';

interface AgentRecord {
  id: number;
  name: string;
  executorType: string;
  role: string;
  enabled: boolean;
  skills: string[];
  commandOverride?: string | null;
  args: unknown;
  env: unknown;
}

function buildQuickFixTemplate(): WorkflowTemplate {
  return {
    template_id: 'quick-fix-v1',
    name: '快速修复工作流',
    steps: [
      {
        id: 'triage',
        name: '问题定位',
        instructionPrompt: '先确认问题范围、触发条件和修复策略。',
        agentId: 11,
      },
      {
        id: 'fix',
        name: '实施修复',
        instructionPrompt: '根据定位结果完成最小改动修复。',
        agentId: 12,
      },
      {
        id: 'verify',
        name: '回归验证',
        instructionPrompt: '验证修复结果并确认没有引入明显回归。',
        agentId: 13,
      },
    ],
  };
}

function buildReviewOnlyTemplate(): WorkflowTemplate {
  return {
    template_id: 'review-only-v1',
    name: '审查工作流',
    steps: [
      {
        id: 'review',
        name: '代码审查',
        instructionPrompt: '审查现有改动并记录风险。',
        agentId: 21,
      },
      {
        id: 'report',
        name: '输出结论',
        instructionPrompt: '汇总结论并给出建议。',
        agentId: 22,
      },
    ],
  };
}

function buildAgent(id: number, overrides: Partial<AgentRecord> = {}): AgentRecord {
  return {
    id,
    name: `Agent ${id}`,
    executorType: 'CLAUDE_CODE',
    role: 'IMPLEMENTER',
    enabled: true,
    skills: [],
    commandOverride: null,
    args: [],
    env: {},
    ...overrides,
  };
}

function buildValidAgents() {
  return new Map<number, AgentRecord>([
    [11, buildAgent(11, { executorType: 'CLAUDE_CODE' })],
    [12, buildAgent(12, { executorType: 'CLAUDE_CODE' })],
    [13, buildAgent(13, { executorType: 'CLAUDE_CODE' })],
    [21, buildAgent(21, { executorType: 'CLAUDE_CODE' })],
    [22, buildAgent(22, { executorType: 'CLAUDE_CODE' })],
  ]);
}

function buildAgentsWithUnavailableDefaultExecutors() {
  return new Map<number, AgentRecord>([
    [11, buildAgent(11, { executorType: 'CLAUDE_CODE' })],
    [12, buildAgent(12, { executorType: 'CODEX' })],
    [13, buildAgent(13, { executorType: 'OPENCODE' })],
    [21, buildAgent(21, { executorType: 'CLAUDE_CODE' })],
    [22, buildAgent(22, { executorType: 'CODEX' })],
  ]);
}

function assertValidationError(error: unknown, expectedMessage: RegExp) {
  assert.match((error as Error).message, expectedMessage);
  assert.equal((error as Error & { statusCode?: number }).statusCode, 400);
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function createStartWorkflowHarness({
  templates = [buildQuickFixTemplate(), buildReviewOnlyTemplate()],
  selectedTemplateId = 'quick-fix-v1',
  agentRecords = buildValidAgents(),
  existingRun = null,
}: {
  templates?: WorkflowTemplate[];
  selectedTemplateId?: string;
  agentRecords?: Map<number, AgentRecord>;
  existingRun?: { status: string } | null;
} = {}) {
  const createCalls: Array<Record<string, unknown>> = [];
  const updateCalls: Array<Record<string, unknown>> = [];
  const stepUpdates: Array<{ runId: number; stepId: string; updateData: Record<string, unknown> }> = [];
  const taskUpdates: Array<Record<string, unknown>> = [];
  const agentLookupIds: number[] = [];
  let templateListLoads = 0;
  let templateLookupLoads = 0;

  const workflowRunRepo = {
    async findByTaskId(taskId: number) {
      assert.equal(taskId, 1);
      return existingRun;
    },
    async findById(runId: number) {
      return { id: runId, status: 'RUNNING' };
    },
    async create(payload: Record<string, unknown>) {
      createCalls.push(payload);
      return { id: 42, ...payload };
    },
    async update(runId: number, updateData: Record<string, unknown>) {
      updateCalls.push({ runId, ...updateData });
      return { id: runId, ...updateData };
    },
    async updateStep(runId: number, stepId: string, updateData: Record<string, unknown>) {
      stepUpdates.push({ runId, stepId, updateData });
      return { id: runId, stepId, ...updateData };
    },
  };

  const taskRepo = {
    async findById(taskId: number) {
      assert.equal(taskId, 1);
      return {
        id: taskId,
        project_id: 100,
        title: 'Workflow task',
        description: 'Implement the task',
        worktree_path: null,
        worktree_branch: null,
      };
    },
    async update(taskId: number, updateData: Record<string, unknown>) {
      taskUpdates.push({ taskId, ...updateData });
      return { id: taskId, ...updateData };
    },
  };

  const projectRepo = {
    async findById(projectId: number) {
      assert.equal(projectId, 100);
      return { id: projectId, local_path: '/tmp/workspace' };
    },
  };

  const workflowTemplateService = {
    async getTemplates() {
      templateListLoads += 1;
      return templates;
    },
    async getTemplateById(id: string) {
      templateLookupLoads += 1;
      return templates.find((template) => template.template_id === id) ?? null;
    },
  };

  const agentRepo = {
    async findById(id: number) {
      agentLookupIds.push(id);
      return agentRecords.get(id) ?? null;
    },
  };

  const service = new WorkflowService({
    workflowRunRepo: workflowRunRepo as never,
    taskRepo: taskRepo as never,
    projectRepo: projectRepo as never,
    workflowTemplateService: workflowTemplateService as never,
    agentRepo: agentRepo as never,
  });

  (service as WorkflowService & {
    _executeWorkflow: (runId: number, task: Record<string, unknown>) => Promise<void>;
  })._executeWorkflow = async () => {};

  return {
    service,
    createCalls,
    updateCalls,
    stepUpdates,
    taskUpdates,
    agentLookupIds,
    getTemplateListLoads() {
      return templateListLoads;
    },
    getTemplateLookupLoads() {
      return templateLookupLoads;
    },
    selectedTemplateId,
  };
}

async function assertStartWorkflowValidationFailure(
  harness: ReturnType<typeof createStartWorkflowHarness>,
  expectedMessage: RegExp,
) {
  await assert.rejects(
    () => harness.service.startWorkflow(1, harness.selectedTemplateId),
    (error: unknown) => {
      assertValidationError(error, expectedMessage);
      return true;
    },
  );

  assert.equal(harness.createCalls.length, 0);
  assert.equal(harness.taskUpdates.length, 0);
}

test.test('startWorkflow creates a run from the selected template snapshot', async () => {
  const harness = createStartWorkflowHarness();

  const run = await harness.service.startWorkflow(1, 'quick-fix-v1');

  assert.equal(run.status, 'PENDING');
  assert.equal(harness.createCalls.length, 1);
  assert.equal(harness.taskUpdates.length, 1);
  assert.deepEqual(harness.agentLookupIds, [11, 12, 13]);
  assert.equal(harness.getTemplateLookupLoads(), 1);
  assert.equal(harness.getTemplateListLoads(), 0);

  const createdRun = harness.createCalls[0]!;
  assert.equal(createdRun.workflow_id, 'quick-fix-v1');
  assert.equal(createdRun.workflow_template_id, 'quick-fix-v1');
  assert.deepEqual((createdRun.steps as Array<{ step_id: string; name: string }>).map((step) => step.step_id), ['triage', 'fix', 'verify']);
  assert.deepEqual((createdRun.workflow_template_snapshot as WorkflowTemplate).steps.map((step) => step.id), ['triage', 'fix', 'verify']);
  assert.equal(harness.taskUpdates[0]?.workflow_run_id, 42);
});

test.test('startWorkflow prefers a supplied workflow template snapshot and preserves the source template id', async () => {
  const harness = createStartWorkflowHarness();
  const editedSnapshot: WorkflowTemplate = {
    template_id: 'quick-fix-v1-custom',
    name: '快速修复工作流（任务定制）',
    steps: [
      {
        id: 'triage',
        name: '问题定位',
        instructionPrompt: '先确认问题范围，并记录复现条件。',
        agentId: 11,
      },
      {
        id: 'fix',
        name: '实施修复',
        instructionPrompt: '只做当前任务需要的最小修复。',
        agentId: 12,
      },
    ],
  };

  const run = await harness.service.startWorkflow(1, 'quick-fix-v1', editedSnapshot);

  assert.equal(run.status, 'PENDING');
  assert.equal(harness.createCalls.length, 1);
  assert.deepEqual(harness.agentLookupIds, [11, 12]);
  assert.equal(harness.getTemplateLookupLoads(), 0);
  assert.equal(harness.getTemplateListLoads(), 0);

  const createdRun = harness.createCalls[0]!;
  assert.equal(createdRun.workflow_id, 'quick-fix-v1-custom');
  assert.equal(createdRun.workflow_template_id, 'quick-fix-v1');
  assert.deepEqual(createdRun.workflow_template_snapshot, editedSnapshot);
  assert.deepEqual((createdRun.steps as Array<{ step_id: string }>).map((step) => step.step_id), ['triage', 'fix']);
});


test.test('startWorkflow rejects an invalid supplied workflow template snapshot through shared validation', async () => {
  const harness = createStartWorkflowHarness();
  const invalidSnapshot = {
    template_id: 'quick-fix-v1-custom',
    name: '快速修复工作流（任务定制）',
    steps: [
      {
        id: 'triage',
        name: '问题定位',
        instructionPrompt: '   ',
        agentId: 11,
      },
      {
        id: 'fix',
        name: '实施修复',
        instructionPrompt: '完成最小修复。',
        agentId: 12,
      },
    ],
  };

  await assert.rejects(
    () => harness.service.startWorkflow(1, 'quick-fix-v1', invalidSnapshot as WorkflowTemplate),
    (error: unknown) => {
      assertValidationError(error, /instructionPrompt must be a non-empty string/);
      return true;
    },
  );

  assert.equal(harness.getTemplateLookupLoads(), 0);
  assert.equal(harness.getTemplateListLoads(), 0);
  assert.equal(harness.createCalls.length, 0);
  assert.equal(harness.taskUpdates.length, 0);
});

test.test('startWorkflow rejects an unknown selected template id before creating a run', async () => {
  const harness = createStartWorkflowHarness({ selectedTemplateId: 'missing-template' });

  await assert.rejects(
    () => harness.service.startWorkflow(1, 'missing-template'),
    /Workflow template not found/
  );

  assert.equal(harness.createCalls.length, 0);
  assert.equal(harness.taskUpdates.length, 0);
});

test.test('startWorkflow rejects blank selected template ids instead of falling back to the default template', async () => {
  for (const selectedTemplateId of ['', '   ']) {
    const harness = createStartWorkflowHarness({ selectedTemplateId });

    await assert.rejects(
      () => harness.service.startWorkflow(1, selectedTemplateId),
      (error: unknown) => {
        assertValidationError(error, /Workflow template id must be a non-empty string/);
        return true;
      },
    );

    assert.equal(harness.getTemplateLookupLoads(), 0);
    assert.equal(harness.getTemplateListLoads(), 0);
    assert.equal(harness.createCalls.length, 0);
    assert.equal(harness.taskUpdates.length, 0);
  }
});

test.test('startWorkflow rejects blank selected template ids even when a workflow snapshot is supplied', async () => {
  const harness = createStartWorkflowHarness();
  const editedSnapshot: WorkflowTemplate = {
    template_id: 'quick-fix-v1-custom',
    name: '快速修复工作流（任务定制）',
    steps: [
      {
        id: 'triage',
        name: '问题定位',
        instructionPrompt: '先确认问题范围，并记录复现条件。',
        agentId: 11,
      },
      {
        id: 'fix',
        name: '实施修复',
        instructionPrompt: '只做当前任务需要的最小修复。',
        agentId: 12,
      },
    ],
  };

  await assert.rejects(
    () => harness.service.startWorkflow(1, '   ', editedSnapshot),
    (error: unknown) => {
      assertValidationError(error, /Workflow template id must be a non-empty string/);
      return true;
    },
  );

  assert.equal(harness.getTemplateLookupLoads(), 0);
  assert.equal(harness.getTemplateListLoads(), 0);
  assert.equal(harness.createCalls.length, 0);
  assert.equal(harness.taskUpdates.length, 0);
});

test.test('startWorkflow rejects a template step with no assigned agent before task status updates', async () => {
  const template = buildQuickFixTemplate();
  template.steps[0]!.agentId = null;
  const harness = createStartWorkflowHarness({ templates: [template], selectedTemplateId: 'quick-fix-v1' });

  await assertStartWorkflowValidationFailure(
    harness,
    /Step "问题定位" has no agent assigned/
  );
});

test.test('startWorkflow rejects a template step whose agent record is missing', async () => {
  const agents = buildValidAgents();
  agents.delete(11);
  const harness = createStartWorkflowHarness({ agentRecords: agents });

  await assertStartWorkflowValidationFailure(
    harness,
    /Step "问题定位" references agent 11 that was not found/
  );
});

test.test('startWorkflow rejects a template step whose agent is disabled', async () => {
  const agents = buildValidAgents();
  agents.set(11, buildAgent(11, { enabled: false }));
  const harness = createStartWorkflowHarness({ agentRecords: agents });

  await assertStartWorkflowValidationFailure(
    harness,
    /Step "问题定位" references agent 11 that is disabled/
  );
});

test.test('startWorkflow rejects a template step whose agent executor type is unsupported', async () => {
  const agents = buildValidAgents();
  agents.set(11, buildAgent(11, { executorType: 'UNSUPPORTED_EXECUTOR' }));
  const harness = createStartWorkflowHarness({ agentRecords: agents });

  await assertStartWorkflowValidationFailure(
    harness,
    /Step "问题定位" references agent 11 with unsupported executor type: UNSUPPORTED_EXECUTOR/
  );
});

test.test('startWorkflow rejects a template step whose default executor exists in config but is unavailable at runtime', async () => {
  const harness = createStartWorkflowHarness({
    agentRecords: buildAgentsWithUnavailableDefaultExecutors(),
  });

  await assertStartWorkflowValidationFailure(
    harness,
    /Step "实施修复" references agent 12 with unavailable executor type: CODEX/
  );
  assert.deepEqual(harness.agentLookupIds, [11, 12]);
});

test.test('startWorkflow rejects review templates that reference unavailable default executors before run creation', async () => {
  const harness = createStartWorkflowHarness({
    selectedTemplateId: 'review-only-v1',
    agentRecords: buildAgentsWithUnavailableDefaultExecutors(),
  });

  await assertStartWorkflowValidationFailure(
    harness,
    /Step "输出结论" references agent 22 with unavailable executor type: CODEX/
  );
  assert.deepEqual(harness.agentLookupIds, [21, 22]);
});

test.test('startWorkflow rejects a template step whose agent args config is invalid', async () => {
  const agents = buildValidAgents();
  agents.set(11, buildAgent(11, { args: ['--ok', 123] }));
  const harness = createStartWorkflowHarness({ agentRecords: agents });

  await assertStartWorkflowValidationFailure(
    harness,
    /Step "问题定位" references agent 11 with invalid executor configuration: args must be an array of strings/
  );
});

test.test('startWorkflow rejects a template step whose agent env config is invalid', async () => {
  const agents = buildValidAgents();
  agents.set(11, buildAgent(11, { env: { CI: 1 } }));
  const harness = createStartWorkflowHarness({ agentRecords: agents });

  await assertStartWorkflowValidationFailure(
    harness,
    /Step "问题定位" references agent 11 with invalid executor configuration: env must be a string map/
  );
});

test.test('startWorkflow rejects a template step whose agent commandOverride is invalid', async () => {
  const agents = buildValidAgents();
  agents.set(11, buildAgent(11, { commandOverride: '   ' }));
  const harness = createStartWorkflowHarness({ agentRecords: agents });

  await assertStartWorkflowValidationFailure(
    harness,
    /Step "问题定位" references agent 11 with invalid executor configuration: commandOverride must be null, undefined, or a non-empty string/
  );
});

test.test('startWorkflow rejects a template step whose agent skills config is invalid', async () => {
  const agents = buildValidAgents();
  agents.set(11, buildAgent(11, { skills: ['review', 123] as never }));
  const harness = createStartWorkflowHarness({ agentRecords: agents });

  await assertStartWorkflowValidationFailure(
    harness,
    /Step "问题定位" references agent 11 with invalid executor configuration: skills must be an array of strings/
  );
});

test.test('executeWorkflow marks dynamic selected steps as running and completed from the persisted snapshot', async () => {
  const workflowRunRepo = {
    async update() {
      return null;
    },
    async updateStep() {
      return null;
    },
  };
  const taskRepo = {
    async update() {
      return null;
    },
  };
  const service = new WorkflowService({
    workflowRunRepo: workflowRunRepo as never,
    taskRepo: taskRepo as never,
  });

  const runUpdates: Array<Record<string, unknown>> = [];
  const stepUpdates: Array<{ stepId: string; updateData: Record<string, unknown> }> = [];
  const taskUpdates: Array<Record<string, unknown>> = [];

  (service as WorkflowService & {
    workflowRunRepo: typeof workflowRunRepo;
    taskRepo: typeof taskRepo;
    _runWorkflowTemplate: (args: { runId: number; task: Record<string, unknown>; templateSnapshot: WorkflowTemplate }) => Promise<{ status: string; result?: Record<string, unknown>; error?: string }>;
  }).workflowRunRepo = {
    async update(runId: number, updateData: Record<string, unknown>) {
      runUpdates.push({ runId, ...updateData });
      return { id: runId, ...updateData };
    },
    async updateStep(runId: number, stepId: string, updateData: Record<string, unknown>) {
      stepUpdates.push({ stepId, updateData });
      return { id: runId, stepId, ...updateData };
    },
  };
  (service as WorkflowService & { taskRepo: typeof taskRepo }).taskRepo = {
    async update(taskId: number, updateData: Record<string, unknown>) {
      taskUpdates.push({ taskId, ...updateData });
      return { id: taskId, ...updateData };
    },
  };
  (service as WorkflowService & {
    _runWorkflowTemplate: (args: { runId: number; task: Record<string, unknown>; templateSnapshot: WorkflowTemplate }) => Promise<{ status: string; result?: Record<string, unknown>; error?: string }>;
  })._runWorkflowTemplate = async ({ runId, templateSnapshot }) => {
    for (const step of templateSnapshot.steps) {
      await service.workflowRunRepo.updateStep(runId, step.id, {
        status: 'RUNNING',
        started_at: new Date().toISOString(),
      });
      await service.workflowRunRepo.update(runId, { current_step: step.id });
      await service.workflowRunRepo.updateStep(runId, step.id, {
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
        output: { summary: `${step.id}-done` },
      });
    }

    return {
      status: 'success',
      result: { done: true },
    };
  };

  await (service as WorkflowService & {
    _executeWorkflow: (runId: number, task: Record<string, unknown>, templateSnapshot: WorkflowTemplate) => Promise<void>;
  })._executeWorkflow(42, {
    id: 1,
    title: 'Workflow task',
    description: 'Implement the task',
    execution_path: '/tmp/workspace',
  }, buildReviewOnlyTemplate());

  assert.deepEqual(stepUpdates.map((entry) => entry.stepId), ['review', 'review', 'report', 'report']);
  assert.ok(runUpdates.some((entry) => entry.current_step === 'review'));
  assert.ok(runUpdates.some((entry) => entry.current_step === 'report'));
  assert.ok(runUpdates.some((entry) => entry.status === 'COMPLETED'));
  assert.ok(taskUpdates.some((entry) => entry.status === 'DONE'));
});

test.test('cancelWorkflow terminates the active process', async () => {
  const kills: string[] = [];
  let cancelled = false;

  const workflowRunRepo = {
    async findById(runId: number) {
      return { id: runId, status: 'RUNNING' };
    },
    async update(runId: number, updateData: Record<string, unknown>) {
      return { id: runId, ...updateData };
    },
  };

  const service = new WorkflowService({
    workflowRunRepo: workflowRunRepo as never,
    taskRepo: {} as never,
  });

  const proc: ExecutorProcessHandle = {
    kill(signal?: NodeJS.Signals | number) {
      kills.push(String(signal));
      return true;
    },
  };

  service._activeRuns.set(1, {
    cancel: () => {
      cancelled = true;
    },
    proc: null,
    context: {
      proc,
    },
  });

  const result = await service.cancelWorkflow(1);

  assert.equal(cancelled, true);
  assert.deepEqual(kills, ['SIGTERM']);
  assert.equal(result?.status, 'CANCELLED');
});

test.test('cancelWorkflow resets the task back to TODO so it can be restarted', async () => {
  const taskUpdates: Array<Record<string, unknown>> = [];

  const workflowRunRepo = {
    async findById(runId: number) {
      return { id: runId, task_id: 55, status: 'RUNNING' };
    },
    async update(runId: number, updateData: Record<string, unknown>) {
      return { id: runId, ...updateData };
    },
  };

  const taskRepo = {
    async update(taskId: number, updateData: Record<string, unknown>) {
      taskUpdates.push({ taskId, ...updateData });
      return { id: taskId, ...updateData };
    },
  };

  const service = new WorkflowService({
    workflowRunRepo: workflowRunRepo as never,
    taskRepo: taskRepo as never,
  });

  const result = await service.cancelWorkflow(1);

  assert.equal(result?.status, 'CANCELLED');
  assert.ok(taskUpdates.some((entry) => entry.taskId === 55 && entry.status === 'TODO'));
});

test.test('executeWorkflow preserves cancellation requested before the execution context is installed', async () => {
  const runningUpdate = createDeferred<void>();
  const runUpdates: Array<Record<string, unknown>> = [];
  const taskUpdates: Array<Record<string, unknown>> = [];
  let persistedStatus = 'PENDING';

  const workflowRunRepo = {
    async findById(runId: number) {
      return { id: runId, task_id: 105, status: persistedStatus };
    },
    async update(runId: number, updateData: Record<string, unknown>) {
      if (updateData.status === 'RUNNING') {
        await runningUpdate.promise;
      }
      if (typeof updateData.status === 'string') {
        persistedStatus = updateData.status;
      }
      runUpdates.push({ runId, ...updateData });
      return { id: runId, ...updateData };
    },
    async updateStep() {
      return null;
    },
  };

  const taskRepo = {
    async update(taskId: number, updateData: Record<string, unknown>) {
      taskUpdates.push({ taskId, ...updateData });
      return { id: taskId, ...updateData };
    },
  };

  const service = new WorkflowService({
    workflowRunRepo: workflowRunRepo as never,
    taskRepo: taskRepo as never,
  });

  (service as WorkflowService & {
    _runWorkflowTemplate: () => Promise<{ status: 'success'; result: Record<string, unknown> }>;
  })._runWorkflowTemplate = async () => ({
    status: 'success',
    result: { summary: 'finished after early cancellation' },
  });

  const executionPromise = (service as WorkflowService & {
    _executeWorkflow: (runId: number, task: Record<string, unknown>, templateSnapshot: WorkflowTemplate) => Promise<void>;
  })._executeWorkflow(13, {
    id: 105,
    title: 'Workflow task',
    description: 'Implement the task',
    execution_path: '/tmp/workspace',
  }, buildReviewOnlyTemplate());

  const cancellationPromise = service.cancelWorkflow(13);
  runningUpdate.resolve();

  await cancellationPromise;
  await executionPromise;

  assert.equal(persistedStatus, 'CANCELLED');
  assert.ok(runUpdates.some((entry) => entry.status === 'CANCELLED'));
  assert.equal(runUpdates.some((entry) => entry.status === 'COMPLETED'), false);
  assert.equal(taskUpdates.some((entry) => entry.status === 'DONE'), false);
  assert.ok(taskUpdates.some((entry) => entry.taskId === 105 && entry.status === 'TODO'));
});


test.test('executeWorkflow keeps a cancelled run cancelled after in-flight success settles', async () => {
  const deferredResult = createDeferred<{ status: 'success'; result: Record<string, unknown> }>();
  const runUpdates: Array<Record<string, unknown>> = [];
  const taskUpdates: Array<Record<string, unknown>> = [];
  let persistedStatus = 'RUNNING';

  const workflowRunRepo = {
    async findById(runId: number) {
      return { id: runId, status: persistedStatus };
    },
    async update(runId: number, updateData: Record<string, unknown>) {
      if (typeof updateData.status === 'string') {
        persistedStatus = updateData.status;
      }
      runUpdates.push({ runId, ...updateData });
      return { id: runId, ...updateData };
    },
    async updateStep() {
      return null;
    },
  };

  const taskRepo = {
    async update(taskId: number, updateData: Record<string, unknown>) {
      taskUpdates.push({ taskId, ...updateData });
      return { id: taskId, ...updateData };
    },
  };

  const service = new WorkflowService({
    workflowRunRepo: workflowRunRepo as never,
    taskRepo: taskRepo as never,
  });

  (service as WorkflowService & {
    _runWorkflowTemplate: () => Promise<{ status: 'success'; result: Record<string, unknown> }>;
  })._runWorkflowTemplate = async () => await deferredResult.promise;

  const executionPromise = (service as WorkflowService & {
    _executeWorkflow: (runId: number, task: Record<string, unknown>, templateSnapshot: WorkflowTemplate) => Promise<void>;
  })._executeWorkflow(7, {
    id: 99,
    title: 'Workflow task',
    description: 'Implement the task',
    execution_path: '/tmp/workspace',
  }, buildReviewOnlyTemplate());

  await Promise.resolve();
  await service.cancelWorkflow(7);

  deferredResult.resolve({
    status: 'success',
    result: { summary: 'finished after cancellation' },
  });

  await executionPromise;

  assert.equal(persistedStatus, 'CANCELLED');
  assert.ok(runUpdates.some((entry) => entry.status === 'CANCELLED'));
  assert.equal(runUpdates.some((entry) => entry.status === 'COMPLETED'), false);
  assert.equal(taskUpdates.some((entry) => entry.status === 'DONE'), false);
});

test.test('executeWorkflow keeps a cancelled run cancelled after in-flight failure settles', async () => {
  const deferredResult = createDeferred<{ status: 'failed'; error: string }>();
  const runUpdates: Array<Record<string, unknown>> = [];
  const taskUpdates: Array<Record<string, unknown>> = [];
  let persistedStatus = 'RUNNING';

  const workflowRunRepo = {
    async findById(runId: number) {
      return { id: runId, status: persistedStatus };
    },
    async update(runId: number, updateData: Record<string, unknown>) {
      if (typeof updateData.status === 'string') {
        persistedStatus = updateData.status;
      }
      runUpdates.push({ runId, ...updateData });
      return { id: runId, ...updateData };
    },
    async updateStep() {
      return null;
    },
  };

  const taskRepo = {
    async update(taskId: number, updateData: Record<string, unknown>) {
      taskUpdates.push({ taskId, ...updateData });
      return { id: taskId, ...updateData };
    },
  };

  const service = new WorkflowService({
    workflowRunRepo: workflowRunRepo as never,
    taskRepo: taskRepo as never,
  });

  (service as WorkflowService & {
    _runWorkflowTemplate: () => Promise<{ status: 'failed'; error: string }>;
  })._runWorkflowTemplate = async () => await deferredResult.promise;

  const executionPromise = (service as WorkflowService & {
    _executeWorkflow: (runId: number, task: Record<string, unknown>, templateSnapshot: WorkflowTemplate) => Promise<void>;
  })._executeWorkflow(8, {
    id: 100,
    title: 'Workflow task',
    description: 'Implement the task',
    execution_path: '/tmp/workspace',
  }, buildReviewOnlyTemplate());

  await Promise.resolve();
  await service.cancelWorkflow(8);

  deferredResult.resolve({
    status: 'failed',
    error: 'step exploded after cancellation',
  });

  await executionPromise;

  assert.equal(persistedStatus, 'CANCELLED');
  assert.ok(runUpdates.some((entry) => entry.status === 'CANCELLED'));
  assert.equal(runUpdates.some((entry) => entry.status === 'FAILED'), false);
  assert.equal(taskUpdates.some((entry) => entry.status === 'DONE'), false);
});

test.test('executeWorkflow persists FAILED when workflow execution throws before context activation', async () => {
  const runUpdates: Array<Record<string, unknown>> = [];

  const workflowRunRepo = {
    async update(runId: number, updateData: Record<string, unknown>) {
      runUpdates.push({ runId, ...updateData });
      return { id: runId, ...updateData };
    },
    async updateStep() {
      return null;
    },
  };

  const service = new WorkflowService({
    workflowRunRepo: workflowRunRepo as never,
    taskRepo: {} as never,
  });

  (service as WorkflowService & {
    _runWorkflowTemplate: () => Promise<never>;
  })._runWorkflowTemplate = async () => {
    throw new Error('template exploded');
  };

  await assert.doesNotReject(async () => {
    await (service as WorkflowService & {
      _executeWorkflow: (runId: number, task: Record<string, unknown>, templateSnapshot: WorkflowTemplate) => Promise<void>;
    })._executeWorkflow(9, {
      id: 101,
      title: 'Workflow task',
      description: 'Implement the task',
      execution_path: '/tmp/workspace',
    }, buildReviewOnlyTemplate());
  });

  assert.ok(runUpdates.some((entry) => entry.status === 'RUNNING'));
  assert.ok(runUpdates.some((entry) => entry.status === 'FAILED' && (entry.context as { error?: string }).error === 'template exploded'));
});

test.test('executeWorkflow does not dereference context when failure happens before context assignment', async () => {
  const runUpdates: Array<Record<string, unknown>> = [];

  const workflowRunRepo = {
    async update(runId: number, updateData: Record<string, unknown>) {
      runUpdates.push({ runId, ...updateData });
      if (updateData.status === 'RUNNING') {
        throw new Error('failed before context assignment');
      }
      return { id: runId, ...updateData };
    },
    async updateStep() {
      return null;
    },
  };

  const service = new WorkflowService({
    workflowRunRepo: workflowRunRepo as never,
    taskRepo: {} as never,
  });

  await assert.doesNotReject(async () => {
    await (service as WorkflowService & {
      _executeWorkflow: (runId: number, task: Record<string, unknown>, templateSnapshot: WorkflowTemplate) => Promise<void>;
    })._executeWorkflow(10, {
      id: 102,
      title: 'Workflow task',
      description: 'Implement the task',
      execution_path: '/tmp/workspace',
    }, buildReviewOnlyTemplate());
  });

  assert.equal(runUpdates.length, 2);
  assert.equal(runUpdates[0]?.status, 'RUNNING');
  assert.ok(runUpdates.some((entry) => entry.status === 'FAILED' && (entry.context as { error?: string }).error === 'failed before context assignment'));
});

test.test('executeWorkflow resets the task back to TODO when a workflow result fails', async () => {
  const runUpdates: Array<Record<string, unknown>> = [];
  const taskUpdates: Array<Record<string, unknown>> = [];

  const workflowRunRepo = {
    async update(runId: number, updateData: Record<string, unknown>) {
      runUpdates.push({ runId, ...updateData });
      return { id: runId, ...updateData };
    },
    async updateStep() {
      return null;
    },
  };

  const taskRepo = {
    async update(taskId: number, updateData: Record<string, unknown>) {
      taskUpdates.push({ taskId, ...updateData });
      return { id: taskId, ...updateData };
    },
  };

  const service = new WorkflowService({
    workflowRunRepo: workflowRunRepo as never,
    taskRepo: taskRepo as never,
  });

  (service as WorkflowService & {
    _runWorkflowTemplate: () => Promise<{ status: 'failed'; error: string }>;
  })._runWorkflowTemplate = async () => ({
    status: 'failed',
    error: 'step exploded',
  });

  await (service as WorkflowService & {
    _executeWorkflow: (runId: number, task: Record<string, unknown>, templateSnapshot: WorkflowTemplate) => Promise<void>;
  })._executeWorkflow(11, {
    id: 103,
    title: 'Workflow task',
    description: 'Implement the task',
    execution_path: '/tmp/workspace',
  }, buildReviewOnlyTemplate());

  assert.ok(runUpdates.some((entry) => entry.status === 'FAILED' && (entry.context as { error?: string }).error === 'step exploded'));
  assert.ok(taskUpdates.some((entry) => entry.taskId === 103 && entry.status === 'TODO'));
});

test.test('executeWorkflow resets the task back to TODO when workflow execution throws', async () => {
  const runUpdates: Array<Record<string, unknown>> = [];
  const taskUpdates: Array<Record<string, unknown>> = [];

  const workflowRunRepo = {
    async update(runId: number, updateData: Record<string, unknown>) {
      runUpdates.push({ runId, ...updateData });
      return { id: runId, ...updateData };
    },
    async updateStep() {
      return null;
    },
  };

  const taskRepo = {
    async update(taskId: number, updateData: Record<string, unknown>) {
      taskUpdates.push({ taskId, ...updateData });
      return { id: taskId, ...updateData };
    },
  };

  const service = new WorkflowService({
    workflowRunRepo: workflowRunRepo as never,
    taskRepo: taskRepo as never,
  });

  (service as WorkflowService & {
    _runWorkflowTemplate: () => Promise<never>;
  })._runWorkflowTemplate = async () => {
    throw new Error('template exploded');
  };

  await assert.doesNotReject(async () => {
    await (service as WorkflowService & {
      _executeWorkflow: (runId: number, task: Record<string, unknown>, templateSnapshot: WorkflowTemplate) => Promise<void>;
    })._executeWorkflow(12, {
      id: 104,
      title: 'Workflow task',
      description: 'Implement the task',
      execution_path: '/tmp/workspace',
    }, buildReviewOnlyTemplate());
  });

  assert.ok(runUpdates.some((entry) => entry.status === 'FAILED' && (entry.context as { error?: string }).error === 'template exploded'));
  assert.ok(taskUpdates.some((entry) => entry.taskId === 104 && entry.status === 'TODO'));
});










