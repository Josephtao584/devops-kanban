import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { WorkflowTemplate } from '../src/services/workflow/workflowTemplateService.js';
import { WorkflowService } from '../src/services/workflow/workflowService.js';
import { WorkflowRunRepository } from '../src/repositories/workflowRunRepository.js';
import type { StoredWorkflowRunEntity } from '../src/repositories/workflowRunRepository.js';
import type { ExecutorProcessHandle } from '../src/types/executors.js';

interface TemplateStep {
  id: string;
  name: string;
  instructionPrompt: string;
  agentId: number | null;
}

interface WorkflowTemplateRecord {
  template_id: string;
  name: string;
  steps: TemplateStep[];
}

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

const BASE_TEMPLATE_STEPS: TemplateStep[] = [
  {
    id: 'requirement-design',
    name: '需求设计',
    instructionPrompt: '先完成需求分析。',
    agentId: 11,
  },
  {
    id: 'code-development',
    name: '代码开发',
    instructionPrompt: '完成代码实现。',
    agentId: 12,
  },
  {
    id: 'testing',
    name: '测试',
    instructionPrompt: '执行必要验证。',
    agentId: 13,
  },
  {
    id: 'code-review',
    name: '代码审查',
    instructionPrompt: '完成代码审查。',
    agentId: 14,
  },
];

function buildTemplate(overrides: Partial<Record<string, Partial<TemplateStep>>> = {}): WorkflowTemplateRecord {
  return {
    template_id: 'dev-workflow-v1',
    name: '默认研发工作流',
    steps: BASE_TEMPLATE_STEPS.map((step) => ({
      ...step,
      ...(overrides[step.id] ?? {}),
    })),
  };
}

function buildTemplateWithSteps(steps: TemplateStep[]): WorkflowTemplateRecord {
  return {
    template_id: 'dev-workflow-v1',
    name: '默认研发工作流',
    steps,
  };
}

function buildNamedTemplate(templateId: string, steps: TemplateStep[] = getBaseTemplateSteps()): WorkflowTemplateRecord {
  return {
    template_id: templateId,
    name: `模板 ${templateId}`,
    steps,
  };
}

function assertValidationError(error: unknown, expectedMessage: RegExp) {
  assert.match((error as Error).message, expectedMessage);
  assert.equal((error as Error & { statusCode?: number }).statusCode, 400);
}

function getBaseTemplateSteps(): TemplateStep[] {
  return BASE_TEMPLATE_STEPS.map((step) => ({ ...step }));
}

function removeStep(stepId: string): TemplateStep[] {
  return getBaseTemplateSteps().filter((step) => step.id !== stepId);
}

function duplicateStep(stepId: string): TemplateStep[] {
  const steps = getBaseTemplateSteps();
  const duplicate = steps.find((step) => step.id === stepId);
  if (!duplicate) {
    throw new Error(`Unknown step for duplication: ${stepId}`);
  }
  return [duplicate, ...steps];
}

function appendExtraStep(): TemplateStep[] {
  return [
    ...getBaseTemplateSteps(),
    {
      id: 'security-review',
      name: '安全审查',
      instructionPrompt: '补充审查。',
      agentId: 99,
    },
  ];
}

function reorderSteps(): TemplateStep[] {
  const steps = getBaseTemplateSteps();
  return [steps[1]!, steps[0]!, steps[2]!, steps[3]!];
}

function assertNoRunCreated(harness: ReturnType<typeof createStartWorkflowHarness>) {
  assert.equal(harness.createCalls.length, 0);
  assert.equal(harness.taskUpdates.length, 0);
}

async function assertStartWorkflowValidationFailure(
  harness: ReturnType<typeof createStartWorkflowHarness>,
  expectedMessage: RegExp,
) {
  await assert.rejects(
    () => harness.service.startWorkflow(1),
    (error: unknown) => {
      assertValidationError(error, expectedMessage);
      return true;
    },
  );

  assertNoRunCreated(harness);
}

