import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import { buildWorkflowFromTemplate, initWorkflows } from '../src/services/workflow/workflows.js';

function buildTemplate(templateId: string) {
  return {
    id: 1,
    template_id: templateId,
    name: 'Workflow Template',
    created_at: '2026-03-22T00:00:00.000Z',
    updated_at: '2026-03-22T00:00:00.000Z',
    steps: [
      {
        id: 'step-1',
        name: 'Step 1',
        instructionPrompt: 'Do the work',
        agentId: 11,
      },
    ],
  };
}

test.test('workflow aborts when onStepStart skips execution', async () => {
  await initWorkflows();

  let onStepCompleteCalls = 0;
  let onStepErrorCalls = 0;
  let onWorkflowCompleteCalls = 0;
  let onWorkflowErrorCalls = 0;

  const workflow = buildWorkflowFromTemplate(buildTemplate(`workflow-abort-${Date.now()}`), {
    runId: 1,
    task: { id: 7, project_id: 3, execution_path: '/tmp/task-7' },
    lifecycle: {
      async onStepStart() {
        return undefined;
      },
      async onStepComplete() {
        onStepCompleteCalls += 1;
      },
      async onStepError() {
        onStepErrorCalls += 1;
      },
      async onStepResume() {},
      async onStepSuspend() {},
      async onWorkflowComplete() {
        onWorkflowCompleteCalls += 1;
      },
      async onWorkflowError() {
        onWorkflowErrorCalls += 1;
      },
      sessionEventRepo: {
        async append() {},
      },
      sessionSegmentRepo: {
        async update() {},
      },
    } as never,
  });

  const run = await workflow.createRun();
  const result = await run.start({
    inputData: {
      taskId: 7,
      taskTitle: 'Task 7',
      taskDescription: 'Desc',
      worktreePath: '/tmp/task-7',
    },
    initialState: {
      taskTitle: 'Task 7',
      taskDescription: 'Desc',
      worktreePath: '/tmp/task-7',
    },
  });

  assert.equal(result.status, 'canceled');
  assert.equal(onStepCompleteCalls, 0);
  assert.equal(onStepErrorCalls, 0);
  assert.equal(onWorkflowCompleteCalls, 0);
  assert.equal(onWorkflowErrorCalls, 0);
});
