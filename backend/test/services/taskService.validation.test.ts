import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { TaskService } from '../../src/services/taskService.js';
import { ProjectRepository } from '../../src/repositories/projectRepository.js';
import { closeDbClient } from '../../src/db/client.js';
import { initDatabase } from '../../src/db/schema.js';

async function withIsolatedStorage(run: (tempRoot: string) => Promise<void>) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'task-service-validation-test-'));
  process.env.STORAGE_PATH = tempRoot;
  await closeDbClient();
  await initDatabase();
  try {
    await run(tempRoot);
  } finally {
    await closeDbClient();
    delete process.env.STORAGE_PATH;
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

const longTitle = 'a'.repeat(201);
const exactTitle = 'a'.repeat(200);
const longDesc = 'b'.repeat(5001);
const exactDesc = 'b'.repeat(5000);

// ─── create() validation ─────────────────────────────────

test.test('create rejects title exceeding 200 characters', async () => {
  await withIsolatedStorage(async () => {
    const projectRepo = new ProjectRepository();
    const project = await projectRepo.create({ name: 'Test', description: undefined, git_url: undefined, local_path: undefined, env: {} });
    const service = new TaskService({ projectRepo: projectRepo as never });
    await assert.rejects(
      async () => service.create({ title: longTitle, project_id: project.id }),
      /Task title exceeds maximum length/
    );
  });
});

test.test('create accepts title at exactly 200 characters', async () => {
  await withIsolatedStorage(async () => {
    const projectRepo = new ProjectRepository();
    const project = await projectRepo.create({ name: 'Test', description: undefined, git_url: undefined, local_path: undefined, env: {} });
    const service = new TaskService({ projectRepo: projectRepo as never });
    const task = await service.create({ title: exactTitle, project_id: project.id });
    assert.equal(task.title, exactTitle);
  });
});

test.test('create rejects description exceeding 5000 characters', async () => {
  await withIsolatedStorage(async () => {
    const projectRepo = new ProjectRepository();
    const project = await projectRepo.create({ name: 'Test', description: undefined, git_url: undefined, local_path: undefined, env: {} });
    const service = new TaskService({ projectRepo: projectRepo as never });
    await assert.rejects(
      async () => service.create({ title: 'Valid title', description: longDesc, project_id: project.id }),
      /Task description exceeds maximum length/
    );
  });
});

test.test('create accepts description at exactly 5000 characters', async () => {
  await withIsolatedStorage(async () => {
    const projectRepo = new ProjectRepository();
    const project = await projectRepo.create({ name: 'Test', description: undefined, git_url: undefined, local_path: undefined, env: {} });
    const service = new TaskService({ projectRepo: projectRepo as never });
    const task = await service.create({ title: 'Valid title', description: exactDesc, project_id: project.id });
    assert.equal(task.description, exactDesc);
  });
});

// ─── update() validation ─────────────────────────────────

test.test('update rejects title exceeding 200 characters', async () => {
  await withIsolatedStorage(async () => {
    const projectRepo = new ProjectRepository();
    const project = await projectRepo.create({ name: 'Test', description: undefined, git_url: undefined, local_path: undefined, env: {} });
    const service = new TaskService({ projectRepo: projectRepo as never });
    const task = await service.create({ title: 'Original', project_id: project.id });
    await assert.rejects(
      async () => service.update(task.id, { title: longTitle }),
      /Task title exceeds maximum length/
    );
  });
});

test.test('update rejects empty title', async () => {
  await withIsolatedStorage(async () => {
    const projectRepo = new ProjectRepository();
    const project = await projectRepo.create({ name: 'Test', description: undefined, git_url: undefined, local_path: undefined, env: {} });
    const service = new TaskService({ projectRepo: projectRepo as never });
    const task = await service.create({ title: 'Original', project_id: project.id });
    await assert.rejects(
      async () => service.update(task.id, { title: '   ' }),
      /Task title is required/
    );
  });
});

test.test('update accepts title at exactly 200 characters', async () => {
  await withIsolatedStorage(async () => {
    const projectRepo = new ProjectRepository();
    const project = await projectRepo.create({ name: 'Test', description: undefined, git_url: undefined, local_path: undefined, env: {} });
    const service = new TaskService({ projectRepo: projectRepo as never });
    const task = await service.create({ title: 'Original', project_id: project.id });
    const updated = await service.update(task.id, { title: exactTitle });
    assert.equal(updated!.title, exactTitle);
  });
});

test.test('update rejects description exceeding 5000 characters', async () => {
  await withIsolatedStorage(async () => {
    const projectRepo = new ProjectRepository();
    const project = await projectRepo.create({ name: 'Test', description: undefined, git_url: undefined, local_path: undefined, env: {} });
    const service = new TaskService({ projectRepo: projectRepo as never });
    const task = await service.create({ title: 'Original', project_id: project.id });
    await assert.rejects(
      async () => service.update(task.id, { description: longDesc }),
      /Task description exceeds maximum length/
    );
  });
});

test.test('update accepts description at exactly 5000 characters', async () => {
  await withIsolatedStorage(async () => {
    const projectRepo = new ProjectRepository();
    const project = await projectRepo.create({ name: 'Test', description: undefined, git_url: undefined, local_path: undefined, env: {} });
    const service = new TaskService({ projectRepo: projectRepo as never });
    const task = await service.create({ title: 'Original', project_id: project.id });
    const updated = await service.update(task.id, { description: exactDesc });
    assert.equal(updated!.description, exactDesc);
  });
});
