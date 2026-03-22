import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import type { TaskSourceSyncResultItem } from '../../src/types/sources.ts';

test.test('task source sync result type accepts expected assignments', () => {
  const resultItem: TaskSourceSyncResultItem = {
    id: 1,
    project_id: 2,
    title: 'Imported issue',
    status: 'TODO',
  };

  assert.equal(resultItem.id, 1);
  assert.equal(resultItem.project_id, 2);
  assert.equal(resultItem.title, 'Imported issue');
  assert.equal(resultItem.status, 'TODO');
});
