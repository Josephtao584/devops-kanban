import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { executeWorkflowStep } from '../src/services/workflow/workflowStepExecutor.js';
import type { ExecutorExecutionInput, ExecutorMap, ExecutorProcessHandle, ExecutorRawResult } from '../src/types/executors.js';

const sharedState = {
  taskTitle: '测试任务',
  taskDescription: '测试描述',
  worktreePath: '/tmp/worktree',
};

test.test('executeWorkflowStep selects executor from global template for the current step', async () => {
  const proc: ExecutorProcessHandle = { pid: 123 } as ExecutorProcessHandle;
  const context: { proc?: ExecutorProcessHandle | null } = {};
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
        ],
      };
    },
  };
  const registry = {
    getExecutor(type: keyof ExecutorMap) {
      assert.equal(type, 'CODEX');
      return {
        async execute({ prompt, worktreePath, onSpawn }: ExecutorExecutionInput) {
          assert.equal(worktreePath, sharedState.worktreePath);
          assert.match(prompt, /当前步骤：需求设计/);
          onSpawn?.(proc);
          const rawResult: ExecutorRawResult = { summary: 'ok' };
          return { exitCode: 0, stdout: '', stderr: '', rawResult, proc };
        },
      };
    },
  };

  const result = await executeWorkflowStep({
    templateService: templateService as never,
    registry: registry as never,
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
