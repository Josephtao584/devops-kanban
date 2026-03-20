import test from 'node:test';
import assert from 'node:assert/strict';
import { TaskService } from '../src/services/taskService.js';

test('TaskService 不再暴露 createWorkflowTestTask', () => {
  const service = new TaskService({
    taskRepo: {},
    projectRepo: {},
  });

  assert.equal(typeof service.createWorkflowTestTask, 'undefined');
});
