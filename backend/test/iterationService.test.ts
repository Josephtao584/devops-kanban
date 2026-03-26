import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { IterationService } from '../src/services/iterationService.js';
import { TaskRepository } from '../src/repositories/taskRepository.js';
import { ProjectRepository } from '../src/repositories/projectRepository.js';

async function withIsolatedStorage(run: (tempRoot: string) => Promise<void>) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'iteration-service-test-'));
  try {
    await run(tempRoot);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

test.test('create persists all supported iteration fields', async () => {
  await withIsolatedStorage(async (tempRoot) => {
    const projectRepo = new ProjectRepository(tempRoot);
    const project = await projectRepo.create({ name: 'Alpha' });
    const service = new IterationService({ storagePath: tempRoot });

    const iteration = await service.create({
      project_id: project.id,
      name: 'Sprint 12',
      description: '稳定版本冲刺',
      goal: '完成发布前收尾',
      start_date: '2026-03-01',
      end_date: '2026-03-15',
      status: 'ACTIVE',
    });

    assert.equal(iteration.project_id, project.id);
    assert.equal(iteration.name, 'Sprint 12');
    assert.equal(iteration.description, '稳定版本冲刺');
    assert.equal(iteration.goal, '完成发布前收尾');
    assert.equal(iteration.start_date, '2026-03-01');
    assert.equal(iteration.end_date, '2026-03-15');
    assert.equal(iteration.status, 'ACTIVE');
  });
});

test.test('update persists all editable iteration fields', async () => {
  await withIsolatedStorage(async (tempRoot) => {
    const projectRepo = new ProjectRepository(tempRoot);
    const project = await projectRepo.create({ name: 'Alpha' });
    const service = new IterationService({ storagePath: tempRoot });
    const created = await service.create({
      project_id: project.id,
      name: 'Sprint 12',
      status: 'PLANNED',
    });

    const updated = await service.update(created.id, {
      name: 'Sprint 12A',
      description: '增加稳定性验证',
      goal: '完成验收并归档',
      start_date: '2026-03-02',
      end_date: '2026-03-18',
      status: 'COMPLETED',
    });

    assert.ok(updated);
    assert.equal(updated?.name, 'Sprint 12A');
    assert.equal(updated?.description, '增加稳定性验证');
    assert.equal(updated?.goal, '完成验收并归档');
    assert.equal(updated?.start_date, '2026-03-02');
    assert.equal(updated?.end_date, '2026-03-18');
    assert.equal(updated?.status, 'COMPLETED');
  });
});

test.test('delete detaches tasks before removing iteration by default', async () => {
  await withIsolatedStorage(async (tempRoot) => {
    const projectRepo = new ProjectRepository(tempRoot);
    const project = await projectRepo.create({ name: 'Alpha' });
    const service = new IterationService({ storagePath: tempRoot });
    const taskRepo = new TaskRepository(tempRoot);

    const iteration = await service.create({
      project_id: project.id,
      name: 'Sprint 12',
      status: 'ACTIVE',
    });

    const task = await taskRepo.create({
      title: '完成联调',
      project_id: project.id,
      iteration_id: iteration.id,
      status: 'TODO',
    });

    const deleted = await service.delete(iteration.id);

    assert.equal(deleted, true);
    const deletedIteration = await service.getById(iteration.id);
    assert.equal(deletedIteration, null);

    const updatedTask = await taskRepo.findById(task.id);
    assert.ok(updatedTask);
    assert.equal(updatedTask?.iteration_id, null);
  });
});

test.test('delete removes linked tasks when deleteTasks is true', async () => {
  await withIsolatedStorage(async (tempRoot) => {
    const projectRepo = new ProjectRepository(tempRoot);
    const project = await projectRepo.create({ name: 'Alpha' });
    const service = new IterationService({ storagePath: tempRoot });
    const taskRepo = new TaskRepository(tempRoot);

    const iteration = await service.create({
      project_id: project.id,
      name: 'Sprint 12',
      status: 'ACTIVE',
    });

    const task = await taskRepo.create({
      title: '完成联调',
      project_id: project.id,
      iteration_id: iteration.id,
      status: 'TODO',
    });

    const deleted = await service.delete(iteration.id, true);

    assert.equal(deleted, true);
    const deletedIteration = await service.getById(iteration.id);
    assert.equal(deletedIteration, null);

    const deletedTask = await taskRepo.findById(task.id);
    assert.equal(deletedTask, null);
  });
});

test.test('delete returns false when iteration does not exist', async () => {
  await withIsolatedStorage(async (tempRoot) => {
    const service = new IterationService({ storagePath: tempRoot });
    const deleted = await service.delete(9999);
    assert.equal(deleted, false);
  });
});
