import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { executeWorkflowStep } from '../src/services/workflow/workflowStepExecutor.js';
import type { ExecutorExecutionInput, ExecutorMap, ExecutorProcessHandle, ExecutorRawResult } from '../src/types/executors.js';
import type { WorkflowTemplate } from '../src/services/workflow/workflowTemplateService.js';

const sharedState = {
  taskTitle: '测试任务',
  taskDescription: '测试描述',
  worktreePath: '/tmp/worktree',
};

function createTemplate(stepOverrides: Partial<WorkflowTemplate['steps'][number]> = {}): WorkflowTemplate {
  return {
    template_id: 'quick-fix-v1',
    name: '快速修复工作流',
    steps: [
      {
        id: 'triage',
        name: '问题定位',
        instructionPrompt: '先完成问题定位和修复策略整理。',
        agentId: 7,
        ...stepOverrides,
      },
    ],
  };
}

function createInputOverrides() {
  return {
    stepId: 'triage',
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

test.test('executeWorkflowStep resolves executor from the run-selected snapshot step agent', async () => {
  const proc: ExecutorProcessHandle = {
    kill() {
      return true;
    },
  };
  const context: { proc?: ExecutorProcessHandle | null } = {};
  const templateSnapshot = createTemplate();
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
        async execute({ prompt, worktreePath, executorConfig, onSpawn }: ExecutorExecutionInput) {
          assert.equal(worktreePath, sharedState.worktreePath);
          assert.match(prompt, /当前步骤：问题定位/);
          assert.match(prompt, /本步骤要求：\n先完成问题定位和修复策略整理。/);
          assert.deepEqual(executorConfig, {
            type: 'CODEX',
            commandOverride: 'codex run',
            args: ['--json'],
            env: { MODE: 'strict' },
            skills: ['design'],
          });
          onSpawn?.(proc);
          const rawResult: ExecutorRawResult = { summary: 'ok' };
          return { exitCode: 0, stdout: '', stderr: '', rawResult, proc };
        },
      };
    },
  };

  const result = await executeWorkflowStep({
    templateSnapshot,
    agentRepo: agentRepo as never,
    registry: registry as never,
    context,
    ...createInputOverrides(),
  });

  assert.equal(context.proc, proc);
  assert.deepEqual(result, { summary: 'ok' });
});

test.test('executeWorkflowStep requires a persisted template snapshot', async () => {
  await assert.rejects(
    () => executeWorkflowStep({
      ...createInputOverrides(),
    }),
    /template snapshot is required/
  );
});

test.test('executeWorkflowStep fails when the run snapshot step is unbound', async () => {
  const templateSnapshot = createTemplate({ agentId: null });

  await assert.rejects(
    () => executeWorkflowStep({
      templateSnapshot,
      ...createInputOverrides(),
    }),
    /does not have a bound agent/
  );
});

test.test('executeWorkflowStep fails when the run snapshot step is missing', async () => {
  const templateSnapshot = createTemplate({ id: 'investigate' });

  await assert.rejects(
    () => executeWorkflowStep({
      templateSnapshot,
      ...createInputOverrides(),
    }),
    /Workflow template step not found: triage/
  );
});

test.test('executeWorkflowStep fails when the bound agent record is missing', async () => {
  const templateSnapshot = createTemplate();
  const agentRepo = {
    async findById(id: number) {
      assert.equal(id, 7);
      return null;
    },
  };

  await assert.rejects(
    () => executeWorkflowStep({
      templateSnapshot,
      agentRepo: agentRepo as never,
      ...createInputOverrides(),
    }),
    /missing agent/
  );
});

test.test('executeWorkflowStep fails when the bound step agent is disabled', async () => {
  const templateSnapshot = createTemplate();
  const agentRepo = {
    async findById(id: number) {
      assert.equal(id, 7);
      return createAgent({ enabled: false, name: 'Disabled Codex Designer', commandOverride: null, args: [], env: {}, skills: [] });
    },
  };

  await assert.rejects(
    () => executeWorkflowStep({
      templateSnapshot,
      agentRepo: agentRepo as never,
      ...createInputOverrides(),
    }),
    /disabled/
  );
});

test.test('executeWorkflowStep fails when the persisted agent args config is invalid', async () => {
  const templateSnapshot = createTemplate();
  const agentRepo = {
    async findById(id: number) {
      assert.equal(id, 7);
      return createAgent({ name: 'Broken Args Agent', args: ['--json', 1] as never });
    },
  };

  await assert.rejects(
    () => executeWorkflowStep({
      templateSnapshot,
      agentRepo: agentRepo as never,
      ...createInputOverrides(),
    }),
    /invalid args configuration/
  );
});

test.test('executeWorkflowStep fails when the persisted agent executor type is invalid', async () => {
  const templateSnapshot = createTemplate();
  const agentRepo = {
    async findById(id: number) {
      assert.equal(id, 7);
      return createAgent({ name: 'Broken Type Agent', executorType: 'INVALID_EXECUTOR' });
    },
  };

  await assert.rejects(
    () => executeWorkflowStep({
      templateSnapshot,
      agentRepo: agentRepo as never,
      ...createInputOverrides(),
    }),
    /unsupported executor type/
  );
});

test.test('executeWorkflowStep fails when the persisted agent command override is invalid', async () => {
  const templateSnapshot = createTemplate();
  const agentRepo = {
    async findById(id: number) {
      assert.equal(id, 7);
      return createAgent({ name: 'Broken Command Agent', commandOverride: '   ' });
    },
  };

  await assert.rejects(
    () => executeWorkflowStep({
      templateSnapshot,
      agentRepo: agentRepo as never,
      ...createInputOverrides(),
    }),
    /invalid command override/
  );
});

test.test('executeWorkflowStep fails when the persisted agent env config is invalid', async () => {
  const templateSnapshot = createTemplate();
  const agentRepo = {
    async findById(id: number) {
      assert.equal(id, 7);
      return createAgent({ name: 'Broken Env Agent', env: { MODE: 1 } as never });
    },
  };

  await assert.rejects(
    () => executeWorkflowStep({
      templateSnapshot,
      agentRepo: agentRepo as never,
      ...createInputOverrides(),
    }),
    /invalid env configuration/
  );
});

test.test('executeWorkflowStep fails when the persisted agent skills config is invalid', async () => {
  const templateSnapshot = createTemplate();
  const agentRepo = {
    async findById(id: number) {
      assert.equal(id, 7);
      return createAgent({ name: 'Broken Skills Agent', skills: ['design', 1] as never });
    },
  };

  await assert.rejects(
    () => executeWorkflowStep({
      templateSnapshot,
      agentRepo: agentRepo as never,
      ...createInputOverrides(),
    }),
    /invalid skills configuration/
  );
});
