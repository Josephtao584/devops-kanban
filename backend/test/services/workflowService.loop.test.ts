import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as path from 'node:path';

import Fastify from 'fastify';
import { createClient } from '@libsql/client';
import { WorkflowRunRepository } from '../../src/repositories/workflowRunRepository.js';
import { WorkflowService } from '../../src/services/workflow/workflowService.js';
import { workflowRoutes } from '../../src/routes/workflows.js';

// Tracks every temp dir created by makeTempWorktree so we can clean them up
// once the test file finishes. Prevents /tmp leaks across runs.
const tempDirs: string[] = [];

test.after(() => {
  for (const dir of tempDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
});

function makeTempWorktree(): string {
  const dir = mkdtempSync(join(tmpdir(), 'loop-test-'));
  tempDirs.push(dir);
  return dir;
}

async function makeRepo(): Promise<WorkflowRunRepository> {
  const client = createClient({ url: ':memory:' });
  const schemaPath = path.join(import.meta.dirname, '../../src/db/schema.sql');
  const schemaSql = await fsPromises.readFile(schemaPath, 'utf-8');
  await client.executeMultiple(schemaSql);
  return new WorkflowRunRepository(client);
}

interface MakeFailedParentOpts {
  iteration?: number;
  taskId?: number;
  worktree?: string;
  failedStepId?: string;
}

function makeFailedParent(repo: WorkflowRunRepository, opts: MakeFailedParentOpts) {
  const wt = opts.worktree ?? makeTempWorktree();
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
    current_step: null, steps: [], worktree_path: makeTempWorktree(),
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

test.test('createLoopRun rejects if FAILED parent has no identifiable failed step', async () => {
  // Inconsistent state: parent is FAILED but neither current_step nor any
  // step.status === 'FAILED' identifies which step failed. We should reject
  // loudly rather than silently skip the order check.
  const { service, runRepo } = await makeService();
  const parent = (await runRepo.createIfNoActiveRun({
    task_id: 1,
    workflow_instance_id: 'inst-1',
    status: 'FAILED',
    current_step: null,
    steps: [
      { step_id: 'step1', name: 'S1', status: 'COMPLETED' },
      { step_id: 'step2', name: 'S2', status: 'COMPLETED' },
      { step_id: 'step3', name: 'S3', status: 'COMPLETED' },
    ],
    worktree_path: makeTempWorktree(),
    branch: 'master',
    context: {},
    iteration: 1,
  })).created!;
  await assert.rejects(
    service.createLoopRun(parent.id, 'step2'),
    /no identifiable failed step/,
  );
});

test.test('POST /runs/:runId/loop returns 200 on happy path', async () => {
  const { service, runRepo } = await makeService();
  const parent = (await makeFailedParent(runRepo, {})).created!;
  const app = Fastify();
  await app.register(workflowRoutes, { prefix: '/api/workflows', service });
  try {
    const res = await app.inject({
      method: 'POST',
      url: `/api/workflows/runs/${parent.id}/loop`,
      payload: { fromStepId: 'step2' },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.equal(body.data.iteration, 2);
    assert.ok(typeof body.data.newRunId === 'number' && body.data.newRunId > 0);
  } finally {
    await app.close();
  }
});

test.test('POST /runs/:runId/loop returns 4xx when validation fails', async () => {
  const { service, runRepo } = await makeService();
  const parent = (await makeFailedParent(runRepo, {})).created!;
  const app = Fastify();
  await app.register(workflowRoutes, { prefix: '/api/workflows', service });
  try {
    const res = await app.inject({
      method: 'POST',
      url: `/api/workflows/runs/${parent.id}/loop`,
      payload: { fromStepId: 'step3' }, // not strictly earlier than failed step3
    });
    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.success, false);
    assert.match(body.message, /must be earlier|fromStepId/);
  } finally {
    await app.close();
  }
});

test.test('getAllRunsByTask enriches every run with workflow_template_snapshot.maxLoops from the template', async () => {
  // Regression test for the bug where the multi-run endpoint returned raw
  // runs without the snapshot, leaving the frontend's canLoopAgain /
  // canLoopBack computeds reading from undefined fields.
  const { service, runRepo } = await makeService();
  // Two runs for the same task: the parent failure and an override loop.
  const parent = (await makeFailedParent(runRepo, { taskId: 7, iteration: 1 })).created!;
  const child = await runRepo.createIfNoActiveRun({
    task_id: 7,
    workflow_instance_id: 'inst-1',
    status: 'FAILED',
    current_step: 'step3',
    steps: [
      { step_id: 'step1', name: 'S1', status: 'SKIPPED' },
      { step_id: 'step2', name: 'S2', status: 'COMPLETED' },
      { step_id: 'step3', name: 'S3', status: 'FAILED', error: 'boom2' },
    ],
    worktree_path: parent.worktree_path,
    branch: parent.branch,
    context: {},
    parent_run_id: parent.id,
    iteration: 2,
    looped_from_step_id: 'step2',
  });
  assert.ok(child.created);

  const runs = await service.getAllRunsByTask(7);
  assert.equal(runs.length, 2);
  for (const run of runs) {
    assert.ok(run.workflow_template_snapshot, 'snapshot should be populated');
    // The stub templateService returns maxLoops=2; verify it propagates.
    assert.equal(run.workflow_template_snapshot.maxLoops, 2);
    assert.equal(run.workflow_template_snapshot.steps.length, 3);
    // onFailureLoopTo for step3 must round-trip from the instance steps.
    const step3 = run.workflow_template_snapshot.steps.find(s => s.id === 'step3');
    assert.equal(step3?.onFailureLoopTo, 'step2');
  }
});

test.test('getWorkflowRun snapshot.maxLoops reads from the template, not hardcoded 0', async () => {
  // Regression test for the bug where getWorkflowRun set maxLoops: 0 inline
  // even when the template specified a higher budget.
  const { service, runRepo } = await makeService();
  const parent = (await makeFailedParent(runRepo, {})).created!;
  const enriched = await service.getWorkflowRun(parent.id);
  assert.ok(enriched);
  assert.ok(enriched!.workflow_template_snapshot);
  assert.equal(enriched!.workflow_template_snapshot.maxLoops, 2);
});
