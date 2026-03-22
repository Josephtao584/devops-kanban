import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import type { IdParams, SessionIdParams, TaskIdParams } from '../../src/types/http/params.ts';
import type { ProjectIdQuery, SessionFiltersQuery, TaskIdQuery } from '../../src/types/http/query.ts';

test.test('shared HTTP route types accept expected assignments', () => {
  const idParams: IdParams = { id: '1' };
  const taskIdParams: TaskIdParams = { taskId: '42' };
  const sessionIdParams: SessionIdParams = { sessionId: '9' };
  const projectQuery: ProjectIdQuery = { project_id: '7' };
  const taskQuery: TaskIdQuery = { task_id: '13' };
  const sessionFilters: SessionFiltersQuery = { taskId: '9', activeOnly: 'true' };

  assert.equal(idParams.id, '1');
  assert.equal(taskIdParams.taskId, '42');
  assert.equal(sessionIdParams.sessionId, '9');
  assert.equal(projectQuery.project_id, '7');
  assert.equal(taskQuery.task_id, '13');
  assert.equal(sessionFilters.activeOnly, 'true');
});
