import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import type {
  CreateTaskSourceInput,
  TaskSourceImportBody,
  UpdateTaskSourceInput,
} from '../../src/types/dto/taskSources.ts';

test.test('task source DTOs accept the currently supported route inputs', () => {
  const createInput: CreateTaskSourceInput = {
    name: 'Internal Workitems',
    type: 'INTERNAL_API',
    project_id: 1,
    config: {
      baseUrl: 'https://internal.example.com',
      token: 'Bearer demo-token',
      userId: '10001',
      category: '5',
      pageSize: '10',
      listPath: '/devops-workitem/api/v1/query/workitems',
      detailPath: '/devops-workitem/api/v1/query/{number}/document_detail',
      detailIdField: 'number',
    },
    enabled: true,
  };

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

  assert.equal(createInput.name, 'Internal Workitems');
  assert.equal(createInput.type, 'INTERNAL_API');
  assert.equal(updateInput.last_sync_at, '2026-03-20T10:00:00.000Z');
  assert.equal(importBody.items?.[0]?.external_id, 'ISSUE-1');
  assert.equal(importBody.project_id, 12);
});
