import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { ExecutionEventSink } from '../src/services/workflow/executionEventSink.js';
import { executeWorkflowStep } from '../src/services/workflow/workflowStepExecutor.js';
import type {
  ExecutorExecutionInput,
  ExecutorMap,
  ExecutorProcessHandle,
  ExecutorProviderState,
  ExecutorRawResult,
  WorkflowExecutionEvent,
} from '../src/types/executors.js';

const sharedState = {
  taskTitle: '测试任务',
  taskDescription: '测试描述',
  worktreePath: '/tmp/worktree',
};

function createStep(agentId: number | null) {
  return {
    id: 'requirement-design',
    name: '需求设计',
    instructionPrompt: '先完成需求分析和设计拆解。',
    agentId,
  };
}

function createTemplateService(step = createStep(7)) {
  return {
    async getTemplate() {
      return {
        template_id: 'dev-workflow-v1',
        steps: [step],
      };
    },
  };
}

function createInputOverrides() {
  return {
    stepId: 'requirement-design',
    worktreePath: sharedState.worktreePath,
    state: sharedState,
    inputData: {
      taskId: 1,
      taskTitle: sharedState.taskTitle,
      taskDescription: sharedState.taskDescription,
      worktreePath: sharedState.worktreePath,
    },
    upstreamStepIds: [],
  };
}

function createAgent(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    name: 'Codex Designer',
    executorType: 'CODEX',
    commandOverride: 'codex run',
    args: ['--json'],
    env: { MODE: 'strict' },
    skills: ['design'],
    enabled: true,
    ...overrides,
  };
}

test.test('ExecutionEventSink emits canonical workflow events and provider state updates', () => {
  const events: WorkflowExecutionEvent[] = [];
  const providerStates: ExecutorProviderState[] = [];
  const sink = new ExecutionEventSink({
    onEvent(event) {
      events.push(event);
    },
    onProviderState(providerState) {
      providerStates.push(providerState);
    },
  });

  sink.status('step started', { stepId: 'requirement-design' });
  sink.message('drafted design', { summary: 'ok' });
  sink.toolCall('npm test', { toolName: 'shell' });
  sink.toolResult('tests passed', { exitCode: 0 });
  sink.streamChunk('partial output', { stream: 'stdout' });
  sink.artifact('design.md', { path: '/tmp/design.md' });
  sink.error('step failed', { code: 'E_STEP' });
  sink.providerState({
    providerSessionId: 'provider-session-1',
    resumeToken: 'resume-token-1',
    checkpointRef: 'checkpoint-1',
  });

  assert.deepEqual(events, [
    { kind: 'status', role: 'system', content: 'step started', payload: { stepId: 'requirement-design' } },
    { kind: 'message', role: 'assistant', content: 'drafted design', payload: { summary: 'ok' } },
    { kind: 'tool_call', role: 'assistant', content: 'npm test', payload: { toolName: 'shell' } },
    { kind: 'tool_result', role: 'tool', content: 'tests passed', payload: { exitCode: 0 } },
    { kind: 'stream_chunk', role: 'assistant', content: 'partial output', payload: { stream: 'stdout' } },
    { kind: 'artifact', role: 'assistant', content: 'design.md', payload: { path: '/tmp/design.md' } },
    { kind: 'error', role: 'system', content: 'step failed', payload: { code: 'E_STEP' } },
  ]);
  assert.deepEqual(providerStates, [
    {
      providerSessionId: 'provider-session-1',
      resumeToken: 'resume-token-1',
      checkpointRef: 'checkpoint-1',
    },
  ]);
});

test.test('executeWorkflowStep forwards sink-driven canonical events and provider state updates', async () => {
  const proc: ExecutorProcessHandle = {
    kill() {
      return true;
    },
  };
  const context: { proc?: ExecutorProcessHandle | null } = {};
  const events: WorkflowExecutionEvent[] = [];
  const providerStates: ExecutorProviderState[] = [];
  const templateService = createTemplateService();
  const agentRepo = {
    async findById(id: number) {
      assert.equal(id, 7);
      return createAgent();
    },
  };
  const registry = {
    getExecutor(type: keyof ExecutorMap) {
      assert.equal(type, 'CODEX');
      return {
        async execute(input: ExecutorExecutionInput) {
          const {
            prompt,
            worktreePath,
            executorConfig,
            onSpawn,
          } = input;
          const { onEvent, onProviderState } = input as ExecutorExecutionInput & {
            onEvent?: (event: WorkflowExecutionEvent) => void;
            onProviderState?: (providerState: ExecutorProviderState) => void;
          };

          assert.equal(worktreePath, sharedState.worktreePath);
          assert.match(prompt, /当前步骤：需求设计/);
          assert.deepEqual(executorConfig, {
            type: 'CODEX',
            commandOverride: 'codex run',
            args: ['--json'],
            env: { MODE: 'strict' },
            skills: ['design'],
          });
          onSpawn?.(proc);
          onEvent?.({ kind: 'status', role: 'system', content: 'step started', payload: { stepId: 'requirement-design' } });
          onEvent?.({ kind: 'stream_chunk', role: 'assistant', content: 'partial output', payload: { stream: 'stdout' } });
          onProviderState?.({
            providerSessionId: 'provider-session-1',
            resumeToken: 'resume-token-1',
            checkpointRef: 'checkpoint-1',
          });
          const rawResult: ExecutorRawResult = { summary: 'ok' };
          return { exitCode: 0, stdout: '', stderr: '', rawResult, proc };
        },
      };
    },
  };

  const result = await executeWorkflowStep({
    templateService: templateService as never,
    agentRepo: agentRepo as never,
    registry: registry as never,
    context,
    onEvent(event) {
      events.push(event);
    },
    onProviderState(providerState) {
      providerStates.push(providerState);
    },
    ...createInputOverrides(),
  });

  assert.equal(context.proc, proc);
  assert.deepEqual(events, [
    { kind: 'status', role: 'system', content: 'step started', payload: { stepId: 'requirement-design' } },
    { kind: 'stream_chunk', role: 'assistant', content: 'partial output', payload: { stream: 'stdout' } },
  ]);
  assert.deepEqual(providerStates, [
    {
      providerSessionId: 'provider-session-1',
      resumeToken: 'resume-token-1',
      checkpointRef: 'checkpoint-1',
    },
  ]);
  assert.deepEqual(result, { summary: 'ok' });
});

