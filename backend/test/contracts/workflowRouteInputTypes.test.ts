import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import type { CreateExecutionInput, UpdateExecutionInput } from '../../src/types/dto/executions.ts';
import type { CreateSessionInput } from '../../src/types/dto/sessions.ts';
import type { StartWorkflowBody } from '../../src/types/dto/workflows.ts';
import type { WorkflowStepEntity } from '../../src/types/entities.ts';

test.test('workflow and related route body types accept expected assignments', () => {
  const workflowBody: StartWorkflowBody = { task_id: 1 };
  const sessionBody: CreateSessionInput = { task_id: 2 };
  const executionCreate: CreateExecutionInput = { session_id: 3 };
  const executionUpdate: UpdateExecutionInput = { status: 'RUNNING' };
  const workflowStep: WorkflowStepEntity = {
    step_id: 'requirement-design',
    name: '需求设计',
    status: 'PENDING',
    started_at: null,
    completed_at: null,
    retry_count: 0,
    session_id: 4,
    summary: 'Summarized result',
    error: null,
  };

  assert.equal(workflowBody.task_id, 1);
  assert.equal(sessionBody.task_id, 2);
  assert.equal(executionCreate.session_id, 3);
  assert.equal(executionUpdate.status, 'RUNNING');
  assert.equal(workflowStep.session_id, 4);
  assert.equal(workflowStep.summary, 'Summarized result');
});
