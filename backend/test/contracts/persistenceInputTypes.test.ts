import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import type { IterationCreateRecord, IterationUpdateRecord } from '../../src/types/persistence/iterations.ts';
import type { ProjectCreateRecord, ProjectUpdateRecord } from '../../src/types/persistence/projects.ts';
import type { TaskCreateRecord, TaskUpdateRecord } from '../../src/types/persistence/tasks.ts';

test.test('persistence input types accept expected assignments', () => {
  const projectCreate: ProjectCreateRecord = { name: 'Platform' };
  const projectUpdate: ProjectUpdateRecord = { local_path: '/repo' };
  const taskCreate: TaskCreateRecord = { project_id: 1, title: 'Fix typing', status: 'TODO' };
  const taskUpdate: TaskUpdateRecord = { order: 2 };
  const iterationCreate: IterationCreateRecord = { project_id: 1, name: 'Sprint 1' };
  const iterationUpdate: IterationUpdateRecord = { status: 'ACTIVE' };

  assert.equal(projectCreate.name, 'Platform');
  assert.equal(projectUpdate.local_path, '/repo');
  assert.equal(taskCreate.status, 'TODO');
  assert.equal(taskUpdate.order, 2);
  assert.equal(iterationCreate.project_id, 1);
  assert.equal(iterationUpdate.status, 'ACTIVE');
});
