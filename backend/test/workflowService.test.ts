import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { WorkflowService } from '../src/services/workflow/workflowService.js';
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

async function assertStructuralDriftFailure(steps: TemplateStep[]) {
  const harness = createStartWorkflowHarness({
    template: buildTemplateWithSteps(steps),
  });

  await assertStartWorkflowValidationFailure(
    harness,
    /Workflow template steps do not match the workflow definition/,
  );
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
}: {
  template?: WorkflowTemplateRecord;
  agentRecords?: Map<number, AgentRecord>;
  existingRun?: { status: string } | null;
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

test.test('startWorkflow creates a run when every bound step agent is valid and enabled', async () => {
  const harness = createStartWorkflowHarness();

  const run = await harness.service.startWorkflow(1);

  assert.equal(run.status, 'PENDING');
  assert.equal(harness.createCalls.length, 1);
  assert.equal(harness.taskUpdates.length, 1);
  assert.deepEqual(harness.agentLookupIds, [11, 12, 13, 14]);
  assert.equal(harness.getTemplateLoads(), 1);
});

test.test('startWorkflow rejects a template step with no assigned agent', async () => {
  const harness = createStartWorkflowHarness({
    template: buildTemplate({
      'requirement-design': { agentId: null },
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

test.test('startWorkflow rejects a template step whose agent args config is invalid', async () => {
  const agents = buildValidAgents();
  agents.set(11, buildAgent(11, { args: ['--ok', 123] }));
  const harness = createStartWorkflowHarness({ agentRecords: agents });

  await assertStartWorkflowValidationFailure(
    harness,
    /Step "需求设计" references agent 11 with invalid executor configuration: args must be an array of strings/,
  );
});

test.test('startWorkflow rejects a template step whose agent env config is invalid', async () => {
  const agents = buildValidAgents();
  agents.set(11, buildAgent(11, { env: { CI: 1 } }));
  const harness = createStartWorkflowHarness({ agentRecords: agents });

  await assertStartWorkflowValidationFailure(
    harness,
    /Step "需求设计" references agent 11 with invalid executor configuration: env must be a string map/,
  );
});

test.test('startWorkflow rejects a template step whose agent commandOverride is invalid', async () => {
  const agents = buildValidAgents();
  agents.set(11, buildAgent(11, { commandOverride: '   ' }));
  const harness = createStartWorkflowHarness({ agentRecords: agents });

  await assertStartWorkflowValidationFailure(
    harness,
    /Step "需求设计" references agent 11 with invalid executor configuration: commandOverride must be null, undefined, or a non-empty string/,
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

test.test('startWorkflow rejects a template missing a required workflow step id', async () => {
  await assertStructuralDriftFailure(removeStep('testing'));
});

test.test('startWorkflow rejects a template with a duplicate workflow step id', async () => {
  await assertStructuralDriftFailure(duplicateStep('requirement-design'));
});

test.test('startWorkflow rejects a template with an extra workflow step id', async () => {
  await assertStructuralDriftFailure(appendExtraStep());
});

test.test('startWorkflow rejects a template with workflow steps in the wrong order', async () => {
  await assertStructuralDriftFailure(reorderSteps());
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