test.test('executeWorkflowStep fails when the bound step agent is disabled', async () => {
  const templateService = createTemplateService();
  const agentRepo = {
    async findById(id: number) {
      assert.equal(id, 7);
      return createAgent({ enabled: false, name: 'Disabled Codex Designer', commandOverride: null, args: [], env: {}, skills: [] });
    },
  };

  await assert.rejects(
    () => executeWorkflowStep({
      templateService: templateService as never,
      agentRepo: agentRepo as never,
      ...createInputOverrides(),
    }),
    /disabled/
  );
});

test.test('executeWorkflowStep fails when the step is unbound', async () => {
  const templateService = createTemplateService(createStep(null));

  await assert.rejects(
    () => executeWorkflowStep({
      templateService: templateService as never,
      ...createInputOverrides(),
    }),
    /does not have a bound agent/
  );
});

test.test('executeWorkflowStep fails when the bound agent record is missing', async () => {
  const templateService = createTemplateService();
  const agentRepo = {
    async findById(id: number) {
      assert.equal(id, 7);
      return null;
    },
  };

  await assert.rejects(
    () => executeWorkflowStep({
      templateService: templateService as never,
      agentRepo: agentRepo as never,
      ...createInputOverrides(),
    }),
    /missing agent/
  );
});

test.test('executeWorkflowStep fails when the persisted agent args config is invalid', async () => {
  const templateService = createTemplateService();
  const agentRepo = {
    async findById(id: number) {
      assert.equal(id, 7);
      return createAgent({ name: 'Broken Args Agent', args: ['--json', 1] as never });
    },
  };

  await assert.rejects(
    () => executeWorkflowStep({
      templateService: templateService as never,
      agentRepo: agentRepo as never,
      ...createInputOverrides(),
    }),
    /invalid args configuration/
  );
});

test.test('executeWorkflowStep fails when the persisted agent executor type is invalid', async () => {
  const templateService = createTemplateService();
  const agentRepo = {
    async findById(id: number) {
      assert.equal(id, 7);
      return createAgent({ name: 'Broken Type Agent', executorType: 'INVALID_EXECUTOR' });
    },
  };

  await assert.rejects(
    () => executeWorkflowStep({
      templateService: templateService as never,
      agentRepo: agentRepo as never,
      ...createInputOverrides(),
    }),
    /unsupported executor type/
  );
});

test.test('executeWorkflowStep fails when the persisted agent command override is invalid', async () => {
  const templateService = createTemplateService();
  const agentRepo = {
    async findById(id: number) {
      assert.equal(id, 7);
      return createAgent({ name: 'Broken Command Agent', commandOverride: '   ' });
    },
  };

  await assert.rejects(
    () => executeWorkflowStep({
      templateService: templateService as never,
      agentRepo: agentRepo as never,
      ...createInputOverrides(),
    }),
    /invalid command override/
  );
});

test.test('executeWorkflowStep fails when the persisted agent env config is invalid', async () => {
  const templateService = createTemplateService();
  const agentRepo = {
    async findById(id: number) {
      assert.equal(id, 7);
      return createAgent({ name: 'Broken Env Agent', env: { MODE: 1 } as never });
    },
  };

  await assert.rejects(
    () => executeWorkflowStep({
      templateService: templateService as never,
      agentRepo: agentRepo as never,
      ...createInputOverrides(),
    }),
    /invalid env configuration/
  );
});

test.test('executeWorkflowStep fails when the persisted agent skills config is invalid', async () => {
  const templateService = createTemplateService();
  const agentRepo = {
    async findById(id: number) {
      assert.equal(id, 7);
      return createAgent({ name: 'Broken Skills Agent', skills: ['design', 1] as never });
    },
  };

  await assert.rejects(
    () => executeWorkflowStep({
      templateService: templateService as never,
      agentRepo: agentRepo as never,
      ...createInputOverrides(),
    }),
    /invalid skills configuration/
  );
});

