import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { ExecutionEventSink } from '../src/services/workflow/executionEventSink.js';
import { ClaudeCodeExecutor } from '../src/services/workflow/executors/claudeCodeExecutor.js';
import { CodexExecutor } from '../src/services/workflow/executors/codexExecutor.js';
import { OpenCodeExecutor } from '../src/services/workflow/executors/opencodeExecutor.js';
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

test.test('ExecutionEventSink exposes canonical append helpers and awaits async callbacks', async () => {
  const events: WorkflowExecutionEvent[] = [];
  const providerStates: ExecutorProviderState[] = [];
  const callbackOrder: string[] = [];
  const sink = new ExecutionEventSink({
    async onEvent(event) {
      callbackOrder.push(`start:${event.kind}`);
      await Promise.resolve();
      events.push(event);
      callbackOrder.push(`end:${event.kind}`);
    },
    async onProviderState(providerState) {
      callbackOrder.push('start:provider');
      await Promise.resolve();
      providerStates.push(providerState);
      callbackOrder.push('end:provider');
    },
  });

  await sink.appendMessage('drafted design');
  await sink.appendMessage('operator note', 'system');
  await sink.appendToolCall('npm test', { cwd: '/tmp/worktree' });
  await sink.appendToolResult('npm test', { exitCode: 0 });
  await sink.appendStatus('QUEUED', 'RUNNING');
  await sink.appendError('step failed', { code: 'E_STEP' });
  await sink.appendArtifact('design.md', { artifact_type: 'file', ref: '/tmp/design.md' });
  await sink.appendStreamChunk('partial output', 'stdout');
  await sink.appendStreamChunk('stderr output', 'stderr');
  await sink.append({ kind: 'message', role: 'assistant', content: 'raw event', payload: { traceId: 'trace-1' } });
  await sink.appendProviderState({
    providerSessionId: 'provider-session-1',
    resumeToken: 'resume-token-1',
    checkpointRef: 'checkpoint-1',
  });

  assert.deepEqual(events, [
    { kind: 'message', role: 'assistant', content: 'drafted design', payload: {} },
    { kind: 'message', role: 'system', content: 'operator note', payload: {} },
    { kind: 'tool_call', role: 'assistant', content: 'npm test', payload: { tool_name: 'npm test', arguments: { cwd: '/tmp/worktree' } } },
    { kind: 'tool_result', role: 'tool', content: 'npm test', payload: { tool_name: 'npm test', result: { exitCode: 0 } } },
    { kind: 'status', role: 'system', content: 'QUEUED -> RUNNING', payload: { from: 'QUEUED', to: 'RUNNING' } },
    { kind: 'error', role: 'system', content: 'step failed', payload: { code: 'E_STEP' } },
    { kind: 'artifact', role: 'assistant', content: 'design.md', payload: { artifact_type: 'file', ref: '/tmp/design.md' } },
    { kind: 'stream_chunk', role: 'assistant', content: 'partial output', payload: { stream: 'stdout' } },
    { kind: 'stream_chunk', role: 'system', content: 'stderr output', payload: { stream: 'stderr' } },
    { kind: 'message', role: 'assistant', content: 'raw event', payload: { traceId: 'trace-1' } },
  ]);
  assert.deepEqual(providerStates, [
    {
      providerSessionId: 'provider-session-1',
      resumeToken: 'resume-token-1',
      checkpointRef: 'checkpoint-1',
    },
  ]);
  assert.deepEqual(callbackOrder, [
    'start:message',
    'end:message',
    'start:message',
    'end:message',
    'start:tool_call',
    'end:tool_call',
    'start:tool_result',
    'end:tool_result',
    'start:status',
    'end:status',
    'start:error',
    'end:error',
    'start:artifact',
    'end:artifact',
    'start:stream_chunk',
    'end:stream_chunk',
    'start:stream_chunk',
    'end:stream_chunk',
    'start:message',
    'end:message',
    'start:provider',
    'end:provider',
  ]);
});

