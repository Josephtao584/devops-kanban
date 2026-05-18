import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import { splitSuggestionRepository } from '../../src/repositories/splitSuggestionRepository.js';
import { splitSuggestionService } from '../../src/services/splitSuggestionService.js';
import { taskRepository } from '../../src/repositories/taskRepository.js';
import { projectRepository } from '../../src/repositories/projectRepository.js';
import { taskService } from '../../src/services/taskService.js';

interface SuggestionFixtureOverrides {
  title?: string;
  template_id?: string | null;
  create_worktree?: boolean;
  auto_start?: boolean;
}

function buildSuggestion(overrides: SuggestionFixtureOverrides = {}) {
  return {
    title: overrides.title ?? 'child',
    description: 'd',
    template_id: overrides.template_id ?? null,
    linked_project_id: null,
    target_repo_url: null,
    depends_on_indices: [],
    enabled: true,
    create_worktree: overrides.create_worktree ?? true,
    auto_start: overrides.auto_start ?? true,
  };
}

async function setupFixture(suggestionTitle: string, suggestionFields: SuggestionFixtureOverrides) {
  const project = await projectRepository.create({
    name: `split-confirm-test-${Date.now()}-${Math.random()}`,
    description: undefined,
    git_url: undefined,
    local_path: undefined,
    env: {},
  });
  const parent = await taskRepository.create({
    title: 'parent',
    description: '',
    project_id: project.id,
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    source: 'internal',
    depends_on: [],
    labels: [],
  });
  const suggestion = await splitSuggestionRepository.create({
    parent_task_id: parent.id,
    workflow_run_id: null,
    status: 'PENDING',
    suggestions: [buildSuggestion({ title: suggestionTitle, ...suggestionFields })],
    confirmed_at: null,
  });
  return { project, parent, suggestion };
}

async function cleanup(parentId: number, projectId: number, suggestionId: number) {
  const children = await taskRepository.findChildren(parentId);
  for (const c of children) await taskRepository.delete(c.id);
  await splitSuggestionRepository.delete(suggestionId);
  await taskRepository.delete(parentId);
  await projectRepository.delete(projectId);
}

function stubTaskService() {
  const original = {
    createWorktree: taskService.createWorktree.bind(taskService),
    startTask: taskService.startTask.bind(taskService),
  };
  const calls = { createWorktree: 0, startTask: 0 };
  taskService.createWorktree = async () => {
    calls.createWorktree++;
    return { worktree_path: '/tmp/x', worktree_branch: 'b', worktree_status: 'created' };
  };
  taskService.startTask = (async () => {
    calls.startTask++;
    return {} as never;
  }) as typeof taskService.startTask;
  return {
    calls,
    restore: () => {
      taskService.createWorktree = original.createWorktree;
      taskService.startTask = original.startTask;
    },
  };
}

test.test('confirm calls createWorktree and startTask when both flags true and template set', async () => {
  const { project, parent, suggestion } = await setupFixture('child-both-true', {
    template_id: 'tmpl-1', create_worktree: true, auto_start: true,
  });
  const stub = stubTaskService();
  try {
    await splitSuggestionService.confirm(suggestion.id);
    assert.equal(stub.calls.createWorktree, 1);
    assert.equal(stub.calls.startTask, 1);
  } finally {
    stub.restore();
    await cleanup(parent.id, project.id, suggestion.id);
  }
});

test.test('confirm calls createWorktree but skips startTask when auto_start=false', async () => {
  const { project, parent, suggestion } = await setupFixture('child-no-autostart', {
    template_id: 'tmpl-1', create_worktree: true, auto_start: false,
  });
  const stub = stubTaskService();
  try {
    await splitSuggestionService.confirm(suggestion.id);
    assert.equal(stub.calls.createWorktree, 1);
    assert.equal(stub.calls.startTask, 0);
  } finally {
    stub.restore();
    await cleanup(parent.id, project.id, suggestion.id);
  }
});

test.test('confirm starts task without worktree when create_worktree=false and auto_start=true', async () => {
  const { project, parent, suggestion } = await setupFixture('child-no-worktree', {
    template_id: 'tmpl-1', create_worktree: false, auto_start: true,
  });
  const stub = stubTaskService();
  try {
    await splitSuggestionService.confirm(suggestion.id);
    assert.equal(stub.calls.createWorktree, 0);
    assert.equal(stub.calls.startTask, 1);
  } finally {
    stub.restore();
    await cleanup(parent.id, project.id, suggestion.id);
  }
});

test.test('confirm skips both when create_worktree=false and auto_start=false', async () => {
  const { project, parent, suggestion } = await setupFixture('child-skip-both', {
    template_id: 'tmpl-1', create_worktree: false, auto_start: false,
  });
  const stub = stubTaskService();
  try {
    await splitSuggestionService.confirm(suggestion.id);
    assert.equal(stub.calls.createWorktree, 0);
    assert.equal(stub.calls.startTask, 0);
  } finally {
    stub.restore();
    await cleanup(parent.id, project.id, suggestion.id);
  }
});

test.test('confirm skips startTask when template is null even if auto_start=true', async () => {
  const { project, parent, suggestion } = await setupFixture('child-no-template', {
    template_id: null, create_worktree: true, auto_start: true,
  });
  const stub = stubTaskService();
  try {
    await splitSuggestionService.confirm(suggestion.id);
    assert.equal(stub.calls.createWorktree, 1, 'create_worktree=true should still create');
    assert.equal(stub.calls.startTask, 0, 'no template means no startTask');
  } finally {
    stub.restore();
    await cleanup(parent.id, project.id, suggestion.id);
  }
});
