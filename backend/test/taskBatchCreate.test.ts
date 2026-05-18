import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taskService } from '../src/services/taskService.js';
import { taskRepository } from '../src/repositories/taskRepository.js';
import { projectRepository } from '../src/repositories/projectRepository.js';

test('batchCreate assigns depends_on from indices', async () => {
  const project = await projectRepository.create({ name: 'test-proj-batch', env: {} } as any);
  const parent = await taskRepository.create({
    title: 'root', project_id: project.id, status: 'IN_PROGRESS', priority: 'MEDIUM', source: 'internal', depends_on: [],
  } as any);

  const result = await taskService.batchCreate({
    parent_task_id: parent.id,
    suggestions: [
      { title: 'A', description: '', template_id: null, linked_project_id: project.id, target_repo_url: null, depends_on_indices: [], enabled: true },
      { title: 'B', description: '', template_id: null, linked_project_id: project.id, target_repo_url: null, depends_on_indices: [0], enabled: true },
    ],
  });

  assert.equal(result.length, 2);
  assert.deepEqual(result[0]!.depends_on, []);
  assert.deepEqual(result[1]!.depends_on, [result[0]!.id]);
  assert.equal(result[0]!.status, 'TODO');
  assert.equal(result[1]!.status, 'WAITING');

  for (const t of result) await taskRepository.delete(t.id);
  await taskRepository.delete(parent.id);
  await projectRepository.delete(project.id);
});

test('batchCreate rejects disabled suggestions', async () => {
  const project = await projectRepository.create({ name: 'test-proj-disabled', env: {} } as any);
  const parent = await taskRepository.create({
    title: 'root', project_id: project.id, status: 'IN_PROGRESS', priority: 'MEDIUM', source: 'internal', depends_on: [],
  } as any);

  const result = await taskService.batchCreate({
    parent_task_id: parent.id,
    suggestions: [
      { title: 'A', description: '', template_id: null, linked_project_id: project.id, target_repo_url: null, depends_on_indices: [], enabled: false },
      { title: 'B', description: '', template_id: null, linked_project_id: project.id, target_repo_url: null, depends_on_indices: [], enabled: true },
    ],
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]!.title, 'B');

  for (const t of result) await taskRepository.delete(t.id);
  await taskRepository.delete(parent.id);
  await projectRepository.delete(project.id);
});

test('batchCreate rejects cyclic dependencies', async () => {
  const project = await projectRepository.create({ name: 'test-proj-cycle', env: {} } as any);
  const parent = await taskRepository.create({
    title: 'root', project_id: project.id, status: 'IN_PROGRESS', priority: 'MEDIUM', source: 'internal', depends_on: [],
  } as any);

  await assert.rejects(async () => {
    await taskService.batchCreate({
      parent_task_id: parent.id,
      suggestions: [
        { title: 'A', description: '', template_id: null, linked_project_id: project.id, target_repo_url: null, depends_on_indices: [1], enabled: true },
        { title: 'B', description: '', template_id: null, linked_project_id: project.id, target_repo_url: null, depends_on_indices: [0], enabled: true },
      ],
    });
  }, /cycle/i);

  await taskRepository.delete(parent.id);
  await projectRepository.delete(project.id);
});

test('batchCreate links cross-batch deps to existing task ids by original index', async () => {
  const project = await projectRepository.create({ name: 'test-proj-existing-deps', env: {} } as any);
  const parent = await taskRepository.create({
    title: 'root', project_id: project.id, status: 'IN_PROGRESS', priority: 'MEDIUM', source: 'internal', depends_on: [],
  } as any);
  const existingChild = await taskRepository.create({
    title: 'A', project_id: project.id, status: 'TODO', priority: 'MEDIUM', source: 'internal', parent_task_id: parent.id, depends_on: [],
  } as any);

  // Original suggestions [A, B, C] where C depends on A (idx 0) and B (idx 1).
  // A was already created in a prior confirm; this batch creates B and C.
  const result = await taskService.batchCreate({
    parent_task_id: parent.id,
    suggestions: [
      { title: 'A', description: '', template_id: null, linked_project_id: project.id, target_repo_url: null, depends_on_indices: [], enabled: true },
      { title: 'B', description: '', template_id: null, linked_project_id: project.id, target_repo_url: null, depends_on_indices: [], enabled: true },
      { title: 'C', description: '', template_id: null, linked_project_id: project.id, target_repo_url: null, depends_on_indices: [0, 1], enabled: true },
    ],
    skip_indices: [0],
    existing_task_id_by_index: { 0: existingChild.id },
  });

  assert.equal(result.length, 2);
  const [b, c] = result;
  assert.equal(b!.title, 'B');
  assert.equal(c!.title, 'C');
  // B has no deps -> TODO
  assert.deepEqual(b!.depends_on, []);
  assert.equal(b!.status, 'TODO');
  // C depends on existing A (real id) and freshly-created B (real id) -> WAITING
  assert.deepEqual([...c!.depends_on!].sort(), [existingChild.id, b!.id].sort());
  assert.equal(c!.status, 'WAITING');

  for (const t of result) await taskRepository.delete(t.id);
  await taskRepository.delete(existingChild.id);
  await taskRepository.delete(parent.id);
  await projectRepository.delete(project.id);
});

test('batchCreate drops dependency index that has neither in-batch nor existing match', async () => {
  const project = await projectRepository.create({ name: 'test-proj-orphan-dep', env: {} } as any);
  const parent = await taskRepository.create({
    title: 'root', project_id: project.id, status: 'IN_PROGRESS', priority: 'MEDIUM', source: 'internal', depends_on: [],
  } as any);

  // Suggestion B references idx 0 (skipped, with no existing mapping) — that
  // dep should be silently dropped rather than corrupting B's depends_on.
  const result = await taskService.batchCreate({
    parent_task_id: parent.id,
    suggestions: [
      { title: 'A', description: '', template_id: null, linked_project_id: project.id, target_repo_url: null, depends_on_indices: [], enabled: true },
      { title: 'B', description: '', template_id: null, linked_project_id: project.id, target_repo_url: null, depends_on_indices: [0], enabled: true },
    ],
    skip_indices: [0],
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]!.title, 'B');
  assert.deepEqual(result[0]!.depends_on, []);
  assert.equal(result[0]!.status, 'TODO');

  for (const t of result) await taskRepository.delete(t.id);
  await taskRepository.delete(parent.id);
  await projectRepository.delete(project.id);
});
