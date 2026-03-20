import test from 'node:test';
import assert from 'node:assert/strict';
import { executeWorkflowStep } from '../src/services/workflowStepExecutor.js';

test('executeWorkflowStep selects executor from global template for the current step', async () => {
  const proc = { pid: 123 };
  const context = {};
  const templateService = {
    async getTemplate() {
      return {
        template_id: 'dev-workflow-v1',
        steps: [
          { id: 'requirement-design', executor: { type: 'CODEX', commandOverride: null, args: [], env: {} } },
          { id: 'code-development', executor: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} } },
          { id: 'testing', executor: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} } },
          { id: 'code-review', executor: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} } },
        ],
      };
    },
  };
  const registry = {
    getExecutor(type) {
      assert.equal(type, 'CODEX');
      return {
        async execute({ onSpawn }) {
          onSpawn(proc);
          return { rawResult: { changedFiles: ['x'], summary: 'ok' }, proc };
        },
      };
    },
  };

  const result = await executeWorkflowStep({
    templateService,
    registry,
    context,
    stepId: 'requirement-design',
    worktreePath: '/tmp/worktree',
    taskTitle: '测试任务',
    taskDescription: '测试描述',
  });

  assert.equal(context.proc, proc);
  assert.deepEqual(result, { changedFiles: ['x'], summary: 'ok' });
});

test('executeWorkflowStep passes worktreePath through to executor', async () => {
  let receivedWorktreePath = null;
  const templateService = {
    async getTemplate() {
      return {
        template_id: 'dev-workflow-v1',
        steps: [
          { id: 'requirement-design', executor: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} } },
          { id: 'code-development', executor: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} } },
          { id: 'testing', executor: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} } },
          { id: 'code-review', executor: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} } },
        ],
      };
    },
  };
  const registry = {
    getExecutor() {
      return {
        async execute({ worktreePath }) {
          receivedWorktreePath = worktreePath;
          return { rawResult: { changedFiles: ['docs/design.md'], summary: 'ok' } };
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
    taskTitle: '代码开发',
    taskDescription: '实现改动',
  });

  assert.equal(receivedWorktreePath, '/tmp/project');
});
