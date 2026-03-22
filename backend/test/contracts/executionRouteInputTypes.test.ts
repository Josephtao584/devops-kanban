import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import type {
  CreateExecutionInput,
  UpdateExecutionInput,
} from '../../src/services/executionService.ts';

test.test('execution route and service DTOs accept explicit create and update inputs', () => {
  const createInput: CreateExecutionInput = {
    session_id: 12,
    task_id: 34,
    status: 'RUNNING',
    command: 'claude-code',
  };

  const createWithoutOptionalTask: CreateExecutionInput = {
    session_id: 56,
    status: 'PENDING',
  };

  const updateInput: UpdateExecutionInput = {
    status: 'DONE',
    output: 'completed',
  };

  assert.equal(createInput.session_id, 12);
  assert.equal(createWithoutOptionalTask.task_id, undefined);
  assert.equal(updateInput.status, 'DONE');
});
