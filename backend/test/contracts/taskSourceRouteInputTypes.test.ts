import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import type {
  CreateTaskSourceInput,
  TaskSourceImportBody,
  UpdateTaskSourceInput,
} from '../../src/types/dto/taskSources.ts';

test.test('task source DTOs accept the currently supported route inputs', () => {
  const createInput: CreateTaskSourceInput = {};

  const updateInput: UpdateTaskSourceInput = {
    last_sync_at: '2026-03-20T10:00:00.000Z',
  };

  const importBody: TaskSourceImportBody = {
    items: [
      {
        external_id: 'ISSUE-1',
        title: 'Imported issue',
        description: 'Bring issue into the board',
        external_url: 'https://example.com/issues/1',
        labels: ['backend'],
      },
    ],
    project_id: 12,
    iteration_id: 4,
  };

  assert.deepEqual(createInput, {});
  assert.equal(updateInput.last_sync_at, '2026-03-20T10:00:00.000Z');
  assert.equal(importBody.items?.[0]?.external_id, 'ISSUE-1');
  assert.equal(importBody.project_id, 12);
});
