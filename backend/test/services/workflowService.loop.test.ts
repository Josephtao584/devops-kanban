import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as path from 'node:path';

import { createClient } from '@libsql/client';
import { migrateSchema } from '../../src/db/migrate.js';
import { WorkflowRunRepository } from '../../src/repositories/workflowRunRepository.js';
import { WorkflowService } from '../../src/services/workflow/workflowService.js';

function extractCreateTableSql(sql: string): string {
  const matches = sql.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+[\s\S]*?\);/gi);
  return matches ? matches.join('\n\n') : '';
}

async function makeRepo(): Promise<WorkflowRunRepository> {
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

interface MakeFailedParentOpts {
  iteration?: number;
  taskId?: number;
  worktree?: string;
  failedStepId?: string;
}

function makeFailedParent(repo: WorkflowRunRepository, opts: MakeFailedParentOpts) {
  const wt = opts.worktree ?? mkdtempSync(join(tmpdir(), 'loop-test-'));
  const failedStepId = opts.failedStepId ?? 'step3';
  return repo.createIfNoActiveRun({
    task_id: opts.taskId ?? 1,
    workflow_instance_id: 'inst-1',
    status: 'FAILED',
    current_step: failedStepId,
    steps: [
      { step_id: 'step1', name: 'S1', status: 'COMPLETED' },
      { step_id: 'step2', name: 'S2', status: 'COMPLETED' },
      { step_id: failedStepId, name: 'S3', status: 'FAILED', error: 'boom' },
    ],
    worktree_path: wt,
    branch: 'master',
    context: {},
    iteration: opts.iteration ?? 1,
  });
}

async function makeService() {
  const runRepo = await makeRepo();
  const instanceService = {
    async getByInstanceId() {
      return {
        id: 1,
        instance_id: 'inst-1',
        template_id: 't1',
        template_version: 'v1',
        name: 'I1',
        steps: [
          { id: 'step1', name: 'S1', agentId: 1, instructionPrompt: 'p1', onFailureLoopTo: null },
          { id: 'step2', name: 'S2', agentId: 1, instructionPrompt: 'p2', onFailureLoopTo: null },
          { id: 'step3', name: 'S3', agentId: 1, instructionPrompt: 'p3', onFailureLoopTo: 'step2' },
        ],
        created_at: '',
        updated_at: '',
      };
    },
  };
  const templateService = {
    async getTemplateById() {
      return { id: 1, template_id: 't1', name: 'T1', steps: [], maxLoops: 2, created_at: '', updated_at: '' };
    },
  };
  const taskRepo = {
    async findById() {
      return { id: 1, project_id: 1, title: 'T', description: 'D' };
    },
    async update() {
      return null;
    },
  };
  const projectRepo = {
    async findById() {
      return { id: 1, env: {} };
    },
  };
  const service = new WorkflowService({
    workflowRunRepo: runRepo,
    instanceService: instanceService as any,
    templateService: templateService as any,
    taskRepo: taskRepo as any,
    projectRepo: projectRepo as any,
    agentRepo: {} as any,
    lifecycle: { async onWorkflowStart() {} } as any,
  });
  // Override the side-effecting executor; loop tests only validate run creation.
  (service as any).executeWorkflow = async () => {};
  return { service, runRepo };
}

test.test('createLoopRun creates a new run with iteration+1 and SKIPPED inherited steps', async () => {
  const { service, runRepo } = await makeService();
  const parent = (await makeFailedParent(runRepo, {})).created!;
  const newRun = await service.createLoopRun(parent.id, 'step2');
  assert.equal(newRun.iteration, 2);
  assert.equal(newRun.parent_run_id, parent.id);
  assert.equal(newRun.looped_from_step_id, 'step2');
  assert.equal(newRun.steps[0]!.status, 'SKIPPED');
  assert.equal(newRun.steps[0]!.inherited_from_run_id, parent.id);
  assert.equal(newRun.steps[1]!.status, 'PENDING');
  assert.equal(newRun.steps[1]!.inherited_from_run_id, null);
  assert.equal(newRun.worktree_path, parent.worktree_path);
  assert.equal(newRun.branch, parent.branch);
  assert.deepEqual(newRun.loop_failure_context, {
    failed_step_id: 'step3',
    error: 'boom',
    summary: null,
  });
});

test.test('createLoopRun rejects if parent is not FAILED', async () => {
  const { service, runRepo } = await makeService();
  const parent = (await runRepo.createIfNoActiveRun({
    task_id: 1, workflow_instance_id: 'inst-1', status: 'RUNNING',
    current_step: null, steps: [], worktree_path: mkdtempSync(join(tmpdir(), 'wt-')),
    branch: 'master', context: {},
  })).created!;
  await assert.rejects(
    service.createLoopRun(parent.id, 'step2'),
    /not in FAILED state/,
  );
});

test.test('createLoopRun rejects if fromStepId is not strictly earlier than failed step', async () => {
  const { service, runRepo } = await makeService();
  const parent = (await makeFailedParent(runRepo, {})).created!;
  await assert.rejects(
    service.createLoopRun(parent.id, 'step3'),
    /must be earlier/,
  );
});

test.test('createLoopRun rejects when iteration > maxLoops without override', async () => {
  const { service, runRepo } = await makeService();
  const parent = (await makeFailedParent(runRepo, { iteration: 2 })).created!;
  // iteration=2 → next would be 3, maxLoops=2 → reject
  await assert.rejects(
    service.createLoopRun(parent.id, 'step2'),
    /maxLoops/,
  );
});

test.test('createLoopRun allows override past maxLoops', async () => {
  const { service, runRepo } = await makeService();
  const parent = (await makeFailedParent(runRepo, { iteration: 5 })).created!;
  const newRun = await service.createLoopRun(parent.id, 'step2', undefined, true);
  assert.equal(newRun.iteration, 6);
});

test.test('createLoopRun rejects if a child run is already in flight', async () => {
  const { service, runRepo } = await makeService();
  const parent = (await makeFailedParent(runRepo, {})).created!;
  await runRepo.createIfNoActiveRun({
    task_id: 1, workflow_instance_id: 'inst-1', status: 'RUNNING',
    current_step: 'step2', steps: [], worktree_path: parent.worktree_path,
    branch: 'master', context: {},
    parent_run_id: parent.id, iteration: 2, looped_from_step_id: 'step2',
  });
  await assert.rejects(
    service.createLoopRun(parent.id, 'step2'),
    /in-flight/,
  );
});

test.test('createLoopRun rejects if worktree path is missing on disk', async () => {
  const { service, runRepo } = await makeService();
  const parent = (await makeFailedParent(runRepo, {})).created!;
  rmSync(parent.worktree_path, { recursive: true, force: true });
  assert.equal(existsSync(parent.worktree_path), false);
  await assert.rejects(
    service.createLoopRun(parent.id, 'step2'),
    /worktree/i,
  );
});
