import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import type {
  CreateTaskInput,
  StartTaskInput,
  UpdateTaskInput,
} from '../../src/types/dto/tasks.ts';

test.test('task route and service DTOs accept explicit create, start, and update inputs', () => {
  const createInput: CreateTaskInput = {
    title: 'Split route module',
    project_id: 1,
    priority: 'HIGH',
  };

  const createWithOptionalFields: CreateTaskInput = {
    title: 'Wire source metadata',
    project_id: 2,
    external_id: null,
    workflow_run_id: null,
    worktree_path: null,
    worktree_branch: null,
  };

  const startInput: StartTaskInput = {
    workflow_template_id: 'quick-fix-v1',
  };

  const updateInput: UpdateTaskInput = {
    title: 'Split route module safely',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
  };

  const updateWithNullableFields: UpdateTaskInput = {
    description: 'Refine task payload',
    external_id: null,
    workflow_run_id: null,
    worktree_path: null,
    worktree_branch: null,
  };

  assert.equal(createInput.project_id, 1);
  assert.equal(createWithOptionalFields.external_id, null);
  assert.equal(startInput.workflow_template_id, 'quick-fix-v1');
  assert.equal(updateInput.status, 'IN_PROGRESS');
  assert.equal(updateWithNullableFields.worktree_path, null);
});