async function assertTemplateValidationFailure(steps: TemplateStep[], expectedMessage: RegExp) {
  const harness = createStartWorkflowHarness({
    template: buildTemplateWithSteps(steps),
  });

  await assertStartWorkflowValidationFailure(
    harness,
    expectedMessage,
  );
}

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function createTempStorageRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'kanban-workflow-run-'));
}

class BlockingWorkflowRunRepository extends WorkflowRunRepository {
  private nextSaveGate: {
    entered: ReturnType<typeof createDeferred<void>>;
    release: ReturnType<typeof createDeferred<void>>;
  } | null = null;

  constructor(storagePath: string) {
    super({ storagePath });
  }

  blockNextSave() {
    const entered = createDeferred<void>();
    const release = createDeferred<void>();
    this.nextSaveGate = { entered, release };
    return {
      waitUntilBlocked: entered.promise,
      release: () => release.resolve(),
    };
  }

  override async _saveAll(data: StoredWorkflowRunEntity[]) {
    const gate = this.nextSaveGate;
    if (gate) {
      this.nextSaveGate = null;
      gate.entered.resolve();
      await gate.release.promise;
    }

    await super._saveAll(data);
  }
}

async function createRunningWorkflowRun(repo: WorkflowRunRepository, taskId: number) {
  return await repo.create({
    task_id: taskId,
    workflow_id: 'dev-workflow-v1',
    status: 'RUNNING',
    current_step: 'requirement-design',
    steps: [
      {
        step_id: 'requirement-design',
        name: '需求设计',
        status: 'RUNNING',
        started_at: '2026-03-23T00:00:00.000Z',
        completed_at: null,
        retry_count: 0,
        session_id: null,
        summary: null,
        error: null,
      },
    ],
    worktree_path: '/tmp/workspace',
    branch: `task/${taskId}`,
    context: {},
  });
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
    [12, buildAgent(12, { executorType: 'CODEX' })],
    [13, buildAgent(13, { executorType: 'OPENCODE' })],
    [14, buildAgent(14, { executorType: 'CLAUDE_CODE' })],
  ]);
}

