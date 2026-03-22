import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import type {
  CreateExecutionInput,
  UpdateExecutionInput,
} from '../../src/types/dto/executions.ts';

test.test('execution DTOs accept supported create and update inputs', () => {
  const createInput: CreateExecutionInput = {
    session_id: 12,
    status: 'RUNNING',
    command: 'claude-code',
  };

  const createWithOptionalFields: CreateExecutionInput = {
    session_id: 56,
    status: 'PENDING',
    metadata: { attempt: 1 },
  };

  const updateInput: UpdateExecutionInput = {
    task_id: 34,
    status: 'DONE',
    output: 'completed',
  };

  assert.equal(createInput.session_id, 12);
  assert.equal(createInput.status, 'RUNNING');
  assert.deepEqual(createWithOptionalFields.metadata, { attempt: 1 });
  assert.equal(updateInput.task_id, 34);
  assert.equal(updateInput.status, 'DONE');
});
