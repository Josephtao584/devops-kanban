import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { closeDbClient, getDbClient } from '../../src/db/client.js';
import { initDatabase } from '../../src/db/schema.js';
import { SplitSuggestionRepository } from '../../src/repositories/splitSuggestionRepository.js';
import { TaskRepository } from '../../src/repositories/taskRepository.js';
import { ProjectRepository } from '../../src/repositories/projectRepository.js';

const origStorage = process.env.STORAGE_PATH;

async function withIsolatedStorage(run: () => Promise<void>) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'split-suggestion-repo-test-'));
  process.env.STORAGE_PATH = tempRoot;
  await closeDbClient();
  await initDatabase();
  try {
    await run();
  } finally {
    await closeDbClient();
    if (origStorage === undefined) {
      delete process.env.STORAGE_PATH;
    } else {
      process.env.STORAGE_PATH = origStorage;
    }
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

test.test('parseRow defaults create_worktree and auto_start to true when missing', async () => {
  await withIsolatedStorage(async () => {
    const projectRepo = new ProjectRepository();
    const taskRepo = new TaskRepository();
    const splitRepo = new SplitSuggestionRepository();

    const project = await projectRepo.create({
      name: 'p',
      description: undefined,
      git_url: undefined,
      local_path: undefined,
      env: {},
    });
    const parent = await taskRepo.create({
      title: 'parent',
      description: '',
      project_id: project.id,
      status: 'TODO',
      priority: 'MEDIUM',
      source: 'internal',
      depends_on: [],
      labels: [],
    });

    // Insert a row that mimics legacy data without the two new fields.
    const legacyJson = JSON.stringify([
      {
        title: 'child',
        description: 'd',
        template_id: null,
        linked_project_id: null,
        target_repo_url: null,
        depends_on_indices: [],
        enabled: true,
      },
    ]);
    const client = getDbClient();
    await client.execute({
      sql: `INSERT INTO split_suggestions (parent_task_id, workflow_run_id, status, suggestions, confirmed_at) VALUES (?, ?, ?, ?, ?)`,
      args: [parent.id, null, 'PENDING', legacyJson, null],
    });

    const found = await splitRepo.findPendingByParentTask(parent.id);
    assert.ok(found);
    assert.equal(found!.suggestions.length, 1);
    assert.equal(found!.suggestions[0]!.create_worktree, true);
    assert.equal(found!.suggestions[0]!.auto_start, true);
  });
});

test.test('parseRow preserves create_worktree and auto_start when explicitly false', async () => {
  await withIsolatedStorage(async () => {
    const projectRepo = new ProjectRepository();
    const taskRepo = new TaskRepository();
    const splitRepo = new SplitSuggestionRepository();

    const project = await projectRepo.create({
      name: 'p',
      description: undefined,
      git_url: undefined,
      local_path: undefined,
      env: {},
    });
    const parent = await taskRepo.create({
      title: 'parent',
      description: '',
      project_id: project.id,
      status: 'TODO',
      priority: 'MEDIUM',
      source: 'internal',
      depends_on: [],
      labels: [],
    });

    const json = JSON.stringify([
      {
        title: 'child',
        description: 'd',
        template_id: null,
        linked_project_id: null,
        target_repo_url: null,
        depends_on_indices: [],
        enabled: true,
        create_worktree: false,
        auto_start: false,
      },
    ]);
    const client = getDbClient();
    await client.execute({
      sql: `INSERT INTO split_suggestions (parent_task_id, workflow_run_id, status, suggestions, confirmed_at) VALUES (?, ?, ?, ?, ?)`,
      args: [parent.id, null, 'PENDING', json, null],
    });

    const found = await splitRepo.findPendingByParentTask(parent.id);
    assert.ok(found);
    assert.equal(found!.suggestions[0]!.create_worktree, false);
    assert.equal(found!.suggestions[0]!.auto_start, false);
  });
});

test.test('parseRow preserves create_worktree and auto_start when explicitly true', async () => {
  await withIsolatedStorage(async () => {
    const projectRepo = new ProjectRepository();
    const taskRepo = new TaskRepository();
    const splitRepo = new SplitSuggestionRepository();

    const project = await projectRepo.create({
      name: 'p',
      description: undefined,
      git_url: undefined,
      local_path: undefined,
      env: {},
    });
    const parent = await taskRepo.create({
      title: 'parent',
      description: '',
      project_id: project.id,
      status: 'TODO',
      priority: 'MEDIUM',
      source: 'internal',
      depends_on: [],
      labels: [],
    });

    const json = JSON.stringify([
      {
        title: 'child',
        description: 'd',
        template_id: null,
        linked_project_id: null,
        target_repo_url: null,
        depends_on_indices: [],
        enabled: true,
        create_worktree: true,
        auto_start: true,
      },
    ]);
    const client = getDbClient();
    await client.execute({
      sql: `INSERT INTO split_suggestions (parent_task_id, workflow_run_id, status, suggestions, confirmed_at) VALUES (?, ?, ?, ?, ?)`,
      args: [parent.id, null, 'PENDING', json, null],
    });

    const found = await splitRepo.findPendingByParentTask(parent.id);
    assert.ok(found);
    assert.equal(found!.suggestions[0]!.create_worktree, true);
    assert.equal(found!.suggestions[0]!.auto_start, true);
  });
});
