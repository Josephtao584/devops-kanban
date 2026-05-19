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
  child_task_id?: number | null;
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
    work_dir: null,
    child_task_id: overrides.child_task_id ?? null,
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

test.test('confirm skips suggestions whose child_task_id is set', async () => {
  const project = await projectRepository.create({
    name: `split-skip-test-${Date.now()}-${Math.random()}`,
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
  // 先建一个真实子任务作为「已建」目标
  const existingChild = await taskRepository.create({
    title: 'existing-child',
    description: 'already built',
    project_id: project.id,
    status: 'TODO',
    priority: 'MEDIUM',
    source: 'internal',
    parent_task_id: parent.id,
    depends_on: [],
    labels: [],
  });
  const suggestion = await splitSuggestionRepository.create({
    parent_task_id: parent.id,
    workflow_run_id: null,
    status: 'CONFIRMED',
    suggestions: [
      buildSuggestion({ title: 'existing-child', child_task_id: existingChild.id }),
      buildSuggestion({ title: 'new-child' }),
    ],
    confirmed_at: new Date().toISOString(),
  });
  const stub = stubTaskService();
  try {
    const result = await splitSuggestionService.confirm(suggestion.id);
    assert.equal(result.created_count, 1, 'only the new row should be created');
    const children = await taskRepository.findChildren(parent.id);
    assert.equal(children.length, 2, 'parent should have existing + new child');
    const updated = (await splitSuggestionRepository.findById(suggestion.id))!;
    assert.equal(updated.suggestions[0]!.child_task_id, existingChild.id, 'existing row child_task_id unchanged');
    assert.ok(updated.suggestions[1]!.child_task_id != null, 'new row child_task_id written');
  } finally {
    stub.restore();
    const children = await taskRepository.findChildren(parent.id);
    for (const c of children) await taskRepository.delete(c.id);
    await splitSuggestionRepository.delete(suggestion.id);
    await taskRepository.delete(parent.id);
    await projectRepository.delete(project.id);
  }
});

test.test('confirm with all rows already built returns created_count=0', async () => {
  const project = await projectRepository.create({
    name: `split-allbuilt-${Date.now()}-${Math.random()}`,
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
  const child1 = await taskRepository.create({
    title: 'a', description: '', project_id: project.id, status: 'TODO',
    priority: 'MEDIUM', source: 'internal', parent_task_id: parent.id,
    depends_on: [], labels: [],
  });
  const child2 = await taskRepository.create({
    title: 'b', description: '', project_id: project.id, status: 'TODO',
    priority: 'MEDIUM', source: 'internal', parent_task_id: parent.id,
    depends_on: [], labels: [],
  });
  const suggestion = await splitSuggestionRepository.create({
    parent_task_id: parent.id,
    workflow_run_id: null,
    status: 'CONFIRMED',
    suggestions: [
      buildSuggestion({ title: 'a', child_task_id: child1.id }),
      buildSuggestion({ title: 'b', child_task_id: child2.id }),
    ],
    confirmed_at: new Date().toISOString(),
  });
  const stub = stubTaskService();
  try {
    const result = await splitSuggestionService.confirm(suggestion.id);
    assert.equal(result.created_count, 0);
    assert.deepEqual(result.tasks.sort(), [child1.id, child2.id].sort());
    const children = await taskRepository.findChildren(parent.id);
    assert.equal(children.length, 2, 'no extra children created');
  } finally {
    stub.restore();
    const children = await taskRepository.findChildren(parent.id);
    for (const c of children) await taskRepository.delete(c.id);
    await splitSuggestionRepository.delete(suggestion.id);
    await taskRepository.delete(parent.id);
    await projectRepository.delete(project.id);
  }
});

test.test('updateSuggestions rejects edits to locked rows', async () => {
  const project = await projectRepository.create({
    name: `split-lock-${Date.now()}-${Math.random()}`,
    description: undefined,
    git_url: undefined,
    local_path: undefined,
    env: {},
  });
  const parent = await taskRepository.create({
    title: 'parent', description: '', project_id: project.id,
    status: 'IN_PROGRESS', priority: 'MEDIUM', source: 'internal',
    depends_on: [], labels: [],
  });
  const suggestion = await splitSuggestionRepository.create({
    parent_task_id: parent.id,
    workflow_run_id: null,
    status: 'CONFIRMED',
    suggestions: [
      buildSuggestion({ title: 'locked', child_task_id: 999_999 }),
    ],
    confirmed_at: new Date().toISOString(),
  });
  try {
    const tampered = [
      { ...suggestion.suggestions[0]!, title: 'changed' },
    ];
    await assert.rejects(
      splitSuggestionService.updateSuggestions(suggestion.id, tampered),
      /row is locked/,
    );
  } finally {
    await splitSuggestionRepository.delete(suggestion.id);
    await taskRepository.delete(parent.id);
    await projectRepository.delete(project.id);
  }
});

test.test('updateSuggestions rejects removing locked rows', async () => {
  const project = await projectRepository.create({
    name: `split-shrink-${Date.now()}-${Math.random()}`,
    description: undefined,
    git_url: undefined,
    local_path: undefined,
    env: {},
  });
  const parent = await taskRepository.create({
    title: 'parent', description: '', project_id: project.id,
    status: 'IN_PROGRESS', priority: 'MEDIUM', source: 'internal',
    depends_on: [], labels: [],
  });
  const suggestion = await splitSuggestionRepository.create({
    parent_task_id: parent.id,
    workflow_run_id: null,
    status: 'CONFIRMED',
    suggestions: [
      buildSuggestion({ title: 'a', child_task_id: 999_001 }),
      buildSuggestion({ title: 'b', child_task_id: 999_002 }),
    ],
    confirmed_at: new Date().toISOString(),
  });
  try {
    await assert.rejects(
      splitSuggestionService.updateSuggestions(suggestion.id, [suggestion.suggestions[0]!]),
      /cannot remove locked row/,
    );
  } finally {
    await splitSuggestionRepository.delete(suggestion.id);
    await taskRepository.delete(parent.id);
    await projectRepository.delete(project.id);
  }
});

test.test('updateSuggestions allows removing unlocked rows while locked rows untouched', async () => {
  const project = await projectRepository.create({
    name: `split-remove-unlocked-${Date.now()}-${Math.random()}`,
    description: undefined,
    git_url: undefined,
    local_path: undefined,
    env: {},
  });
  const parent = await taskRepository.create({
    title: 'parent', description: '', project_id: project.id,
    status: 'IN_PROGRESS', priority: 'MEDIUM', source: 'internal',
    depends_on: [], labels: [],
  });
  const suggestion = await splitSuggestionRepository.create({
    parent_task_id: parent.id,
    workflow_run_id: null,
    status: 'PENDING',
    suggestions: [
      buildSuggestion({ title: 'locked-a', child_task_id: 999_010 }),
      buildSuggestion({ title: 'unlocked-b' }),
      buildSuggestion({ title: 'unlocked-c' }),
    ],
    confirmed_at: null,
  });
  try {
    // Drop the middle unlocked row. Locked row stays intact.
    const next = [suggestion.suggestions[0]!, suggestion.suggestions[2]!];
    const updated = await splitSuggestionService.updateSuggestions(suggestion.id, next);
    assert.equal(updated.suggestions.length, 2);
    assert.equal(updated.suggestions[0]!.child_task_id, 999_010);
    assert.equal(updated.suggestions[1]!.title, 'unlocked-c');
  } finally {
    await splitSuggestionRepository.delete(suggestion.id);
    await taskRepository.delete(parent.id);
    await projectRepository.delete(project.id);
  }
});

test.test('updateSuggestions allows appending new rows while locked rows unchanged', async () => {
  const project = await projectRepository.create({
    name: `split-append-${Date.now()}-${Math.random()}`,
    description: undefined,
    git_url: undefined,
    local_path: undefined,
    env: {},
  });
  const parent = await taskRepository.create({
    title: 'parent', description: '', project_id: project.id,
    status: 'IN_PROGRESS', priority: 'MEDIUM', source: 'internal',
    depends_on: [], labels: [],
  });
  const suggestion = await splitSuggestionRepository.create({
    parent_task_id: parent.id,
    workflow_run_id: null,
    status: 'CONFIRMED',
    suggestions: [
      buildSuggestion({ title: 'a', child_task_id: 999_003 }),
    ],
    confirmed_at: new Date().toISOString(),
  });
  try {
    const next = [
      suggestion.suggestions[0]!,
      buildSuggestion({ title: 'b' }),
    ];
    const updated = await splitSuggestionService.updateSuggestions(suggestion.id, next);
    assert.equal(updated.suggestions.length, 2);
    assert.equal(updated.suggestions[1]!.child_task_id, null);
  } finally {
    await splitSuggestionRepository.delete(suggestion.id);
    await taskRepository.delete(parent.id);
    await projectRepository.delete(project.id);
  }
});

test.test('confirm partial failure: already-created task ids are persisted to suggestion', async () => {
  const project = await projectRepository.create({
    name: `split-partial-${Date.now()}-${Math.random()}`,
    description: undefined,
    git_url: undefined,
    local_path: undefined,
    env: {},
  });
  const parent = await taskRepository.create({
    title: 'parent', description: '', project_id: project.id,
    status: 'IN_PROGRESS', priority: 'MEDIUM', source: 'internal',
    depends_on: [], labels: [],
  });
  const suggestion = await splitSuggestionRepository.create({
    parent_task_id: parent.id,
    workflow_run_id: null,
    status: 'PENDING',
    suggestions: [
      buildSuggestion({ title: 's1' }),
      buildSuggestion({ title: 's2' }),
      buildSuggestion({ title: 's3' }),
    ],
    confirmed_at: null,
  });
  const stub = stubTaskService();
  const originalCreate = taskService.taskRepo.create.bind(taskService.taskRepo);
  let callCount = 0;
  taskService.taskRepo.create = (async (...args: Parameters<typeof originalCreate>) => {
    callCount++;
    if (callCount === 2) throw new Error('simulated failure on second create');
    return originalCreate(...args);
  }) as typeof taskService.taskRepo.create;
  try {
    await assert.rejects(splitSuggestionService.confirm(suggestion.id), /simulated failure/);
    const updated = (await splitSuggestionRepository.findById(suggestion.id))!;
    assert.ok(updated.suggestions[0]!.child_task_id != null, 's1 must have child_task_id');
    assert.equal(updated.suggestions[1]!.child_task_id, null, 's2 must remain unbuilt');
    assert.equal(updated.suggestions[2]!.child_task_id, null, 's3 must remain unbuilt');
    // 第一个 task 必须真的进了 DB（不是只有 suggestion 上有 id 而真实 task 不存在）
    const firstChild = await taskRepository.findById(updated.suggestions[0]!.child_task_id!);
    assert.ok(firstChild, 's1 child task must exist in DB');
  } finally {
    taskService.taskRepo.create = originalCreate;
    stub.restore();
    const children = await taskRepository.findChildren(parent.id);
    for (const c of children) await taskRepository.delete(c.id);
    await splitSuggestionRepository.delete(suggestion.id);
    await taskRepository.delete(parent.id);
    await projectRepository.delete(project.id);
  }
});
