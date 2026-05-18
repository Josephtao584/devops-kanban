import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fsPromises from 'node:fs/promises';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as path from 'node:path';

import { createClient } from '@libsql/client';
import { migrateSchema } from '../../src/db/migrate.js';
import { WorkflowRunRepository } from '../../src/repositories/workflowRunRepository.js';
import { WorkflowService } from '../../src/services/workflow/workflowService.js';
import { WorkflowLifecycle } from '../../src/services/workflow/workflowLifecycle.js';

function extractCreateTableSql(sql: string): string {
  const matches = sql.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+[\s\S]*?\);/gi);
  return matches ? matches.join('\n\n') : '';
}

// Track every temp dir we create so we can scrub /tmp at the end of the file.
const tempDirs: string[] = [];

function makeTempWorktree(): string {
  const dir = mkdtempSync(join(tmpdir(), 'wf-loop-int-'));
  tempDirs.push(dir);
  return dir;
}

test.after(() => {
  for (const dir of tempDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
});

async function makeRepo(): Promise<WorkflowRunRepository> {
  // Use a file-based libsql client (under tmpdir) instead of :memory: because
  // libsql's :memory: opens a fresh database per connection, which means the
  // implicit second connection used by client.transaction('write') sees an
  // empty schema. Transactions break with errors like "no such table:
  // workflow_runs". A file-backed DB avoids that issue.
  const dir = mkdtempSync(join(tmpdir(), 'wf-loop-int-db-'));
  tempDirs.push(dir);
  const client = createClient({ url: `file:${join(dir, 'test.db')}` });
  const schemaPath = path.join(import.meta.dirname, '../../src/db/schema.sql');
  const schemaSql = await fsPromises.readFile(schemaPath, 'utf-8');
  const tableSql = extractCreateTableSql(schemaSql);
  if (tableSql) {
    await client.executeMultiple(tableSql);
  }
  await migrateSchema(client, schemaSql);
  return new WorkflowRunRepository(client);
}

interface PollOpts {
  timeoutMs?: number;
  intervalMs?: number;
}

async function waitForRunStatus(
  runRepo: WorkflowRunRepository,
  runId: number,
  status: string,
  opts: PollOpts = {},
): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? 2000;
  const intervalMs = opts.intervalMs ?? 10;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const run = await runRepo.findById(runId);
    if (run?.status === status) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  const run = await runRepo.findById(runId);
  throw new Error(
    `Timeout waiting for run ${runId} to reach ${status}; current status=${run?.status}`,
  );
}

