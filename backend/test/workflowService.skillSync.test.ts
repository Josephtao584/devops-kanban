import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import { WorkflowService } from '../src/services/workflow/workflowService.js';

test.test('_executeWorkflow resolves skills then delegates to executor-aware preparation', async () => {
  const resolveCalls: string[] = [];
  const prepareCalls: Array<{ executorType: string; skillNames: string[]; executionPath: string }> = [];
  const workflowRunUpdates: Array<Record<string, unknown>> = [];
  const taskUpdates: Array<Record<string, unknown>> = [];

  const service = new WorkflowService({
    workflowRunRepo: {
      async update(_runId: number, payload: Record<string, unknown>) {
        workflowRunUpdates.push(payload);
        return { id: 1, ...payload };
      },
    } as never,
    taskRepo: {
      async update(_taskId: number, payload: Record<string, unknown>) {
        taskUpdates.push(payload);
        return { id: 1, ...payload };
      },
    } as never,
    lifecycle: {
      async onStepComplete() {},
      async onUnexpectedError() {},
    } as never,
    resolveWorkflowSkillsFn: async (template) => {
      resolveCalls.push(template.template_id);
      return ['brainstorming'];
    },
    prepareExecutionSkillsFn: async (input) => {
      prepareCalls.push({
        executorType: input.executorType,
        skillNames: input.skillNames,
        executionPath: input.executionPath,
      });
    },
    workflowBuilder: (() => ({
      async createRun() {
        return {
          runId: 'mastra-test-run',
          stream() {
            return {
              fullStream: (async function* () {})(),
              result: Promise.resolve({ status: 'success', result: {} }),
            };
          },
        };
      },
    })) as never,
  });

  await service._executeWorkflow(
    1,
    {
      id: 1,
      project_id: 1,
      title: 'Task',
      description: 'Desc',
      execution_path: '/tmp/workflow-project',
    } as never,
    {
      id: 1,
      template_id: 'wf-template',
      name: 'wf',
      created_at: '',
      updated_at: '',
      steps: [
        { id: 'step-a', name: 'Step A', instructionPrompt: 'Do A', agentId: 1 },
      ],
    }
  );

  assert.deepEqual(resolveCalls, ['wf-template']);
  assert.deepEqual(prepareCalls, [
    { executorType: 'CLAUDE_CODE', skillNames: ['brainstorming'], executionPath: '/tmp/workflow-project' },
  ]);
  assert.ok(workflowRunUpdates.some(update => update.status === 'RUNNING'));
  assert.ok(taskUpdates.some(update => update.status === 'DONE'));
});
