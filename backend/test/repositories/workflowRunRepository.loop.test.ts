import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import { createClient } from '@libsql/client';
import { migrateSchema } from '../../src/db/migrate.js';
import { WorkflowRunRepository } from '../../src/repositories/workflowRunRepository.js';

function extractCreateTableSql(sql: string): string {
  const matches = sql.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+[\s\S]*?\);/gi);
  return matches ? matches.join('\n\n') : '';
}

async function makeRepo() {
  const client = createClient({ url: ':memory:' });
  const schemaPath = path.join(import.meta.dirname, '../../src/db/schema.sql');
  const schemaSql = await fsPromises.readFile(schemaPath, 'utf-8');
  const tableSql = extractCreateTableSql(schemaSql);
  if (tableSql) {
    await client.executeMultiple(tableSql);
  }
  await migrateSchema(client, schemaSql);
  return new WorkflowRunRepository(client);
}

test.test('persists loop fields on create and read', async () => {
  const repo = await makeRepo();
  const result = await repo.createIfNoActiveRun({
    task_id: 1,
    workflow_instance_id: 'inst-1',
    status: 'PENDING',
    current_step: 'step1',
    steps: [],
    worktree_path: '/tmp/wt',
    branch: 'feature/x',
    context: {},
    parent_run_id: 42,
    iteration: 2,
    looped_from_step_id: 'step1',
    loop_failure_context: { failed_step_id: 'step3', error: 'boom', summary: null },
  });
  assert.ok(result.created);
  const found = await repo.findById(result.created.id);
  assert.equal(found?.parent_run_id, 42);
  assert.equal(found?.iteration, 2);
  assert.equal(found?.looped_from_step_id, 'step1');
  assert.deepEqual(found?.loop_failure_context, {
    failed_step_id: 'step3',
    error: 'boom',
    summary: null,
  });
});

test.test('original runs default to iteration=1, parent=null', async () => {
  const repo = await makeRepo();
  const result = await repo.createIfNoActiveRun({
    task_id: 2,
    workflow_instance_id: 'inst-2',
    status: 'PENDING',
    current_step: null,
    steps: [],
    worktree_path: '/tmp/wt2',
    branch: 'master',
    context: {},
  });
  const found = await repo.findById(result.created!.id);
  assert.equal(found?.iteration, 1);
  assert.equal(found?.parent_run_id, null);
  assert.equal(found?.looped_from_step_id, null);
  assert.equal(found?.loop_failure_context, null);
});

test.test('findAllByTaskIdOrdered returns runs sorted by iteration', async () => {
  const repo = await makeRepo();
  for (const iter of [1, 3, 2]) {
    await repo.createIfNoActiveRun({
      task_id: 5,
      workflow_instance_id: 'inst-5',
      status: 'FAILED',
      current_step: null,
      steps: [],
      worktree_path: '/tmp/wt5',
      branch: 'master',
      context: {},
      iteration: iter,
      parent_run_id: iter > 1 ? iter - 1 : null,
    });
  }
  const runs = await repo.findAllByTaskIdOrdered(5);
  assert.deepEqual(runs.map(r => r.iteration), [1, 2, 3]);
});

test.test('findInFlightChild returns active child run if exists', async () => {
  const repo = await makeRepo();
  const parent = (await repo.createIfNoActiveRun({
    task_id: 7,
    workflow_instance_id: 'inst-7',
    status: 'FAILED',
    current_step: null,
    steps: [],
    worktree_path: '/tmp/wt7',
    branch: 'master',
    context: {},
  })).created!;
  await repo.createIfNoActiveRun({
    task_id: 7,
    workflow_instance_id: 'inst-7',
    status: 'RUNNING',
    current_step: 'step2',
    steps: [],
    worktree_path: '/tmp/wt7',
    branch: 'master',
    context: {},
    parent_run_id: parent.id,
    iteration: 2,
    looped_from_step_id: 'step2',
  });
  const inflight = await repo.findInFlightChild(parent.id);
  assert.ok(inflight);
  assert.equal(inflight?.parent_run_id, parent.id);
});
