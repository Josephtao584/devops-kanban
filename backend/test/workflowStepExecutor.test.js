import test from 'node:test';
import assert from 'node:assert/strict';
import { executeWorkflowStep } from '../src/services/workflowStepExecutor.js';

const sharedState = {
  taskTitle: '测试任务',
  taskDescription: '测试描述',
  worktreePath: '/tmp/worktree',
};

test('executeWorkflowStep selects executor from global template for the current step', async () => {
  const proc = { pid: 123 };
  const context = {};
  const templateService = {
    async getTemplate() {
      return {
        template_id: 'dev-workflow-v1',
        steps: [
          {
            id: 'requirement-design',
            name: '需求设计',
            instructionPrompt: '先完成需求分析和设计拆解。',
            executor: { type: 'CODEX', commandOverride: null, args: [], env: {} },
          },
          {
            id: 'code-development',
            name: '代码开发',
            instructionPrompt: '根据设计摘要完成代码实现。',
            executor: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} },
          },
          {
            id: 'testing',
            name: '测试',
            instructionPrompt: '根据开发结果执行测试验证。',
            executor: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} },
          },
          {
            id: 'code-review',
            name: '代码审查',
            instructionPrompt: '根据测试结果完成代码审查总结。',
            executor: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} },
          },
        ],
      };
    },
  };
  const registry = {
    getExecutor(type) {
      assert.equal(type, 'CODEX');
      return {
        async execute({ prompt, worktreePath, onSpawn }) {
          assert.equal(worktreePath, sharedState.worktreePath);
          assert.match(prompt, /当前步骤：需求设计/);
          assert.match(prompt, /原始需求标题：\n测试任务/);
          assert.match(prompt, /原始需求内容：\n测试描述/);
          assert.match(prompt, /本步骤要求：\n先完成需求分析和设计拆解。/);
          onSpawn(proc);
          return { rawResult: { summary: 'ok' }, proc };
        },
      };
    },
  };

  const result = await executeWorkflowStep({
    templateService,
    registry,
    context,
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
  });

  assert.equal(context.proc, proc);
  assert.deepEqual(result, { summary: 'ok' });
});

test('executeWorkflowStep passes worktreePath and upstream summary through assembled prompt', async () => {
  let receivedWorktreePath = null;
  let receivedPrompt = null;
  const templateService = {
    async getTemplate() {
      return {
        template_id: 'dev-workflow-v1',
        steps: [
          {
            id: 'requirement-design',
            name: '需求设计',
            instructionPrompt: '先完成需求分析和设计拆解。',
            executor: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} },
          },
          {
            id: 'code-development',
            name: '代码开发',
            instructionPrompt: '根据设计摘要完成代码实现。',
            executor: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} },
          },
          {
            id: 'testing',
            name: '测试',
            instructionPrompt: '根据开发结果执行测试验证。',
            executor: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} },
          },
          {
            id: 'code-review',
            name: '代码审查',
            instructionPrompt: '根据测试结果完成代码审查总结。',
            executor: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} },
          },
        ],
      };
    },
  };
  const registry = {
    getExecutor() {
      return {
        async execute({ worktreePath, prompt }) {
          receivedWorktreePath = worktreePath;
          receivedPrompt = prompt;
          return { rawResult: { summary: 'ok' } };
        },
      };
    },
  };

  await executeWorkflowStep({
    templateService,
    registry,
    context: {},
    stepId: 'code-development',
    worktreePath: '/tmp/project',
    state: {
      ...sharedState,
      worktreePath: '/tmp/project',
    },
    inputData: {
      summary: '已完成设计摘要',
    },
    upstreamStepIds: ['requirement-design'],
  });

  assert.equal(receivedWorktreePath, '/tmp/project');
  assert.match(receivedPrompt, /- requirement-design:\n已完成设计摘要/);
  assert.match(receivedPrompt, /本步骤要求：\n根据设计摘要完成代码实现。/);
});
