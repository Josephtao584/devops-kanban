import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { executeWorkflowStep } from '../../src/services/workflow/workflowStepExecutor.js';
import { AgentExecutorRegistry } from '../../src/services/workflow/agentExecutorRegistry.js';
import { ExecutorType } from '../../src/types/executors.js';
import type {
  Executor,
  ExecutorExecutionInput,
  ExecutorExecutionResult,
} from '../../src/types/executors.js';
import type { AgentEntity, WorkflowInstanceEntity } from '../../src/types/entities.ts';

// Stub executor that captures the prompt and returns a successful raw result.
function makeStubExecutor() {
  let capturedPrompt: string | null = null;
  const executor: Executor = {
    async execute(input: ExecutorExecutionInput): Promise<ExecutorExecutionResult> {
      capturedPrompt = input.prompt;
      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
        proc: null,
        rawResult: { summary: 'stub summary' },
      };
    },
    async continue(): Promise<ExecutorExecutionResult> {
      throw new Error('continue should not be called in this test');
    },
  };
  return {
    executor,
    getCapturedPrompt: () => capturedPrompt,
  };
}

function makeRegistry(executor: Executor): AgentExecutorRegistry {
  return new AgentExecutorRegistry({
    executors: {
      [ExecutorType.CLAUDE_CODE]: executor,
      [ExecutorType.OPEN_CODE]: executor,
    },
  });
}

const stubAgent: AgentEntity = {
  id: 1,
  name: 'StubAgent',
  executorType: ExecutorType.CLAUDE_CODE,
  role: 'tester',
  description: 'stub',
  enabled: true,
  skills: [],
  mcpServers: [],
  env: {},
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const stubAgentRepo = {
  findById: async (id: number) => (id === stubAgent.id ? stubAgent : null),
} as any;

const workflowInstance = {
  id: 1,
  instance_id: 'inst-1',
  template_id: 'tpl-1',
  template_version: 'v1',
  name: 'Test Instance',
  steps: [
    { id: 'step1', name: 'S1', agentId: 1, instructionPrompt: 'do step 1' },
    { id: 'step2', name: 'S2', agentId: 1, instructionPrompt: 'do step 2' },
  ],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
} as unknown as WorkflowInstanceEntity;

const baseState = {
  taskTitle: 'Title',
  taskDescription: 'Description',
  worktreePath: '/tmp/wt',
};

test.test('executeWorkflowStep prepends escaped loop context for matching step and persists via onAssembledPrompt', async () => {
  const { executor, getCapturedPrompt } = makeStubExecutor();
  const registry = makeRegistry(executor);

  let persistedPrompt: string | null = null;
  const loopContextText = '## 循环上下文\n失败原因：boom';

  await executeWorkflowStep({
    registry,
    agentRepo: stubAgentRepo,
    workflowInstance,
    stepId: 'step1',
    worktreePath: '/tmp/wt',
    state: baseState,
    inputData: {},
    onAssembledPrompt: (prompt) => {
      persistedPrompt = prompt;
    },
    loopContextText,
  });

  const expectedEscapedLoop = loopContextText.replaceAll('\n', '\\n');

  // The persisted prompt is what onAssembledPrompt receives.
  const captured: string = persistedPrompt ?? '';
  assert.ok(captured, 'onAssembledPrompt should have been called');
  assert.ok(
    captured.startsWith(`${expectedEscapedLoop}\\n`),
    `persisted prompt should start with escaped loop context, got: ${captured.slice(0, 120)}`,
  );

  // The captured prompt sent to the executor must match the persisted one.
  assert.equal(getCapturedPrompt(), captured);

  // The whole prompt must be uniformly escaped (no real newlines anywhere).
  assert.ok(
    !captured.includes('\n'),
    'persisted prompt must not contain raw newlines after escaping',
  );
});

test.test('executeWorkflowStep does not prepend loop context when loopContextText is undefined', async () => {
  const { executor, getCapturedPrompt } = makeStubExecutor();
  const registry = makeRegistry(executor);

  let persistedPrompt: string | null = null;

  await executeWorkflowStep({
    registry,
    agentRepo: stubAgentRepo,
    workflowInstance,
    stepId: 'step2',
    worktreePath: '/tmp/wt',
    state: baseState,
    inputData: {},
    onAssembledPrompt: (prompt) => {
      persistedPrompt = prompt;
    },
    // loopContextText intentionally omitted: simulates a non-matching step in
    // the loop run (caller only passes loopContextText when fromStepId matches).
  });

  const captured: string = persistedPrompt ?? '';
  assert.ok(captured, 'onAssembledPrompt should have been called');
  assert.ok(
    !captured.includes('循环上下文'),
    'prompt should not contain loop preamble when loopContextText is omitted',
  );
  assert.ok(
    !captured.startsWith('##'),
    'prompt should not start with the loop preamble heading',
  );
  assert.equal(getCapturedPrompt(), captured);
});
