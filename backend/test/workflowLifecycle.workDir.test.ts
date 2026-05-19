import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { WorkflowLifecycle } from '../src/services/workflow/workflowLifecycle.js';

function makeRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    task_id: 7,
    worktree_path: '/will/be/overridden',
    status: 'RUNNING',
    current_step: 'step-1',
    steps: [
      {
        step_id: 'step-1',
        name: 'Step 1',
        status: 'PENDING',
        started_at: null,
        completed_at: null,
        retry_count: 0,
        session_id: null,
        summary: null,
        error: null,
      },
    ],
    context: {},
    ...overrides,
  };
}

function makeHarness(opts: {
  workDir?: string | null;
  worktreePath: string;
  initialContext?: Record<string, unknown>;
}) {
  const run = makeRun({ worktree_path: opts.worktreePath, context: opts.initialContext ?? {} });
  let taskRow: Record<string, unknown> = {
    id: 7,
    work_dir: opts.workDir ?? null,
  };
  const stepUpdates: Array<{ stepId: string; updateData: Record<string, unknown> }> = [];
  const runUpdates: Array<Record<string, unknown>> = [];

  const workflowRunRepo = {
    async findById() { return run; },
    async updateStep(_runId: number, stepId: string, updateData: Record<string, unknown>) {
      stepUpdates.push({ stepId, updateData });
      const step = run.steps.find((s) => s.step_id === stepId);
      if (step) Object.assign(step, updateData);
      return run;
    },
    async update(_runId: number, updateData: Record<string, unknown>) {
      runUpdates.push(updateData);
      Object.assign(run, updateData);
      return run;
    },
  };

  const sessionRepo = {
    async create(payload: Record<string, unknown>) { return { id: 1001, ...payload }; },
    async findById() { return null; },
    async update() { /* no-op */ },
  };

  const sessionSegmentRepo = {
    async create(payload: Record<string, unknown>) { return { id: 2001, ...payload }; },
    async findLatestBySessionId() { return null; },
    async update() { /* no-op */ },
  };

  const lifecycle = new WorkflowLifecycle({
    workflowRunRepo: workflowRunRepo as never,
    taskRepo: {
      async findById() { return taskRow; },
      async update() { /* no-op */ },
    } as never,
    agentRepo: { async findById() { return { id: 99, executorType: 'CLAUDE_CODE', skills: [], mcpServers: [] }; } } as never,
    instanceRepo: {
      async findByInstanceId() {
        return { instance_id: 'inst', steps: [{ id: 'step-1', name: 'Step 1', agentId: 99 }] };
      },
    } as never,
    sessionRepo: sessionRepo as never,
    sessionSegmentRepo: sessionSegmentRepo as never,
    sessionEventRepo: { async append() { /* no-op */ } } as never,
  });

  return {
    lifecycle,
    run,
    runUpdates,
    stepUpdates,
    setWorkDir(value: string | null) { taskRow = { ...taskRow, work_dir: value }; },
  };
}

test.test('onStepStart throws when work_dir points to a missing directory', async () => {
  const root = mkdtempSync(join(tmpdir(), 'lifecycle-workdir-'));
  try {
    const h = makeHarness({ workDir: 'missing-sub', worktreePath: root });
    await assert.rejects(
      h.lifecycle.onStepStart(42, 'step-1', {
        id: 7,
        project_id: 1,
        execution_path: root,
        work_dir: 'missing-sub',
      } as never),
      (err: any) => /工作路径不存在/.test(err.message) && /missing-sub/.test(err.message),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test.test('onStepStart skips work_dir existsSync when work_dir is empty', async () => {
  const root = mkdtempSync(join(tmpdir(), 'lifecycle-workdir-'));
  try {
    const h = makeHarness({ workDir: null, worktreePath: root });
    // Should not throw; resolveExecutorBasePath returns the worktree root which exists.
    await h.lifecycle.onStepStart(42, 'step-1', {
      id: 7,
      project_id: 1,
      execution_path: root,
      work_dir: null,
    } as never);
    // basePath persisted on run.context should equal the worktree root.
    assert.equal(h.run.context['install_base_path'], root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test.test('onStepStart persists install_base_path = <worktree>/<work_dir>', async () => {
  const root = mkdtempSync(join(tmpdir(), 'lifecycle-workdir-'));
  const sub = join(root, 'service-a');
  mkdirSync(sub, { recursive: true });
  try {
    const h = makeHarness({ workDir: 'service-a', worktreePath: root });
    await h.lifecycle.onStepStart(42, 'step-1', {
      id: 7,
      project_id: 1,
      execution_path: root,
      work_dir: 'service-a',
    } as never);
    assert.equal(h.run.context['install_base_path'], sub);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test.test('onStepStart rejects work_dir that escapes the worktree', async () => {
  const root = mkdtempSync(join(tmpdir(), 'lifecycle-workdir-'));
  try {
    const h = makeHarness({ workDir: '../etc', worktreePath: root });
    await assert.rejects(
      h.lifecycle.onStepStart(42, 'step-1', {
        id: 7,
        project_id: 1,
        execution_path: root,
        work_dir: '../etc',
      } as never),
      (err: any) => err?.code === 'VALIDATION_ERROR' || /\.\./.test(err.message),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
