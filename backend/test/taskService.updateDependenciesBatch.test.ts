import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taskService } from '../src/services/taskService.js';
import { taskRepository } from '../src/repositories/taskRepository.js';
import { projectRepository } from '../src/repositories/projectRepository.js';

async function setupPipeline() {
  const project = await projectRepository.create({ name: `dep-edit-${Date.now()}-${Math.random()}`, env: {} } as any);
  const root = await taskRepository.create({ title: 'root', project_id: project.id, status: 'TODO', priority: 'MEDIUM', source: 'internal', depends_on: [] } as any);
  const a = await taskRepository.create({ title: 'A', project_id: project.id, status: 'TODO', priority: 'MEDIUM', source: 'internal', parent_task_id: root.id, depends_on: [] } as any);
  const b = await taskRepository.create({ title: 'B', project_id: project.id, status: 'TODO', priority: 'MEDIUM', source: 'internal', parent_task_id: root.id, depends_on: [] } as any);
  const c = await taskRepository.create({ title: 'C', project_id: project.id, status: 'TODO', priority: 'MEDIUM', source: 'internal', parent_task_id: root.id, depends_on: [] } as any);
  return { project, root, a, b, c };
}

async function teardownPipeline(setup: Awaited<ReturnType<typeof setupPipeline>>) {
  await taskRepository.delete(setup.c.id);
  await taskRepository.delete(setup.b.id);
  await taskRepository.delete(setup.a.id);
  await taskRepository.delete(setup.root.id);
  await projectRepository.delete(setup.project.id);
}

test('updateDependenciesBatch writes new depends_on for happy path', async () => {
  const s = await setupPipeline();
  try {
    const result = await taskService.updateDependenciesBatch(s.root.id, [
      { from: s.a.id, to: s.b.id },
      { from: s.b.id, to: s.c.id },
    ]);
    assert.ok(result.updated >= 2);
    const aAfter = await taskRepository.findById(s.a.id);
    const bAfter = await taskRepository.findById(s.b.id);
    const cAfter = await taskRepository.findById(s.c.id);
    assert.deepEqual(aAfter!.depends_on ?? [], []);
    assert.deepEqual(bAfter!.depends_on ?? [], [s.a.id]);
    assert.deepEqual(cAfter!.depends_on ?? [], [s.b.id]);
  } finally {
    await teardownPipeline(s);
  }
});

test('updateDependenciesBatch rejects edges referencing tasks outside pipeline', async () => {
  const s = await setupPipeline();
  try {
    await assert.rejects(
      () => taskService.updateDependenciesBatch(s.root.id, [{ from: 999999, to: s.b.id }]),
      (err: any) => {
        assert.equal(err.name, 'BusinessError');
        assert.match(err.userMessage, /依赖引用不合法/);
        return true;
      },
    );
  } finally {
    await teardownPipeline(s);
  }
});

test('updateDependenciesBatch rejects self-loop', async () => {
  const s = await setupPipeline();
  try {
    await assert.rejects(
      () => taskService.updateDependenciesBatch(s.root.id, [{ from: s.a.id, to: s.a.id }]),
      (err: any) => {
        assert.equal(err.name, 'BusinessError');
        assert.match(err.userMessage, /依赖不能指向自身/);
        return true;
      },
    );
  } finally {
    await teardownPipeline(s);
  }
});

test('updateDependenciesBatch rejects cycle and reports path', async () => {
  const s = await setupPipeline();
  try {
    await assert.rejects(
      () => taskService.updateDependenciesBatch(s.root.id, [
        { from: s.a.id, to: s.b.id },
        { from: s.b.id, to: s.c.id },
        { from: s.c.id, to: s.a.id },
      ]),
      (err: any) => {
        assert.equal(err.name, 'BusinessError');
        assert.match(err.userMessage, /环路/);
        assert.ok(Array.isArray(err.context?.cycle));
        const cyc: number[] = err.context.cycle;
        assert.equal(cyc[0], cyc[cyc.length - 1]);
        return true;
      },
    );
  } finally {
    await teardownPipeline(s);
  }
});

test('updateDependenciesBatch with empty edges clears all depends_on', async () => {
  const s = await setupPipeline();
  await taskRepository.update(s.b.id, { depends_on: [s.a.id] } as any);
  await taskRepository.update(s.c.id, { depends_on: [s.b.id] } as any);
  try {
    const result = await taskService.updateDependenciesBatch(s.root.id, []);
    assert.ok(result.updated >= 2);
    const bAfter = await taskRepository.findById(s.b.id);
    const cAfter = await taskRepository.findById(s.c.id);
    assert.deepEqual(bAfter!.depends_on ?? [], []);
    assert.deepEqual(cAfter!.depends_on ?? [], []);
  } finally {
    await teardownPipeline(s);
  }
});

test('updateDependenciesBatch leaves DB untouched when validation fails', async () => {
  const s = await setupPipeline();
  await taskRepository.update(s.b.id, { depends_on: [s.a.id] } as any);
  try {
    await assert.rejects(
      () => taskService.updateDependenciesBatch(s.root.id, [
        { from: s.a.id, to: s.b.id },
        { from: s.b.id, to: s.a.id },
      ]),
      (err: any) => err.name === 'BusinessError',
    );
    const bAfter = await taskRepository.findById(s.b.id);
    const aAfter = await taskRepository.findById(s.a.id);
    assert.deepEqual(bAfter!.depends_on ?? [], [s.a.id], 'B 的 depends_on 不应被改动');
    assert.deepEqual(aAfter!.depends_on ?? [], [], 'A 的 depends_on 不应被改动');
  } finally {
    await teardownPipeline(s);
  }
});

test('updateDependenciesBatch tasks omitted from edges have depends_on cleared', async () => {
  const s = await setupPipeline();
  await taskRepository.update(s.b.id, { depends_on: [s.a.id] } as any);
  await taskRepository.update(s.c.id, { depends_on: [s.b.id] } as any);
  try {
    const result = await taskService.updateDependenciesBatch(s.root.id, [
      { from: s.a.id, to: s.c.id },
    ]);
    const bAfter = await taskRepository.findById(s.b.id);
    const cAfter = await taskRepository.findById(s.c.id);
    assert.deepEqual(bAfter!.depends_on ?? [], [], 'B 不在 edges 中应被清空');
    assert.deepEqual(cAfter!.depends_on ?? [], [s.a.id]);
    assert.ok(result.updated >= 2);
  } finally {
    await teardownPipeline(s);
  }
});