test.test('ExecutionEventSink normalizes raw executor events through append', async () => {
  const events: WorkflowExecutionEvent[] = [];
  const sink = new ExecutionEventSink({
    async onEvent(event) {
      events.push(event);
    },
  });

  await sink.append({ kind: 'tool_call', role: 'user', content: 'shell', payload: { arguments: { cwd: '/tmp/worktree' }, traceId: 'trace-1' } });
  await sink.append({ kind: 'tool_result', role: 'assistant', content: 'shell', payload: { result: { exitCode: 0 }, traceId: 'trace-2' } });
  await sink.append({ kind: 'status', role: 'assistant', content: 'ignored status', payload: { from: 'QUEUED', to: 'RUNNING', traceId: 'trace-3' } });
  await sink.append({ kind: 'artifact', role: 'system', content: 'design.md', payload: { artifact_type: 'file' } });
  await sink.append({ kind: 'stream_chunk', role: 'user', content: 'stderr output', payload: { stream: 'stderr', source: 'pty' } });
  await sink.append({ kind: 'message', role: 'user', content: 'raw note' });

  assert.deepEqual(events, [
    { kind: 'tool_call', role: 'assistant', content: 'shell', payload: { tool_name: 'shell', arguments: { cwd: '/tmp/worktree' }, traceId: 'trace-1' } },
    { kind: 'tool_result', role: 'tool', content: 'shell', payload: { tool_name: 'shell', result: { exitCode: 0 }, traceId: 'trace-2' } },
    { kind: 'status', role: 'system', content: 'QUEUED -> RUNNING', payload: { from: 'QUEUED', to: 'RUNNING', traceId: 'trace-3' } },
    { kind: 'artifact', role: 'assistant', content: 'design.md', payload: { artifact_type: 'file' } },
    { kind: 'stream_chunk', role: 'system', content: 'stderr output', payload: { stream: 'stderr', source: 'pty' } },
    { kind: 'message', role: 'user', content: 'raw note', payload: {} },
  ]);
});


test.test('ClaudeCodeExecutor suppresses duplicate summary events when parsed summary matches stdout', async () => {
  const proc: ExecutorProcessHandle = {
    kill() {
      return true;
    },
  };
  const events: WorkflowExecutionEvent[] = [];
  const providerStates: ExecutorProviderState[] = [];
  const executor = new ClaudeCodeExecutor({
    runner: {
      async runStep() {
        return {
          exitCode: 0,
          stdout: 'same content\n',
          stderr: 'stderr chunk',
          parsedResult: { summary: 'same content' },
          proc,
        };
      },
    } as never,
  });

  const result = await executor.execute({
    prompt: 'prompt body',
    worktreePath: sharedState.worktreePath,
    executorConfig: { type: 'CLAUDE_CODE' },
    async onEvent(event) {
      events.push(event);
    },
    async onProviderState(providerState) {
      providerStates.push(providerState);
    },
  });

  assert.deepEqual(events, [
    { kind: 'stream_chunk', role: 'assistant', content: 'same content\n', payload: { stream: 'stdout' } },
    { kind: 'stream_chunk', role: 'system', content: 'stderr chunk', payload: { stream: 'stderr' } },
  ]);
  assert.deepEqual(providerStates, []);
  assert.deepEqual(result, {
    exitCode: 0,
    stdout: 'same content\n',
    stderr: 'stderr chunk',
    proc,
    rawResult: { summary: 'same content' },
  });
});

