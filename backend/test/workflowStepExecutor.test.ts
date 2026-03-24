import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { executeWorkflowStep } from '../src/services/workflow/workflowStepExecutor.js';
import type { ExecutorExecutionInput, ExecutorMap, ExecutorProcessHandle, ExecutorRawResult } from '../src/types/executors.js';

const sharedState = {
  taskTitle: '测试任务',
  taskDescription: '测试描述',
  worktreePath: '/tmp/worktree',
};

function createStep(agentId: number | null, overrides: Record<string, unknown> = {}) {
  return {
    id: 'requirement-design',
    name: '需求设计',
    instructionPrompt: '先完成需求分析和设计拆解。',
    agentId,
    ...overrides,
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

function createInputOverrides(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  };
}

function createAgent(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    name: 'Codex Designer',
    executorType: 'CODEX',
    role: 'DESIGNER',
    commandOverride: 'codex run',
    args: ['--json'],
    env: { MODE: 'strict' },
    skills: ['design'],
    enabled: true,
    ...overrides,
  };
}

test.test('executeWorkflowStep resolves executor from the bound step agent', async () => {
  const proc: ExecutorProcessHandle = {
    kill() {
      return true;
    },
  };
  const context: { proc?: ExecutorProcessHandle | null } = {};
  const templateService = createTemplateService();
  const agentRepo = {
    async findById(id: number) {
      assert.equal(id, 7);
      return createAgent();
    },
  };
  let executed = false;
  let receivedPrompt = '';
  let receivedConfig: ExecutorExecutionInput['executorConfig'] | undefined;
  const registry = {
    getExecutor(type: keyof ExecutorMap) {
      assert.equal(type, 'CODEX');
      return {
        async execute({ prompt, worktreePath, executorConfig, onSpawn }: ExecutorExecutionInput) {
          executed = true;
          receivedPrompt = prompt;
          receivedConfig = executorConfig;
          assert.equal(worktreePath, sharedState.worktreePath);
          onSpawn?.(proc);
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
    ...createInputOverrides(),
  });

  assert.equal(executed, true);
  assert.match(receivedPrompt, /当前执行代理：/);
  assert.match(receivedPrompt, /代理名称：Codex Designer/);
  assert.match(receivedPrompt, /代理角色：DESIGNER/);
  assert.match(receivedPrompt, /代理技能：design/);
  assert.deepEqual(receivedConfig, {
    type: 'CODEX',
    commandOverride: 'codex run',
    args: ['--json'],
    env: { MODE: 'strict' },
    skills: ['design'],
  });
  assert.equal(context.proc, proc);
  assert.deepEqual(result, { summary: 'ok' });
});

test.test('executeWorkflowStep allows mismatched agent role guidance without blocking execution', async () => {
  let executed = false;
  let receivedPrompt = '';
  const templateService = createTemplateService(createStep(7, {
    id: 'test-validation',
    name: '测试验证',
    instructionPrompt: '请执行测试验证并记录测试结果。',
  }));
  const agentRepo = {
    async findById(id: number) {
      assert.equal(id, 7);
      return createAgent({
        name: 'Architect Agent',
        role: 'ARCHITECT',
        skills: ['architecture-review'],
      });
    },
  };
  const registry = {
    getExecutor(type: keyof ExecutorMap) {
      assert.equal(type, 'CODEX');
      return {
        async execute({ prompt }: ExecutorExecutionInput) {
          executed = true;
          receivedPrompt = prompt;
          const rawResult: ExecutorRawResult = { summary: 'mismatch-ok' };
          return { exitCode: 0, stdout: '', stderr: '', rawResult, proc: null };
        },
      };
    },
  };

  const result = await executeWorkflowStep({
    templateService: templateService as never,
    agentRepo: agentRepo as never,
    registry: registry as never,
    ...createInputOverrides({ stepId: 'test-validation' }),
  });

  assert.equal(executed, true);
  assert.match(receivedPrompt, /当前步骤：测试验证/);
  assert.match(receivedPrompt, /代理角色：ARCHITECT/);
  assert.match(receivedPrompt, /代理技能：architecture-review/);
  assert.deepEqual(result, { summary: 'mismatch-ok' });
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
