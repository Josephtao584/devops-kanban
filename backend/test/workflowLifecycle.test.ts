import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { WorkflowLifecycle } from '../src/services/workflow/workflowLifecycle.js';

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

function buildTemplate() {
  return {
    template_id: 'workflow-v1',
    name: '通用复杂任务工作流',
    steps: [
      {
        id: 'solution-design',
        name: '方案设计',
        instructionPrompt: '完成方案设计。',
        agentId: 11,
      },
      {
        id: 'feature-development',
        name: '开发实现',
        instructionPrompt: '完成开发实现。',
        agentId: 12,
      },
      {
        id: 'qa-validation',
        name: '测试验证',
        instructionPrompt: '执行测试验证。',
        agentId: 13,
      },
      {
        id: 'final-review',
        name: '结果评审',
        instructionPrompt: '完成最终评审。',
        agentId: 14,
      },
    ],
  };
}

function createLifecycleHarness({
  runStatus = 'RUNNING',
  stepStatus = 'PENDING',
  stepSessionId = null as number | null,
  currentStep = null as string | null,
} = {}) {
  const agentRecords = buildValidAgents();
  const template = buildTemplate();
  const run = {
    id: 7,
    task_id: 1,
    workflow_id: 'workflow-v1',
    workflow_template_id: 'workflow-v1',
    workflow_template_snapshot: template,
    status: runStatus,
    current_step: currentStep,
    steps: [
      {
        step_id: 'solution-design',
        name: '方案设计',
        status: stepStatus,
        started_at: null as string | null,
        completed_at: null as string | null,
        retry_count: 0,
        session_id: stepSessionId,
        summary: null as string | null,
        error: null as string | null,
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
  const stepUpdates: Array<{ stepId: string; updateData: Record<string, unknown> }> = [];
  const runUpdates: Array<Record<string, unknown>> = [];
  const eventAppends: Array<Record<string, unknown>> = [];
  let nextSessionId = 101;
  let nextSegmentId = 201;

  const task = {
    id: 1,
    project_id: 100,
    title: 'Workflow task',
    description: 'Implement the task',
    worktree_branch: 'task/1',
    execution_path: '/tmp/workspace',
  };

  const workflowRunRepo = {
    async findById(runId: number) {
      assert.equal(runId, 7);
      return run;
    },
    async updateStep(runId: number, stepId: string, updateData: Record<string, unknown>) {
      assert.equal(runId, 7);
      stepUpdates.push({ stepId, updateData });
      const step = run.steps.find((candidate) => candidate.step_id === stepId);
      assert.ok(step);
      Object.assign(step, updateData);
      return run;
    },
    async update(runId: number, updateData: Record<string, unknown>) {
      assert.equal(runId, 7);
      runUpdates.push(updateData);
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

  const agentRepo = {
    async findById(id: number) {
      return agentRecords.get(id) ?? null;
    },
  };

  const instanceRepo = {
    async findByInstanceId() {
      return {
        instance_id: 'inst-test',
        steps: template.steps,
      };
    },
  };

  const lifecycle = new WorkflowLifecycle({
    workflowRunRepo: workflowRunRepo as never,
    taskRepo: {
      async update(_id: number, _data: Record<string, unknown>) {
        // no-op
      },
    } as never,
    agentRepo: agentRepo as never,
    instanceRepo: instanceRepo as never,
    sessionRepo: sessionRepo as never,
    sessionSegmentRepo: sessionSegmentRepo as never,
    sessionEventRepo: {
      async append(event: Record<string, unknown>) {
        eventAppends.push(event);
      },
    } as never,
  });

  return {
    lifecycle,
    run,
    task,
    sessions,
    sessionCreates,
    sessionUpdates,
    segments,
    segmentCreates,
    segmentUpdates,
    stepUpdates,
    runUpdates,
    eventAppends,
  };
}


test.test('onStepStart creates a session, segment, and marks step RUNNING', async () => {
  const harness = createLifecycleHarness();

  await harness.lifecycle.onStepStart(7, 'solution-design', harness.task);

  assert.equal(harness.sessionCreates.length, 1);
  const sessionPayload = harness.sessionCreates[0]!;
  assert.equal(sessionPayload.task_id, 1);
  assert.equal(sessionPayload.workflow_run_id, 7);
  assert.equal(sessionPayload.workflow_step_id, 'solution-design');
  assert.equal(sessionPayload.status, 'RUNNING');
  assert.equal(sessionPayload.agent_id, 11);
  assert.equal(sessionPayload.executor_type, 'CLAUDE_CODE');

  assert.equal(harness.segmentCreates.length, 1);
  const segmentPayload = harness.segmentCreates[0]!;
  assert.equal(segmentPayload.session_id, 101);
  assert.equal(segmentPayload.status, 'RUNNING');
  assert.equal(segmentPayload.trigger_type, 'START');
  assert.equal(segmentPayload.parent_segment_id, null);

  const step = harness.run.steps[0]!;
  assert.equal(step.status, 'RUNNING');
  assert.equal(step.session_id, 101);
  assert.ok(step.started_at);
  assert.equal(step.error, null);
  assert.equal(step.summary, null);

  assert.equal(harness.run.current_step, 'solution-design');
});

test.test('onStepComplete marks step COMPLETED with summary', async () => {
  const harness = createLifecycleHarness({
    stepStatus: 'RUNNING',
    currentStep: 'solution-design',
    stepSessionId: null,
  });

  harness.run.steps[0]!.session_id = 101;
  const session = { id: 101, status: 'RUNNING', executor_type: 'CLAUDE_CODE', agent_id: 11 };
  harness.sessions.set(101, session);

  const segment = { id: 201, session_id: 101, status: 'RUNNING' } as Record<string, unknown> & { id: number; session_id: number };
  harness.segments.push(segment);

  await harness.lifecycle.onStepComplete(7, 'solution-design', { summary: '  Requirements analyzed successfully  ' });

  const stepUpdate = harness.stepUpdates.find((update) => update.updateData.status === 'COMPLETED');
  assert.ok(stepUpdate);
  assert.equal(stepUpdate.updateData.summary, 'Requirements analyzed successfully');
  assert.equal(stepUpdate.updateData.error, null);
  assert.ok(stepUpdate.updateData.completed_at);

  const sessionUpdate = harness.sessionUpdates.find((update) => update.updateData.status === 'COMPLETED');
  assert.ok(sessionUpdate);
  assert.equal(sessionUpdate.sessionId, 101);

  const segmentUpdate = harness.segmentUpdates.find((update) => update.updateData.status === 'COMPLETED');
  assert.ok(segmentUpdate);
  assert.equal(segmentUpdate.segmentId, 201);
});

test.test('onStepComplete with empty summary stores null', async () => {
  const harness = createLifecycleHarness({
    stepStatus: 'RUNNING',
    currentStep: 'solution-design',
  });

  await harness.lifecycle.onStepComplete(7, 'solution-design', { summary: '   ' });

  const stepUpdate = harness.stepUpdates.find((update) => update.updateData.status === 'COMPLETED');
  assert.ok(stepUpdate);
  assert.equal(stepUpdate.updateData.summary, null);
});

test.test('onStepComplete with non-string summary stores null', async () => {
  const harness = createLifecycleHarness({
    stepStatus: 'RUNNING',
    currentStep: 'solution-design',
  });

  await harness.lifecycle.onStepComplete(7, 'solution-design', { other: 'data' });

  const stepUpdate = harness.stepUpdates.find((update) => update.updateData.status === 'COMPLETED');
  assert.ok(stepUpdate);
  assert.equal(stepUpdate.updateData.summary, null);
});

test.test('onStepError marks step FAILED with error message', async () => {
  const harness = createLifecycleHarness({
    stepStatus: 'RUNNING',
    currentStep: 'solution-design',
  });

  harness.run.steps[0]!.session_id = 101;
  const session = { id: 101, status: 'RUNNING', executor_type: 'CLAUDE_CODE', agent_id: 11 };
  harness.sessions.set(101, session);

  const segment = { id: 201, session_id: 101, status: 'RUNNING' } as Record<string, unknown> & { id: number; session_id: number };
  harness.segments.push(segment);

  await harness.lifecycle.onStepError(7, 'solution-design', 'Agent process exited with code 1');

  const stepUpdate = harness.stepUpdates.find((update) => update.updateData.status === 'FAILED');
  assert.ok(stepUpdate);
  assert.equal(stepUpdate.updateData.error, 'Agent process exited with code 1');
  assert.ok(stepUpdate.updateData.completed_at);

  const sessionUpdate = harness.sessionUpdates.find((update) => update.updateData.status === 'FAILED');
  assert.ok(sessionUpdate);
  assert.equal(sessionUpdate.sessionId, 101);

  const segmentUpdate = harness.segmentUpdates.find((update) => update.updateData.status === 'FAILED');
  assert.ok(segmentUpdate);
  assert.equal(segmentUpdate.segmentId, 201);
});

test.test('onStepError with empty message defaults to "Step failed"', async () => {
  const harness = createLifecycleHarness({
    stepStatus: 'RUNNING',
    currentStep: 'solution-design',
  });

  await harness.lifecycle.onStepError(7, 'solution-design', '');

  const stepUpdate = harness.stepUpdates.find((update) => update.updateData.status === 'FAILED');
  assert.ok(stepUpdate);
  assert.equal(stepUpdate.updateData.error, 'Step failed');
});

test.test('onStepCancel marks step CANCELLED', async () => {
  const harness = createLifecycleHarness({
    stepStatus: 'RUNNING',
    currentStep: 'solution-design',
  });

  harness.run.steps[0]!.session_id = 101;
  const session = { id: 101, status: 'RUNNING', executor_type: 'CLAUDE_CODE', agent_id: 11 };
  harness.sessions.set(101, session);

  const segment = { id: 201, session_id: 101, status: 'RUNNING' } as Record<string, unknown> & { id: number; session_id: number };
  harness.segments.push(segment);

  await harness.lifecycle.onStepCancel(7, 'solution-design');

  const stepUpdate = harness.stepUpdates.find((update) => update.updateData.status === 'CANCELLED');
  assert.ok(stepUpdate);
  assert.equal(stepUpdate.updateData.error, 'Workflow cancelled');
  assert.ok(stepUpdate.updateData.completed_at);

  const sessionUpdate = harness.sessionUpdates.find((update) => update.updateData.status === 'CANCELLED');
  assert.ok(sessionUpdate);
  assert.equal(sessionUpdate.sessionId, 101);

  const segmentUpdate = harness.segmentUpdates.find((update) => update.updateData.status === 'CANCELLED');
  assert.ok(segmentUpdate);
  assert.equal(segmentUpdate.segmentId, 201);
});

test.test('onUnexpectedError finalizes the currently running step as FAILED', async () => {
  const harness = createLifecycleHarness({
    stepStatus: 'RUNNING',
    currentStep: 'solution-design',
  });

  await harness.lifecycle.onUnexpectedError(7, 'Unexpected crash');

  const stepUpdate = harness.stepUpdates.find((update) => update.updateData.status === 'FAILED');
  assert.ok(stepUpdate);
  assert.equal(stepUpdate.stepId, 'solution-design');
  assert.equal(stepUpdate.updateData.error, 'Unexpected crash');
});

test.test('onUnexpectedError with empty message defaults to "Workflow failed"', async () => {
  const harness = createLifecycleHarness({
    stepStatus: 'RUNNING',
    currentStep: 'solution-design',
  });

  await harness.lifecycle.onUnexpectedError(7, '');

  const stepUpdate = harness.stepUpdates.find((update) => update.updateData.status === 'FAILED');
  assert.ok(stepUpdate);
  assert.equal(stepUpdate.updateData.error, 'Workflow failed');
});

test.test('onUnexpectedError is a no-op when no step is running', async () => {
  const harness = createLifecycleHarness({
    stepStatus: 'COMPLETED',
    currentStep: null,
  });

  await harness.lifecycle.onUnexpectedError(7, 'Unexpected crash');

  assert.equal(harness.stepUpdates.length, 0);
});

test.test('onStepStart skips if step is already cancelled', async () => {
  const harness = createLifecycleHarness({
    stepStatus: 'CANCELLED',
  });

  await harness.lifecycle.onStepStart(7, 'solution-design', harness.task);

  assert.equal(harness.sessionCreates.length, 0);
  assert.equal(harness.segmentCreates.length, 0);
  assert.equal(harness.stepUpdates.length, 0);
});

test.test('onStepComplete is a no-op when the step is already cancelled', async () => {
  const harness = createLifecycleHarness({
    stepStatus: 'CANCELLED',
  });

  await harness.lifecycle.onStepComplete(7, 'solution-design', { summary: 'Done' });

  assert.equal(harness.stepUpdates.length, 0);
  assert.equal(harness.sessionUpdates.length, 0);
});

test.test('onStepComplete is a no-op when the run is already cancelled', async () => {
  const harness = createLifecycleHarness({
    runStatus: 'CANCELLED',
    stepStatus: 'RUNNING',
  });

  await harness.lifecycle.onStepComplete(7, 'solution-design', { summary: 'Done' });

  assert.equal(harness.stepUpdates.length, 0);
});

// === onSessionAskUser tests ===

test.test('onSessionAskUser sets session to ASK_USER and suspends workflow run/step', async () => {
  const harness = createLifecycleHarness({
    runStatus: 'RUNNING',
    stepStatus: 'RUNNING',
    stepSessionId: 50,
    currentStep: 'solution-design',
  });

  // Pre-populate the session
  harness.sessions.set(50, { id: 50, status: 'RUNNING', task_id: 1 });
  // Pre-populate a running segment
  harness.segments.push({ id: 300, session_id: 50, status: 'RUNNING', trigger_type: 'START' } as any);

  await harness.lifecycle.onSessionAskUser(7, 'solution-design', {
    ask_user_question: {
      tool_use_id: 'toolu_123',
      questions: [{ question: 'Which approach?', options: [{ label: 'A', value: 'a' }] }],
    },
  });

  // Session should be ASK_USER
  assert.equal(harness.sessionUpdates.length, 1);
  assert.equal(harness.sessionUpdates[0]!.sessionId, 50);
  assert.equal(harness.sessionUpdates[0]!.updateData.status, 'ASK_USER');

  // Workflow run should be SUSPENDED
  assert.equal(harness.runUpdates.length, 1);
  assert.equal(harness.runUpdates[0]!.status, 'SUSPENDED');
  assert.equal(harness.runUpdates[0]!.current_step, 'solution-design');

  // Step should be SUSPENDED
  assert.equal(harness.stepUpdates.length, 1);
  assert.equal(harness.stepUpdates[0]!.updateData.status, 'SUSPENDED');

  // Segment should be set to ASK_USER
  assert.ok(harness.segmentUpdates.some((u) => u.updateData.status === 'ASK_USER'));

  // Session event should contain the ask_user question
  const askUserEvent = harness.eventAppends.find((e) => e.kind === 'ask_user');
  assert.ok(askUserEvent, 'ask_user event should be saved');
  assert.equal(askUserEvent!.role, 'assistant');
  assert.ok((askUserEvent!.payload as Record<string, unknown>)?.ask_user_question);
});

test.test('onSessionAskUser does not set completed_at on session', async () => {
  const harness = createLifecycleHarness({
    runStatus: 'RUNNING',
    stepStatus: 'RUNNING',
    stepSessionId: 50,
    currentStep: 'solution-design',
  });

  harness.sessions.set(50, { id: 50, status: 'RUNNING', task_id: 1 });
  harness.segments.push({ id: 300, session_id: 50, status: 'RUNNING', trigger_type: 'START' } as any);

  await harness.lifecycle.onSessionAskUser(7, 'solution-design', {
    ask_user_question: { tool_use_id: 'toolu_abc', questions: [] },
  });

  const sessionUpdate = harness.sessionUpdates.find((u) => u.sessionId === 50);
  assert.ok(sessionUpdate, 'session should be updated');
  assert.equal(sessionUpdate!.updateData.status, 'ASK_USER');
  assert.equal(sessionUpdate!.updateData.completed_at, undefined, 'completed_at must not be set while session is still active');
});

test.test('onStepComplete finalizes ASK_USER segment to COMPLETED', async () => {
  const harness = createLifecycleHarness({
    runStatus: 'RUNNING',
    stepStatus: 'RUNNING',
    currentStep: 'solution-design',
  });

  harness.run.steps[0]!.session_id = 101;
  const session = { id: 101, status: 'RUNNING', executor_type: 'CLAUDE_CODE', agent_id: 11 };
  harness.sessions.set(101, session);

  // Segment is in ASK_USER status (set by onSessionAskUser during the step)
  const segment = { id: 201, session_id: 101, status: 'ASK_USER' } as Record<string, unknown> & { id: number; session_id: number };
  harness.segments.push(segment);

  await harness.lifecycle.onStepComplete(7, 'solution-design', { summary: 'Done after answering question' });

  const segmentUpdate = harness.segmentUpdates.find((u) => u.segmentId === 201);
  assert.ok(segmentUpdate, 'ASK_USER segment should be finalized');
  assert.equal(segmentUpdate!.updateData.status, 'COMPLETED', 'ASK_USER segment should become COMPLETED');
});