test.test('ClaudeCodeExecutor emits parsed summary when it differs from stdout', async () => {
  const proc: ExecutorProcessHandle = {
    kill() {
      return true;
    },
  };
  const events: WorkflowExecutionEvent[] = [];
  const providerStates: ExecutorProviderState[] = [];
  const executor = new ClaudeCodeExecutor({
    runner: {
      async runStep() {
        return {
          exitCode: 0,
          stdout: 'stdout chunk',
          stderr: 'stderr chunk',
          parsedResult: { summary: 'final summary' },
          proc,
        };
      },
    } as never,
  });

  const result = await executor.execute({
    prompt: 'prompt body',
    worktreePath: sharedState.worktreePath,
    executorConfig: { type: 'CLAUDE_CODE' },
    async onEvent(event) {
      events.push(event);
    },
    async onProviderState(providerState) {
      providerStates.push(providerState);
    },
  });

  assert.deepEqual(events, [
    { kind: 'stream_chunk', role: 'assistant', content: 'stdout chunk', payload: { stream: 'stdout' } },
    { kind: 'stream_chunk', role: 'system', content: 'stderr chunk', payload: { stream: 'stderr' } },
    { kind: 'message', role: 'assistant', content: 'final summary', payload: {} },
  ]);
  assert.deepEqual(providerStates, []);
  assert.deepEqual(result, {
    exitCode: 0,
    stdout: 'stdout chunk',
    stderr: 'stderr chunk',
    proc,
    rawResult: { summary: 'final summary' },
  });
});

test.test('executor adapters emit sink-normalized canonical session events for raw textual streams', async () => {
  const codexEvents: WorkflowExecutionEvent[] = [];
  const codexExecutor = new CodexExecutor({
    runImpl: async () => ({
      summary: 'codex summary',
      events: [
        { kind: 'message', role: 'assistant', content: 'planning', payload: { phase: 'plan' } },
        { kind: 'stdout', role: 'assistant', content: 'raw stdout chunk', payload: { source: 'pty' } },
        { kind: 'stderr', role: 'system', content: 'raw stderr chunk', payload: { source: 'pty' } },
      ],
    } as ExecutorRawResult),
  });

  const codexResult = await codexExecutor.execute({
    prompt: 'prompt body',
    worktreePath: sharedState.worktreePath,
    executorConfig: { type: 'CODEX' },
    async onEvent(event) {
      codexEvents.push(event);
    },
  });

  assert.deepEqual(codexEvents, [
    { kind: 'message', role: 'assistant', content: 'planning', payload: { phase: 'plan' } },
    { kind: 'stream_chunk', role: 'assistant', content: 'raw stdout chunk', payload: { stream: 'stdout', source: 'pty' } },
    { kind: 'stream_chunk', role: 'system', content: 'raw stderr chunk', payload: { stream: 'stderr', source: 'pty' } },
  ]);
  assert.deepEqual(codexResult.rawResult, {
    summary: 'codex summary',
    events: [
      { kind: 'message', role: 'assistant', content: 'planning', payload: { phase: 'plan' } },
      { kind: 'stream_chunk', role: 'assistant', content: 'raw stdout chunk', payload: { stream: 'stdout', source: 'pty' } },
      { kind: 'stream_chunk', role: 'system', content: 'raw stderr chunk', payload: { stream: 'stderr', source: 'pty' } },
    ],
  });

  const openCodeEvents: WorkflowExecutionEvent[] = [];
  const openCodeExecutor = new OpenCodeExecutor({
    runImpl: async () => ({
      summary: 'opencode summary',
      events: [
        { kind: 'status', role: 'system', content: 'ignored', payload: { from: 'QUEUED', to: 'RUNNING', traceId: 'trace-3' } },
        { kind: 'stderr', role: 'assistant', content: 'raw tool stderr', payload: { source: 'pty' } },
      ],
    } as ExecutorRawResult),
  });

  const openCodeResult = await openCodeExecutor.execute({
    prompt: 'prompt body',
    worktreePath: sharedState.worktreePath,
    executorConfig: { type: 'OPENCODE' },
    async onEvent(event) {
      openCodeEvents.push(event);
    },
  });

  assert.deepEqual(openCodeEvents, [
    { kind: 'status', role: 'system', content: 'QUEUED -> RUNNING', payload: { from: 'QUEUED', to: 'RUNNING', traceId: 'trace-3' } },
    { kind: 'stream_chunk', role: 'system', content: 'raw tool stderr', payload: { stream: 'stderr', source: 'pty' } },
  ]);
  assert.deepEqual(openCodeResult.rawResult, {
    summary: 'opencode summary',
    events: [
      { kind: 'status', role: 'system', content: 'QUEUED -> RUNNING', payload: { from: 'QUEUED', to: 'RUNNING', traceId: 'trace-3' } },
      { kind: 'stream_chunk', role: 'system', content: 'raw tool stderr', payload: { stream: 'stderr', source: 'pty' } },
    ],
  });
});

