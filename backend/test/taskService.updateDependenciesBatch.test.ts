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

test.test('updateDependenciesBatch rejects edges referencing tasks outside pipeline', async () => {
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

test.test('updateDependenciesBatch rejects self-loop', async () => {
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

test.test('updateDependenciesBatch rejects cycle and reports path', async () => {
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

test.test('updateDependenciesBatch with empty edges clears all depends_on', async () => {
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

test.test('updateDependenciesBatch leaves DB untouched when validation fails', async () => {
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

test.test('updateDependenciesBatch tasks omitted from edges have depends_on cleared', async () => {
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

test.test('updateDependenciesBatch preserves dependencies pointing outside the pipeline', async () => {
  const s = await setupPipeline();
  // External task in a different project: not part of this pipeline.
  const otherProject = await projectRepository.create({ name: `dep-edit-other-${Date.now()}-${Math.random()}`, env: {} } as any);
  const ext = await taskRepository.create({ title: 'EXT', project_id: otherProject.id, status: 'DONE', priority: 'MEDIUM', source: 'internal', depends_on: [] } as any);
  await taskRepository.update(s.b.id, { depends_on: [ext.id] } as any);
  try {
    const result = await taskService.updateDependenciesBatch(s.root.id, [
      { from: s.a.id, to: s.b.id },
    ]);
    const bAfter = await taskRepository.findById(s.b.id);
    const sorted = (bAfter!.depends_on ?? []).slice().sort((x, y) => x - y);
    const expected = [ext.id, s.a.id].sort((x, y) => x - y);
    assert.deepEqual(sorted, expected, 'B 应同时保留 EXT 与新加 A');
    assert.ok(result.updated >= 1);
  } finally {
    await taskRepository.delete(ext.id);
    await projectRepository.delete(otherProject.id);
    await teardownPipeline(s);
  }
});

test.test('updateDependenciesBatch cycle error message contains task titles', async () => {
  const s = await setupPipeline();
  try {
    await assert.rejects(
      () => taskService.updateDependenciesBatch(s.root.id, [
        { from: s.a.id, to: s.b.id },
        { from: s.b.id, to: s.a.id },
      ]),
      (err: any) => {
        assert.equal(err.name, 'BusinessError');
        assert.match(err.userMessage, /A/);
        assert.match(err.userMessage, /B/);
        return true;
      },
    );
  } finally {
    await teardownPipeline(s);
  }
});

test.test('updateDependenciesBatch is atomic — failure in mid-write leaves DB unchanged', async () => {
  const s = await setupPipeline();
  await taskRepository.update(s.b.id, { depends_on: [s.a.id] } as any);
  await taskRepository.update(s.c.id, { depends_on: [s.b.id] } as any);
  // Simulate write failure by stubbing batchUpdateDependsOn to throw.
  const repo: any = (taskService as any).taskRepo;
  const original = repo.batchUpdateDependsOn.bind(repo);
  repo.batchUpdateDependsOn = async () => { throw new Error('simulated write failure'); };
  try {
    await assert.rejects(
      () => taskService.updateDependenciesBatch(s.root.id, [
        { from: s.c.id, to: s.b.id },
        { from: s.a.id, to: s.c.id },
      ]),
      (err: any) => err.message === 'simulated write failure',
    );
    const bAfter = await taskRepository.findById(s.b.id);
    const cAfter = await taskRepository.findById(s.c.id);
    assert.deepEqual(bAfter!.depends_on ?? [], [s.a.id], 'B 应保留旧依赖');
    assert.deepEqual(cAfter!.depends_on ?? [], [s.b.id], 'C 应保留旧依赖');
  } finally {
    repo.batchUpdateDependsOn = original;
    await teardownPipeline(s);
  }
});
