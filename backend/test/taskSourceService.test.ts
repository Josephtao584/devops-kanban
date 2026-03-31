import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { TaskSourceService } from '../src/services/taskSourceService.js';
import { TaskRepository } from '../src/repositories/taskRepository.js';
import { TaskSourceRepository } from '../src/repositories/taskSourceRepository.js';
import { registerAdapter } from '../src/sources/index.js';
import { TaskSourceAdapter } from '../src/sources/base.js';
import type { ImportedTask } from '../src/types/sources.ts';

class TestSyncAdapter extends TaskSourceAdapter {
  static override type = 'TEST_SYNC';

  static override metadata = {
    type: 'TEST_SYNC',
    name: 'Test sync adapter',
    description: 'Used by task source service tests',
  };

  static tasks: ImportedTask[] = [];

  override async fetch(): Promise<ImportedTask[]> {
    return TestSyncAdapter.tasks;
  }

  override async testConnection(): Promise<boolean> {
    return true;
  }

  override convertToTask(item: unknown): ImportedTask {
    return item as ImportedTask;
  }
}

registerAdapter(TestSyncAdapter);

async function withIsolatedStorage(run: (tempRoot: string) => Promise<void>) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'task-source-service-test-'));
  const originalStoragePath = process.env.STORAGE_PATH;

  process.env.STORAGE_PATH = tempRoot;

  try {
    await run(tempRoot);
  } finally {
    if (originalStoragePath === undefined) {
      delete process.env.STORAGE_PATH;
    } else {
      process.env.STORAGE_PATH = originalStoragePath;
    }

    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

test.test('TaskSourceService sync refreshes source-owned task fields without overwriting planning fields', async () => {
  await withIsolatedStorage(async (_tempRoot) => {
    const sourceRepo = new TaskSourceRepository();
    const taskRepo = new TaskRepository();
    const service = new TaskSourceService();

    const source = await sourceRepo.create({
      name: 'CloudDevOps',
      type: 'TEST_SYNC',
      project_id: 42,
      config: {},
      enabled: true,
    });

    const existingTask = await taskRepo.create({
      title: 'Old title',
      description: 'Old description',
      project_id: 7,
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      external_id: 'EXT-1',
      external_url: 'https://old.example/task/EXT-1',
      source: 'OLD_SOURCE',
      labels: ['legacy'],
      iteration_id: 88,
      workflow_run_id: 123,
      worktree_path: '/tmp/worktree',
      worktree_branch: 'feature/keep-me',
    });

    TestSyncAdapter.tasks = [
      {
        external_id: 'EXT-1',
        title: 'Fresh synced title',
        description: 'Fresh synced description',
        external_url: 'https://new.example/task/EXT-1',
        status: 'DONE',
        labels: ['cloud', 'story'],
        created_at: null,
        updated_at: null,
      },
    ];

    const syncedTasks = await service.sync(String(source.id));
    const updatedTask = await taskRepo.findById(existingTask.id);

    assert.equal(syncedTasks.length, 1);
    assert.ok(updatedTask);
    assert.equal(updatedTask?.project_id, 42);
    assert.equal(updatedTask?.title, 'Fresh synced title');
    assert.equal(updatedTask?.description, 'Fresh synced description');
    assert.equal(updatedTask?.external_url, 'https://new.example/task/EXT-1');
    assert.deepEqual(updatedTask?.labels, ['cloud', 'story']);
    assert.equal(updatedTask?.source, 'TEST_SYNC');

    assert.equal(updatedTask?.status, 'IN_PROGRESS');
    assert.equal(updatedTask?.priority, 'HIGH');
    assert.equal(updatedTask?.iteration_id, 88);
    assert.equal(updatedTask?.workflow_run_id, 123);
    assert.equal(updatedTask?.worktree_path, '/tmp/worktree');
    assert.equal(updatedTask?.worktree_branch, 'feature/keep-me');
  });
});