test.test('executor adapters drop raw events when normalization yields no canonical events', async () => {
  const codexEvents: WorkflowExecutionEvent[] = [];
  const codexExecutor = new CodexExecutor({
    runImpl: async () => ({
      summary: 'codex summary',
      events: [
        { kind: 'unknown', role: 'assistant', content: 'ignored event' },
        { kind: 'stdout', role: 'assistant' },
        { kind: 'message', role: 'assistant', content: 1 },
      ],
    } as unknown as ExecutorRawResult),
  });

  const codexResult = await codexExecutor.execute({
    prompt: 'prompt body',
    worktreePath: sharedState.worktreePath,
    executorConfig: { type: 'CODEX' },
    async onEvent(event) {
      codexEvents.push(event);
    },
  });

  assert.deepEqual(codexEvents, []);
  assert.deepEqual(codexResult.rawResult, {
    summary: 'codex summary',
    events: [],
  });
});

test.test('executeWorkflowStep forwards executor events through the sink canonicalization path', async () => {
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
            onEvent,
            onProviderState,
          } = input;

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
          await onEvent?.({ kind: 'message', role: 'assistant', content: 'drafted design', payload: {} });
          await onEvent?.({ kind: 'tool_call', role: 'user', content: 'shell', payload: { arguments: { cwd: '/tmp/worktree' }, traceId: 'trace-1' } });
          await onEvent?.({ kind: 'tool_result', role: 'assistant', content: 'shell', payload: { result: { exitCode: 0 }, traceId: 'trace-2' } });
          await onEvent?.({ kind: 'status', role: 'assistant', content: 'step started', payload: { from: 'QUEUED', to: 'RUNNING', traceId: 'trace-3' } });
          await onEvent?.({ kind: 'artifact', role: 'system', content: 'design.md', payload: { artifact_type: 'file', ref: '/tmp/design.md' } });
          await onEvent?.({ kind: 'stream_chunk', role: 'user', content: 'partial output', payload: { stream: 'stdout', source: 'pty' } });
          await onEvent?.({ kind: 'error', role: 'assistant', content: 'step failed', payload: { code: 'E_STEP', traceId: 'trace-4' } });
          await onProviderState?.({
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
    async onEvent(event) {
      events.push(event);
    },
    async onProviderState(providerState) {
      providerStates.push(providerState);
    },
    ...createInputOverrides(),
  });

  assert.equal(context.proc, proc);
  assert.deepEqual(events, [
    { kind: 'message', role: 'assistant', content: 'drafted design', payload: {} },
    { kind: 'tool_call', role: 'assistant', content: 'shell', payload: { tool_name: 'shell', arguments: { cwd: '/tmp/worktree' }, traceId: 'trace-1' } },
    { kind: 'tool_result', role: 'tool', content: 'shell', payload: { tool_name: 'shell', result: { exitCode: 0 }, traceId: 'trace-2' } },
    { kind: 'status', role: 'system', content: 'QUEUED -> RUNNING', payload: { from: 'QUEUED', to: 'RUNNING', traceId: 'trace-3' } },
    { kind: 'artifact', role: 'assistant', content: 'design.md', payload: { artifact_type: 'file', ref: '/tmp/design.md' } },
    { kind: 'stream_chunk', role: 'assistant', content: 'partial output', payload: { stream: 'stdout', source: 'pty' } },
    { kind: 'error', role: 'system', content: 'step failed', payload: { code: 'E_STEP', traceId: 'trace-4' } },
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

