import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import { TaskService } from '../src/services/taskService.js';

test.test('TaskService no longer exposes createWorkflowTestTask', () => {
  const service = new TaskService({
    taskRepo: {} as never,
    projectRepo: {} as never,
  });

  assert.equal(typeof (service as TaskService & { createWorkflowTestTask?: unknown }).createWorkflowTestTask, 'undefined');
});
