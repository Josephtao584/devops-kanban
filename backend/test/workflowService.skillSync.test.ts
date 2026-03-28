import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import { WorkflowService } from '../src/services/workflow/workflowService.js';

test.test('_executeWorkflow calls skill sync with execution path before workflow run', async () => {
  const syncCalls: Array<{ templateId: string; projectPath: string }> = [];
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
    syncWorkflowSkillsFn: async (template, projectPath) => {
      syncCalls.push({ templateId: template.template_id, projectPath });
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

  assert.deepEqual(syncCalls, [
    { templateId: 'wf-template', projectPath: '/tmp/workflow-project' },
  ]);
  assert.ok(workflowRunUpdates.some(update => update.status === 'RUNNING'));
  assert.ok(taskUpdates.some(update => update.status === 'DONE'));
});