test.test('end-to-end: auto-loops up to DEFAULT_MAX_LOOPS then stops; override allowed', async () => {
  const runRepo = await makeRepo();
  const taskId = 1;
  const worktree = makeTempWorktree();

  // Stubs shared between WorkflowService and WorkflowLifecycle.
  const instance = {
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
  const template = {
    id: 1,
    template_id: 't1',
    name: 'T1',
    steps: [],
    created_at: '',
    updated_at: '',
  };

  const instanceService = {
    async getByInstanceId() {
      return instance;
    },
  };
  const templateService = {
    async getTemplateById() {
      return template;
    },
  };
  const taskRepo = {
    async findById() {
      return { id: taskId, project_id: 1, title: 'T', description: 'D' };
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

  // Lifecycle's instance lookup uses its own instanceRepo, separate from
  // WorkflowService's instanceService.
  const instanceRepo = {
    async findByInstanceId() {
      return instance;
    },
  };

  const lifecycle = new WorkflowLifecycle({
    workflowRunRepo: runRepo,
    taskRepo: taskRepo as any,
    instanceRepo: instanceRepo as any,
    sessionRepo: { async findById() { return null; }, async update() { return null; } } as any,
    sessionSegmentRepo: { async findLatestBySessionId() { return null; }, async update() { return null; } } as any,
    sessionEventRepo: { async listBySessionId() { return []; }, async append() { return null; } } as any,
    agentRepo: {} as any,
  });

  const service = new WorkflowService({
    workflowRunRepo: runRepo,
    instanceService: instanceService as any,
    templateService: templateService as any,
    taskRepo: taskRepo as any,
    projectRepo: projectRepo as any,
    agentRepo: {} as any,
    lifecycle,
  });

  // Override executeWorkflow to simulate a step3-always-fails workflow.
  // Each run that gets executed: marks step3 FAILED, marks the run FAILED,
  // then calls onStepError. The run's status must be FAILED *before*
  // onStepError so that createLoopRun's parent.status check is satisfied
  // when the auto-loop trigger evaluates inside the lifecycle hook.
  // Track in-flight executions so we can drain them at the end.
  const pendingExecutions = new Set<Promise<void>>();
  (service as any).executeWorkflow = (runId: number) => {
    const promise = (async () => {
      // small delay so the awaiter (createLoopRun) returns first
      await new Promise((r) => setTimeout(r, 5));
      await runRepo.updateStep(runId, 'step3', {
        status: 'FAILED',
        error: 'simulated step3 failure',
      });
      await runRepo.update(runId, { status: 'FAILED', current_step: 'step3' });
      await lifecycle.onStepError(runId, 'step3', 'simulated step3 failure');
    })();
    pendingExecutions.add(promise);
    promise.finally(() => pendingExecutions.delete(promise));
    return promise;
  };

  // Seed iteration=1 directly in FAILED state with step3 already FAILED so
  // that onStepError's loop-trigger pass evaluates against parent.status===
  // 'FAILED' (createLoopRun rejects otherwise).
  const parent = (await runRepo.createIfNoActiveRun({
    task_id: taskId,
    workflow_instance_id: 'inst-1',
    status: 'FAILED',
    current_step: 'step3',
    steps: [
      { step_id: 'step1', name: 'S1', status: 'COMPLETED' },
      { step_id: 'step2', name: 'S2', status: 'COMPLETED' },
      { step_id: 'step3', name: 'S3', status: 'FAILED', error: 'simulated step3 failure' },
    ],
    worktree_path: worktree,
    branch: 'master',
    context: {},
    iteration: 1,
  })).created!;

  // Trigger the auto-loop: this synchronously calls createLoopRun(parent,'step2')
  // which creates run2 in PENDING, then fire-and-forget calls executeWorkflow
  // (our override) on run2.
  await lifecycle.onStepError(parent.id, 'step3', 'simulated step3 failure');

  // After onStepError resolves, run2 exists in the DB (created by createLoopRun
  // before executeWorkflow was fired off). Find it.
  const runsAfterTrigger = await runRepo.findAllByTaskIdOrdered(taskId);
  assert.equal(runsAfterTrigger.length, 2, 'auto-loop should have created iteration=2');
  const run2 = runsAfterTrigger[1]!;
  assert.equal(run2.iteration, 2);
  assert.equal(run2.parent_run_id, parent.id);
  assert.equal(run2.worktree_path, worktree);
  assert.equal(run2.branch, parent.branch);
  assert.equal(run2.looped_from_step_id, 'step2');
  assert.deepEqual(run2.loop_failure_context, {
    failed_step_id: 'step3',
    error: 'simulated step3 failure',
    summary: null,
  });

  // SKIPPED step inheritance for the prefix (step1 is before step2).
  const run2Step1 = run2.steps.find((s) => s.step_id === 'step1');
  assert.equal(run2Step1?.status, 'SKIPPED');
  assert.equal(run2Step1?.inherited_from_run_id, parent.id);

  // Wait for run2's simulated execution to complete (mark FAILED + onStepError).
  // The second onStepError SHOULD trigger a third loop since iteration+1=3 is
  // not > DEFAULT_MAX_LOOPS=3.
  await waitForRunStatus(runRepo, run2.id, 'FAILED');
  while (pendingExecutions.size > 0) {
    await Promise.all([...pendingExecutions]);
  }

  const runsAfterRun2 = await runRepo.findAllByTaskIdOrdered(taskId);
  assert.equal(
    runsAfterRun2.length,
    3,
    `iteration=2's failure should auto-create iteration=3 (DEFAULT_MAX_LOOPS=3); got ${runsAfterRun2.length} runs`,
  );
  const run3 = runsAfterRun2[2]!;
  assert.equal(run3.iteration, 3);

  // Wait for run3's simulated execution. iteration=3, 3+1>DEFAULT_MAX_LOOPS=3,
  // so auto-loop should NOT trigger a fourth iteration.
  await waitForRunStatus(runRepo, run3.id, 'FAILED');
  while (pendingExecutions.size > 0) {
    await Promise.all([...pendingExecutions]);
  }

  const runsAfterRun3 = await runRepo.findAllByTaskIdOrdered(taskId);
  assert.equal(
    runsAfterRun3.length,
    3,
    `iteration=3's failure must not auto-create iteration=4 (DEFAULT_MAX_LOOPS=3); got ${runsAfterRun3.length} runs`,
  );

  // Override path: explicitly create iteration=4 past DEFAULT_MAX_LOOPS.
  const run4 = await service.createLoopRun(run3.id, 'step2', undefined, true);
  assert.equal(run4.iteration, 4);
  assert.equal(run4.parent_run_id, run3.id);
  assert.equal(run4.worktree_path, worktree);

  // Wait for run4's simulated execution to settle. iteration=4, 4+1>DEFAULT_MAX_LOOPS=3,
  // so it should also stop.
  await waitForRunStatus(runRepo, run4.id, 'FAILED');
  while (pendingExecutions.size > 0) {
    await Promise.all([...pendingExecutions]);
  }

  const finalRuns = await runRepo.findAllByTaskIdOrdered(taskId);
  assert.equal(finalRuns.length, 4, `expected 4 runs total after override, got ${finalRuns.length}`);
  assert.equal(finalRuns[0]!.iteration, 1);
  assert.equal(finalRuns[1]!.iteration, 2);
  assert.equal(finalRuns[2]!.iteration, 3);
  assert.equal(finalRuns[3]!.iteration, 4);
});