function createStartWorkflowHarness({
  template = buildTemplate(),
  agentRecords = buildValidAgents(),
  existingRun = null,
  latestRun = existingRun,
}: {
  template?: WorkflowTemplateRecord;
  agentRecords?: Map<number, AgentRecord>;
  existingRun?: { status: string } | null;
  latestRun?: { status: string } | null;
} = {}) {
  const createCalls: Array<Record<string, unknown>> = [];
  const taskUpdates: Array<Record<string, unknown>> = [];
  const agentLookupIds: number[] = [];
  let templateLoads = 0;

  const workflowRunRepo = {
    async findByTaskId(taskId: number) {
      assert.equal(taskId, 1);
      return existingRun;
    },
    async findLatestByTaskId(taskId: number) {
      assert.equal(taskId, 1);
      return latestRun;
    },
    async create(payload: Record<string, unknown>) {
      createCalls.push(payload);
      return { id: 42, ...payload };
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
    async getTemplate() {
      templateLoads += 1;
      return template;
    },
    async getTemplateById(templateId: string) {
      templateLoads += 1;
      return template.template_id === templateId ? template : null;
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
    taskUpdates,
    agentLookupIds,
    getTemplateLoads() {
      return templateLoads;
    },
  };
}

function createStepSessionHarness({
  blockSegmentCreate = false,
  blockSegmentCreateAt = blockSegmentCreate ? 1 : null,
}: {
  blockSegmentCreate?: boolean;
  blockSegmentCreateAt?: number | null;
} = {}) {
  const agentRecords = buildValidAgents();
  const run = {
    id: 7,
    task_id: 1,
    workflow_id: 'dev-workflow-v1',
    status: 'RUNNING',
    current_step: null,
    steps: [
      {
        step_id: 'requirement-design',
        name: '需求设计',
        status: 'PENDING',
        started_at: null,
        completed_at: null,
        retry_count: 0,
        session_id: null,
        summary: null,
        error: null,
      },
    ],
    worktree_path: '/tmp/workspace',
    branch: 'task/1',
    context: {},
  };
  const sessionCreates: Array<Record<string, unknown>> = [];
  const sessionUpdates: Array<{ sessionId: number; updateData: Record<string, unknown> }> = [];
  const sessions = new Map<number, Record<string, unknown>>();
  const segmentCreates: Array<Record<string, unknown>> = [];
  const segmentUpdates: Array<{ segmentId: number; updateData: Record<string, unknown> }> = [];
  const segments: Array<Record<string, unknown> & { id: number; session_id: number }> = [];
  const blockedSegmentCreate = blockSegmentCreate ? createDeferred<void>() : null;
  const releaseBlockedSegmentCreate = blockSegmentCreate ? createDeferred<void>() : null;
  const task = {
    id: 1,
    project_id: 100,
    title: 'Workflow task',
    description: 'Implement the task',
    worktree_branch: 'task/1',
    execution_path: '/tmp/workspace',
  };
  let nextSessionId = 101;
  let nextSegmentId = 201;
  let segmentCreateCount = 0;

  const workflowRunRepo = {
    async findById(runId: number) {
      assert.equal(runId, 7);
      return run;
    },
    async updateStep(runId: number, stepId: string, updateData: Record<string, unknown>) {
      assert.equal(runId, 7);
      const step = run.steps.find((candidate) => candidate.step_id === stepId);
      assert.ok(step);
      Object.assign(step, updateData);
      return run;
    },
    async update(runId: number, updateData: Record<string, unknown>) {
      assert.equal(runId, 7);
      Object.assign(run, updateData);
      return run;
    },
  };

  const sessionRepo = {
    async create(payload: Record<string, unknown>) {
      sessionCreates.push(payload);
      const session = {
        id: nextSessionId,
        ...payload,
      };
      sessions.set(nextSessionId, session);
      nextSessionId += 1;
      return session;
    },
    async findById(sessionId: number) {
      return sessions.get(sessionId) ?? null;
    },
    async update(sessionId: number, updateData: Record<string, unknown>) {
      sessionUpdates.push({ sessionId, updateData });
      const session = sessions.get(sessionId);
      assert.ok(session);
      Object.assign(session, updateData);
      return session;
    },
  };

  const sessionSegmentRepo = {
    async create(payload: Record<string, unknown>) {
      segmentCreates.push(payload);
      segmentCreateCount += 1;
      if (
        blockedSegmentCreate
        && releaseBlockedSegmentCreate
        && blockSegmentCreateAt != null
        && segmentCreateCount === blockSegmentCreateAt
      ) {
        blockedSegmentCreate.resolve();
        await releaseBlockedSegmentCreate.promise;
      }
      const segment = {
        id: nextSegmentId,
        ...payload,
      } as Record<string, unknown> & { id: number; session_id: number };
      segments.push(segment);
      nextSegmentId += 1;
      return segment;
    },
    async findLatestBySessionId(sessionId: number) {
      const matching = segments.filter((segment) => segment.session_id === sessionId);
      return matching[matching.length - 1] ?? null;
    },
    async update(segmentId: number, updateData: Record<string, unknown>) {
      segmentUpdates.push({ segmentId, updateData });
      const segment = segments.find((candidate) => candidate.id === segmentId);
      assert.ok(segment);
      Object.assign(segment, updateData);
      return segment;
    },
  };

  const workflowTemplateService = {
    async getTemplate() {
      return buildTemplate();
    },
  };

  const agentRepo = {
    async findById(id: number) {
      return agentRecords.get(id) ?? null;
    },
  };

  const service = new WorkflowService({
    workflowRunRepo: workflowRunRepo as never,
    workflowTemplateService: workflowTemplateService as never,
    agentRepo: agentRepo as never,
    sessionRepo: sessionRepo as never,
    sessionSegmentRepo: sessionSegmentRepo as never,
  });

  return {
    service,
    run,
    task,
    sessions,
    sessionCreates,
    sessionUpdates,
    segments,
    segmentCreates,
    segmentUpdates,
    waitUntilSegmentCreateBlocked() {
      return blockedSegmentCreate?.promise ?? Promise.resolve();
    },
    releaseSegmentCreate() {
      releaseBlockedSegmentCreate?.resolve();
    },
  };
}




test.test('startWorkflow rejects an unknown selected template id before creating a run', async () => {
  const harness = createStartWorkflowHarness({ template: buildTemplate() });

  await assert.rejects(
    () => harness.service.startWorkflow(1, 'missing-template'),
    (error: unknown) => {
      assertValidationError(error, /Workflow template not found: missing-template/);
      return true;
    },
  );

  assert.equal(harness.getTemplateLoads(), 1);
  assert.equal(harness.createCalls.length, 0);
  assert.equal(harness.taskUpdates.length, 0);
});

test.test('startWorkflow rejects a template step with no assigned agent before task status updates', async () => {
  const template = buildNamedTemplate('quick-fix-v1', buildTemplate({ 'requirement-design': { agentId: 1 } }).steps);
  const harness = createStartWorkflowHarness({ template });

  await assert.rejects(
    () => harness.service.startWorkflow(1, 'quick-fix-v1'),
    (error: unknown) => {
      assertValidationError(error, /Step "需求设计" has no agent assigned/);
      return true;
    },
  );

  assert.equal(harness.createCalls.length, 0);
  assert.equal(harness.taskUpdates.length, 0);
}
)
function createActiveRunCancelHarness() {
  const run = {
    id: 7,
    task_id: 1,
    workflow_id: 'dev-workflow-v1',
    status: 'PENDING',
    current_step: null,
    steps: [
      {
        step_id: 'requirement-design',
        name: '需求设计',
        status: 'PENDING',
        started_at: null,
        completed_at: null,
        retry_count: 0,
        session_id: null,
        summary: null,
        error: null,
      },
    ],
    worktree_path: '/tmp/workspace',
    branch: 'task/1',
    context: {},
  };
  const runUpdates: Array<Record<string, unknown>> = [];
  const taskUpdates: Array<{ taskId: number; updateData: Record<string, unknown> }> = [];
  let createWorkflowStreamCalls = 0;

  const workflowRunRepo = {
    async findById(runId: number) {
      assert.equal(runId, 7);
      return run;
    },
    async update(runId: number, updateData: Record<string, unknown>) {
      assert.equal(runId, 7);
      runUpdates.push(updateData);
      Object.assign(run, updateData);
      return run;
    },
    async updateStep(runId: number, stepId: string, updateData: Record<string, unknown>) {
      assert.equal(runId, 7);
      assert.equal(stepId, 'requirement-design');
      Object.assign(run.steps[0]!, updateData);
      return run;
    },
  };

  const taskRepo = {
    async update(taskId: number, updateData: Record<string, unknown>) {
      taskUpdates.push({ taskId, updateData });
      return { id: taskId, ...updateData };
    },
  };

  const service = new WorkflowService({
    workflowRunRepo: workflowRunRepo as never,
    taskRepo: taskRepo as never,
    sessionRepo: {
      async create() {
        throw new Error('create should not be called');
      },
      async findById() {
        return null;
      },
      async update() {
        throw new Error('update should not be called');
      },
    } as never,
    sessionSegmentRepo: {
      async create() {
        throw new Error('create should not be called');
      },
      async findLatestBySessionId() {
        return null;
      },
      async update() {
        throw new Error('update should not be called');
      },
    } as never,
  });

  (service as WorkflowService & {
    _createWorkflowStream: () => Promise<{
      fullStream: AsyncIterable<{ type: string; payload?: { stepName?: string } }>;
      result: Promise<{ status: string; result?: Record<string, unknown> }>;
    }>;
  })._createWorkflowStream = async () => {
    createWorkflowStreamCalls += 1;
    return {
      fullStream: (async function* () {})(),
      result: Promise.resolve({ status: 'success', result: { summary: 'should not persist' } }),
    };
  };

  return {
    service,
    run,
    runUpdates,
    taskUpdates,
    getCreateWorkflowStreamCalls() {
      return createWorkflowStreamCalls;
    },
  };
}


test.test('startWorkflow rejects a template step with no assigned agent before task status updates', async () => {
  const template = buildNamedTemplate('quick-fix-v1', buildTemplate({ 'requirement-design': { agentId: 1 } }).steps);
  const harness = createStartWorkflowHarness({ template });

  await assert.rejects(
    () => harness.service.startWorkflow(1, 'quick-fix-v1'),
    (error: unknown) => {
      assertValidationError(error, /Step "需求设计" has no agent assigned/);
      return true;
    },
  );

  assert.equal(harness.createCalls.length, 0);
  assert.equal(harness.taskUpdates.length, 0);
});

function createSuccessFinalizationRaceHarness() {
  const run = {
    id: 7,
    task_id: 1,
    workflow_id: 'dev-workflow-v1',
    status: 'PENDING',
    current_step: null,
    steps: [
      {
        step_id: 'requirement-design',
        name: '需求设计',
        status: 'PENDING',
        started_at: null,
        completed_at: null,
        retry_count: 0,
        session_id: null,
        summary: null,
        error: null,
      },
    ],
    worktree_path: '/tmp/workspace',
    branch: 'task/1',
    context: {},
  };
  const runUpdates: Array<Record<string, unknown>> = [];
  const taskUpdates: Array<{ taskId: number; updateData: Record<string, unknown> }> = [];
  const blockedCompletionUpdate = createDeferred<void>();
  const releaseCompletionUpdate = createDeferred<void>();

  const workflowRunRepo = {
    async findById(runId: number) {
      assert.equal(runId, 7);
      return run;
    },
    async update(runId: number, updateData: Record<string, unknown>) {
      assert.equal(runId, 7);
      runUpdates.push(updateData);

      if (updateData.status === 'COMPLETED') {
        blockedCompletionUpdate.resolve();
        await releaseCompletionUpdate.promise;
        if (run.status === 'CANCELLED') {
          return run;
        }
      }

      Object.assign(run, updateData);
      return run;
    },
  };

  const taskRepo = {
    async update(taskId: number, updateData: Record<string, unknown>) {
      taskUpdates.push({ taskId, updateData });
      return { id: taskId, ...updateData };
    },
  };

  const service = new WorkflowService({
    workflowRunRepo: workflowRunRepo as never,
    taskRepo: taskRepo as never,
    sessionRepo: {
      async create() {
        throw new Error('create should not be called');
      },
      async findById() {
        return null;
      },
      async update() {
        throw new Error('update should not be called');
      },
    } as never,
    sessionSegmentRepo: {
      async create() {
        throw new Error('create should not be called');
      },
      async findLatestBySessionId() {
        return null;
      },
      async update() {
        throw new Error('update should not be called');
      },
    } as never,
  });

  (service as WorkflowService & {
    _createWorkflowStream: () => Promise<{
      fullStream: AsyncIterable<{ type: string; payload?: { stepName?: string } }>;
      result: Promise<{ status: string; result?: Record<string, unknown> }>;
    }>;
  })._createWorkflowStream = async () => ({
    fullStream: (async function* () {})(),
    result: Promise.resolve({ status: 'success', result: { summary: 'ignored after cancel' } }),
  });

  return {
    service,
    run,
    runUpdates,
    taskUpdates,
    waitUntilCompletionUpdate() {
      return blockedCompletionUpdate.promise;
    },
    releaseCompletionUpdate() {
      releaseCompletionUpdate.resolve();
    },
  };
}

function createExecuteWorkflowHarness() {
  const stepSessionHarness = createStepSessionHarness();
  const runUpdates: Array<Record<string, unknown>> = [];
  const taskUpdates: Array<{ taskId: number; updateData: Record<string, unknown> }> = [];

  const workflowRunRepo = {
    ...((stepSessionHarness.service as WorkflowService).workflowRunRepo as object),
    async update(runId: number, updateData: Record<string, unknown>) {
      assert.equal(runId, 7);
      runUpdates.push(updateData);
      Object.assign(stepSessionHarness.run, updateData);
      return stepSessionHarness.run;
    },
  };

  const taskRepo = {
    async update(taskId: number, updateData: Record<string, unknown>) {
      taskUpdates.push({ taskId, updateData });
      return { id: taskId, ...updateData };
    },
  };

  const service = new WorkflowService({
    workflowRunRepo: workflowRunRepo as never,
    workflowTemplateService: ((stepSessionHarness.service as WorkflowService).workflowTemplateService) as never,
    agentRepo: ((stepSessionHarness.service as WorkflowService).agentRepo) as never,
    sessionRepo: ((stepSessionHarness.service as WorkflowService).sessionRepo) as never,
    sessionSegmentRepo: ((stepSessionHarness.service as WorkflowService).sessionSegmentRepo) as never,
    taskRepo: taskRepo as never,
  });

  return {
    service,
    run: stepSessionHarness.run,
    task: stepSessionHarness.task,
    sessions: stepSessionHarness.sessions,
    segments: stepSessionHarness.segments,
    runUpdates,
    taskUpdates,
  };
}

test.test('startWorkflow stores the selected template id and snapshot on the created run', async () => {
  const selectedTemplate = buildNamedTemplate('quick-fix-v1');
  const harness = createStartWorkflowHarness({
    template: selectedTemplate,
  });

  await harness.service.startWorkflow(1, 'quick-fix-v1');

  const createdRun = harness.createCalls[0];
  assert.ok(createdRun);
  assert.equal(createdRun.workflow_id, 'quick-fix-v1');
  assert.equal(createdRun.workflow_template_id, 'quick-fix-v1');
  assert.deepEqual(createdRun.workflow_template_snapshot, selectedTemplate);
});


test.test('startWorkflow rejects a template step with no assigned agent', async () => {
  const harness = createStartWorkflowHarness({
    template: buildTemplate({
      'requirement-design': { agentId: 1 },
    }),
  });

  await assertStartWorkflowValidationFailure(
    harness,
    /Step "需求设计" has no agent assigned/,
  );
});

test.test('startWorkflow rejects a template step whose agent record is missing', async () => {
  const agents = buildValidAgents();
  agents.delete(11);
  const harness = createStartWorkflowHarness({ agentRecords: agents });

  await assertStartWorkflowValidationFailure(
    harness,
    /Step "需求设计" references agent 11 that was not found/,
  );
});

test.test('startWorkflow rejects a template step whose agent is disabled', async () => {
  const agents = buildValidAgents();
  agents.set(11, buildAgent(11, { enabled: false }));
  const harness = createStartWorkflowHarness({ agentRecords: agents });

  await assertStartWorkflowValidationFailure(
    harness,
    /Step "需求设计" references agent 11 that is disabled/,
  );
});

test.test('startWorkflow rejects a template step whose agent executor type is unsupported', async () => {
  const agents = buildValidAgents();
  agents.set(11, buildAgent(11, { executorType: 'UNSUPPORTED_EXECUTOR' }));
  const harness = createStartWorkflowHarness({ agentRecords: agents });

  await assertStartWorkflowValidationFailure(
    harness,
    /Step "需求设计" references agent 11 with unsupported executor type: UNSUPPORTED_EXECUTOR/,
  );
});

test.test('startWorkflow rejects a template step whose agent skills config is invalid', async () => {
  const agents = buildValidAgents();
  agents.set(11, buildAgent(11, { skills: ['review', 123] as never }));
  const harness = createStartWorkflowHarness({ agentRecords: agents });

  await assertStartWorkflowValidationFailure(
    harness,
    /Step "需求设计" references agent 11 with invalid executor configuration: skills must be an array of strings/,
  );
});

test.test('startWorkflow accepts a template missing a previously built-in step id as long as agent bindings are valid', async () => {
  const selectedTemplate = buildNamedTemplate('custom-missing-testing', removeStep('testing'));
  const harness = createStartWorkflowHarness({
    template: selectedTemplate,
  });

  await harness.service.startWorkflow(1, 'custom-missing-testing');

  const createdRun = harness.createCalls[0];
  assert.ok(createdRun);
  assert.equal(createdRun.workflow_id, 'custom-missing-testing');
  assert.equal(createdRun.workflow_template_id, 'custom-missing-testing');
  assert.deepEqual(createdRun.workflow_template_snapshot, selectedTemplate);
});

test.test('startWorkflow rejects a template with a duplicate workflow step id', async () => {
  await assertTemplateValidationFailure(duplicateStep('requirement-design'), /Workflow template step ids must be unique/);
});

test.test('startWorkflow accepts a template with extra custom workflow steps', async () => {
  const selectedTemplate = buildNamedTemplate('custom-extra-step', appendExtraStep());
  const harness = createStartWorkflowHarness({
    template: selectedTemplate,
    agentRecords: new Map([...buildValidAgents(), [99, buildAgent(99, { executorType: 'CLAUDE_CODE' })]]),
  });

  await harness.service.startWorkflow(1, 'custom-extra-step');

  const createdRun = harness.createCalls[0];
  assert.ok(createdRun);
  assert.equal(createdRun.workflow_id, 'custom-extra-step');
  assert.deepEqual(createdRun.workflow_template_snapshot, selectedTemplate);
});

test.test('startWorkflow accepts a template with workflow steps in a custom order', async () => {
  const selectedTemplate = buildNamedTemplate('custom-reordered', reorderSteps());
  const harness = createStartWorkflowHarness({
    template: selectedTemplate,
  });

  await harness.service.startWorkflow(1, 'custom-reordered');

  const createdRun = harness.createCalls[0];
  assert.ok(createdRun);
  assert.equal(createdRun.workflow_id, 'custom-reordered');
  assert.deepEqual(createdRun.workflow_template_snapshot, selectedTemplate);
});



test.test('startWorkflow rejects when a newer active run exists behind an older completed run', async () => {
  const harness = createStartWorkflowHarness({
    existingRun: { status: 'COMPLETED' },
    latestRun: { status: 'RUNNING' },
  });

  await assert.rejects(
    () => harness.service.startWorkflow(1),
    (error: unknown) => {
      assert.match((error as Error).message, /Task already has an active workflow run/);
      assert.equal((error as Error & { statusCode?: number }).statusCode, 409);
      return true;
    },
  );

  assertNoRunCreated(harness);
});
test.test('startWorkflow initializes step snapshots with session-aware summary fields', async () => {
  const harness = createStartWorkflowHarness();

  await harness.service.startWorkflow(1);

  const createdRun = harness.createCalls[0];
  assert.ok(createdRun);
  assert.deepEqual(createdRun.steps, [
    {
      step_id: 'requirement-design',
      name: '需求设计',
      status: 'PENDING',
      started_at: null,
      completed_at: null,
      retry_count: 0,
      session_id: null,
      summary: null,
      error: null,
    },
    {
      step_id: 'code-development',
      name: '代码开发',
      status: 'PENDING',
      started_at: null,
      completed_at: null,
      retry_count: 0,
      session_id: null,
      summary: null,
      error: null,
    },
    {
      step_id: 'testing',
      name: '测试',
      status: 'PENDING',
      started_at: null,
      completed_at: null,
      retry_count: 0,
      session_id: null,
      summary: null,
      error: null,
    },
    {
      step_id: 'code-review',
      name: '代码审查',
      status: 'PENDING',
      started_at: null,
      completed_at: null,
      retry_count: 0,
      session_id: null,
      summary: null,
      error: null,
    },
  ]);
});





















