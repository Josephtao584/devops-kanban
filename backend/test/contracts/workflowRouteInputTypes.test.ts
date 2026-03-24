import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import type { CreateExecutionInput, UpdateExecutionInput } from '../../src/types/dto/executions.ts';
import type { CreateSessionInput } from '../../src/types/dto/sessions.ts';
import type { StartWorkflowBody } from '../../src/types/dto/workflows.ts';

test.test('workflow and related route body types accept expected assignments', () => {
  const workflowBody: StartWorkflowBody = { task_id: 1, workflow_template_id: 'quick-fix-v1' };
  const sessionBody: CreateSessionInput = { task_id: 2 };
  const executionCreate: CreateExecutionInput = { session_id: 3 };
  const executionUpdate: UpdateExecutionInput = { status: 'RUNNING' };

  assert.equal(workflowBody.task_id, 1);
  assert.equal(sessionBody.task_id, 2);
  assert.equal(executionCreate.session_id, 3);
  assert.equal(executionUpdate.status, 'RUNNING');
});
