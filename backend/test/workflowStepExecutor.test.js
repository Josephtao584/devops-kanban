import test from 'node:test';
import assert from 'node:assert/strict';
import { executeClaudeWorkflowStep } from '../src/services/workflowStepExecutor.js';

test('executeClaudeWorkflowStep 返回统一结构化结果并记录活跃进程', async () => {
  const proc = { pid: 123 };
  const context = {};
  const runner = {
    async runStep({ onSpawn }) {
      onSpawn(proc);
      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
        resultFilePath: '/tmp/worktree/.kanban/step-result.json',
        parsedResult: {
          changedFiles: ['docs/workflow-step-test.md'],
          summary: 'ok',
        },
      };
    },
  };

  const result = await executeClaudeWorkflowStep({
    runner,
    context,
    stepId: 'requirement-design',
    worktreePath: '/tmp/worktree',
    taskTitle: '测试任务',
    taskDescription: '测试描述',
  });

  assert.equal(context.proc, proc);
  assert.deepEqual(result, {
    changedFiles: ['docs/workflow-step-test.md'],
    summary: 'ok',
  });
});

test('executeClaudeWorkflowStep 透传传入的 worktreePath 给 runner', async () => {
  let receivedWorktreePath = null;
  const runner = {
    async runStep({ worktreePath }) {
      receivedWorktreePath = worktreePath;
      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
        resultFilePath: '/tmp/project/.kanban/step-result.json',
        parsedResult: {
          changedFiles: ['docs/design.md'],
          summary: 'ok',
        },
      };
    },
  };

  await executeClaudeWorkflowStep({
    runner,
    context: {},
    stepId: 'code-development',
    worktreePath: '/tmp/project',
    taskTitle: '代码开发',
    taskDescription: '实现改动',
  });

  assert.equal(receivedWorktreePath, '/tmp/project');
});
