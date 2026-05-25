import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { SchedulerService } from '../src/services/schedulerService.js';
import { closeDbClient } from '../src/db/client.js';
import { initDatabase } from '../src/db/schema.js';

async function withIsolatedStorage(run: (tempRoot: string) => Promise<void>) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'dispatch-concurrency-test-'));
  const originalStoragePath = process.env.STORAGE_PATH;
  process.env.STORAGE_PATH = tempRoot;
  await closeDbClient();
  await initDatabase();

  try {
    await run(tempRoot);
  } finally {
    await closeDbClient();
    if (originalStoragePath === undefined) {
      delete process.env.STORAGE_PATH;
    } else {
      process.env.STORAGE_PATH = originalStoragePath;
    }
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

function createMockDeps(options: {
  maxConcurrent?: number;
  maxTasks?: number;
  todoTasks?: Array<{ id: number; priority: string; auto_execute: number; auto_execute_template_id: string | null; created_at: string }>;
  activeRuns?: Array<{ id: number; task_id: number; status: string }>;
  startTaskDelay?: number;
  startTaskFailIds?: Set<number>;
} = {}) {
  const maxConcurrent = options.maxConcurrent ?? 3;
  const maxTasks = options.maxTasks ?? 10;
  const todoTasks = options.todoTasks ?? [];
  const activeRuns = options.activeRuns ?? [];
  const startTaskDelay = options.startTaskDelay ?? 0;
  const startTaskFailIds = options.startTaskFailIds ?? new Set();

  const startedTasks: number[] = [];

  const settingsService = {
    async getMaxConcurrentWorkflows() { return maxConcurrent; },
    async getMaxTasksPerExecution() { return maxTasks; },
  };

  const taskRepository = {
    async findByStatus(status: string) {
      if (status === 'TODO') {
        return todoTasks.map((t) => ({
          ...t,
          project_id: 1,
          title: `Task ${t.id}`,
          description: '',
          status: 'TODO' as const,
          source: null,
          external_id: null,
          auto_execute_template_id: t.auto_execute_template_id,
          worktree_path: null,
          worktree_branch: `task/${t.id}`,
          target_repo_url: null,
          workflow_run_id: null,
          created_at: t.created_at,
          updated_at: t.created_at,
        }));
      }
      return [];
    },
  };

  const workflowRunRepository = {
    async findAll() {
      return activeRuns.map((r) => ({
        ...r,
        workflow_instance_id: 'inst-1',
        mastra_run_id: null,
        current_step: null,
        steps: [],
        worktree_path: '/tmp/test',
        branch: 'task/1',
        context: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
    },
    async countActive() {
      return activeRuns.filter((r) => r.status === 'RUNNING' || r.status === 'PENDING' || r.status === 'SUSPENDED').length;
    },
  };

  const taskService = {
    async startTask(taskId: number, _options: Record<string, unknown>) {
      if (startTaskFailIds.has(taskId)) {
        throw new Error(`Task ${taskId} start failed`);
      }
      if (startTaskDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, startTaskDelay));
      }
      startedTasks.push(taskId);
    },
    getStartedTasks() {
      return [...startedTasks];
    },
  };

  return {
    settingsService,
    taskRepository,
    workflowRunRepository,
    taskService,
  };
}

// --- Concurrency tests for dispatchWorkflows ---

test.test('dispatchWorkflows dispatch guard prevents concurrent dispatch', async () => {
  await withIsolatedStorage(async () => {
    const mocks = createMockDeps({
      maxConcurrent: 5,
      todoTasks: [
        { id: 1, priority: 'HIGH', auto_execute: 1, auto_execute_template_id: 'tpl-1', created_at: '2026-01-01T00:00:00Z' },
      ],
    });

    const scheduler = new SchedulerService({
      settingsService: mocks.settingsService as any,
      taskRepository: mocks.taskRepository as any,
      workflowRunRepository: mocks.workflowRunRepository as any,
      taskService: mocks.taskService as any,
    });

    // Manually set the dispatching flag to simulate in-progress dispatch
    (scheduler as any).dispatching = true;

    const result = await scheduler.dispatchWorkflows();

    // Should skip immediately
    assert.equal(result.eligibleTasks, 0);
    assert.equal(result.dispatched, 0);
    assert.equal(result.skipped, 0);
    assert.equal(mocks.taskService.getStartedTasks().length, 0);

    scheduler.shutdown();
  });
});

test.test('dispatchWorkflows respects maxConcurrentWorkflows limit', async () => {
  await withIsolatedStorage(async () => {
    const mocks = createMockDeps({
      maxConcurrent: 2,
      maxTasks: 10,
      todoTasks: [
        { id: 1, priority: 'CRITICAL', auto_execute: 1, auto_execute_template_id: 'tpl-1', created_at: '2026-01-01T00:00:00Z' },
        { id: 2, priority: 'HIGH', auto_execute: 1, auto_execute_template_id: 'tpl-1', created_at: '2026-01-01T00:00:01Z' },
        { id: 3, priority: 'MEDIUM', auto_execute: 1, auto_execute_template_id: 'tpl-1', created_at: '2026-01-01T00:00:02Z' },
        { id: 4, priority: 'LOW', auto_execute: 1, auto_execute_template_id: 'tpl-1', created_at: '2026-01-01T00:00:03Z' },
      ],
      activeRuns: [],
    });

    const scheduler = new SchedulerService({
      settingsService: mocks.settingsService as any,
      taskRepository: mocks.taskRepository as any,
      workflowRunRepository: mocks.workflowRunRepository as any,
      taskService: mocks.taskService as any,
    });

    const result = await scheduler.dispatchWorkflows();

    // Should only dispatch 2 (maxConcurrent=2), skip 2
    assert.equal(result.eligibleTasks, 4);
    assert.equal(result.dispatched, 2);
    assert.equal(result.skipped, 2);
    assert.equal(mocks.taskService.getStartedTasks().length, 2);

    scheduler.shutdown();
  });
});

test.test('dispatchWorkflows accounts for existing active runs when enforcing limit', async () => {
  await withIsolatedStorage(async () => {
    const mocks = createMockDeps({
      maxConcurrent: 3,
      maxTasks: 10,
      todoTasks: [
        { id: 1, priority: 'HIGH', auto_execute: 1, auto_execute_template_id: 'tpl-1', created_at: '2026-01-01T00:00:00Z' },
        { id: 2, priority: 'HIGH', auto_execute: 1, auto_execute_template_id: 'tpl-1', created_at: '2026-01-01T00:00:01Z' },
        { id: 3, priority: 'HIGH', auto_execute: 1, auto_execute_template_id: 'tpl-1', created_at: '2026-01-01T00:00:02Z' },
      ],
      activeRuns: [
        { id: 100, task_id: 10, status: 'RUNNING' },
        { id: 101, task_id: 11, status: 'PENDING' },
      ],
    });

    const scheduler = new SchedulerService({
      settingsService: mocks.settingsService as any,
      taskRepository: mocks.taskRepository as any,
      workflowRunRepository: mocks.workflowRunRepository as any,
      taskService: mocks.taskService as any,
    });

    const result = await scheduler.dispatchWorkflows();

    // 2 active runs + maxConcurrent=3, so only 1 more can be dispatched
    assert.equal(result.eligibleTasks, 3);
    assert.equal(result.dispatched, 1);
    assert.equal(result.skipped, 2);

    scheduler.shutdown();
  });
});

test.test('dispatchWorkflows localDispatched counter prevents over-dispatch with async startTask', async () => {
  await withIsolatedStorage(async () => {
    const mocks = createMockDeps({
      maxConcurrent: 3,
      maxTasks: 10,
      todoTasks: [
        { id: 1, priority: 'HIGH', auto_execute: 1, auto_execute_template_id: 'tpl-1', created_at: '2026-01-01T00:00:00Z' },
        { id: 2, priority: 'HIGH', auto_execute: 1, auto_execute_template_id: 'tpl-1', created_at: '2026-01-01T00:00:01Z' },
        { id: 3, priority: 'HIGH', auto_execute: 1, auto_execute_template_id: 'tpl-1', created_at: '2026-01-01T00:00:02Z' },
        { id: 4, priority: 'HIGH', auto_execute: 1, auto_execute_template_id: 'tpl-1', created_at: '2026-01-01T00:00:03Z' },
        { id: 5, priority: 'HIGH', auto_execute: 1, auto_execute_template_id: 'tpl-1', created_at: '2026-01-01T00:00:04Z' },
      ],
      activeRuns: [],
      startTaskDelay: 50,
    });

    const scheduler = new SchedulerService({
      settingsService: mocks.settingsService as any,
      taskRepository: mocks.taskRepository as any,
      workflowRunRepository: mocks.workflowRunRepository as any,
      taskService: mocks.taskService as any,
    });

    const result = await scheduler.dispatchWorkflows();

    // localDispatched counter should prevent over-dispatch even with async startTask
    assert.equal(result.dispatched, 3);
    assert.equal(result.skipped, 2);
    assert.equal(mocks.taskService.getStartedTasks().length, 3);

    scheduler.shutdown();
  });
});

test.test('dispatchWorkflows handles startTask failures without breaking the loop', async () => {
  await withIsolatedStorage(async () => {
    const mocks = createMockDeps({
      maxConcurrent: 5,
      maxTasks: 10,
      todoTasks: [
        { id: 1, priority: 'HIGH', auto_execute: 1, auto_execute_template_id: 'tpl-1', created_at: '2026-01-01T00:00:00Z' },
        { id: 2, priority: 'HIGH', auto_execute: 1, auto_execute_template_id: 'tpl-1', created_at: '2026-01-01T00:00:01Z' },
        { id: 3, priority: 'HIGH', auto_execute: 1, auto_execute_template_id: 'tpl-1', created_at: '2026-01-01T00:00:02Z' },
      ],
      activeRuns: [],
      startTaskFailIds: new Set([2]),
    });

    const scheduler = new SchedulerService({
      settingsService: mocks.settingsService as any,
      taskRepository: mocks.taskRepository as any,
      workflowRunRepository: mocks.workflowRunRepository as any,
      taskService: mocks.taskService as any,
    });

    const result = await scheduler.dispatchWorkflows();

    // Task 2 fails, but tasks 1 and 3 should still be dispatched
    assert.equal(result.dispatched, 2);
    assert.equal(result.skipped, 1);
    assert.equal(result.errors.length, 1);
    assert.ok(result.errors[0]?.includes('Task 2'));

    scheduler.shutdown();
  });
});

test.test('dispatchWorkflows resets dispatching flag after completion', async () => {
  await withIsolatedStorage(async () => {
    const mocks = createMockDeps({
      maxConcurrent: 2,
      todoTasks: [
        { id: 1, priority: 'HIGH', auto_execute: 1, auto_execute_template_id: 'tpl-1', created_at: '2026-01-01T00:00:00Z' },
      ],
    });

    const scheduler = new SchedulerService({
      settingsService: mocks.settingsService as any,
      taskRepository: mocks.taskRepository as any,
      workflowRunRepository: mocks.workflowRunRepository as any,
      taskService: mocks.taskService as any,
    });

    // First dispatch
    await scheduler.dispatchWorkflows();
    assert.equal((scheduler as any).dispatching, false);

    // Second dispatch should work (not blocked by stale flag)
    const result = await scheduler.dispatchWorkflows();
    assert.equal(result.eligibleTasks, 1);

    scheduler.shutdown();
  });
});

test.test('dispatchWorkflows resets dispatching flag on error', async () => {
  await withIsolatedStorage(async () => {
    const errorTaskRepo = {
      async findByStatus() {
        throw new Error('Database connection lost');
      },
    };

    const scheduler = new SchedulerService({
      taskRepository: errorTaskRepo as any,
    });

    await scheduler.dispatchWorkflows();

    // dispatching flag must be reset even on error
    assert.equal((scheduler as any).dispatching, false);

    scheduler.shutdown();
  });
});

test.test('dispatchWorkflows priority ordering: CRITICAL > HIGH > MEDIUM > LOW', async () => {
  await withIsolatedStorage(async () => {
    const startedTasks: number[] = [];

    const mocks = createMockDeps({
      maxConcurrent: 2,
      maxTasks: 10,
      todoTasks: [
        { id: 1, priority: 'LOW', auto_execute: 1, auto_execute_template_id: 'tpl-1', created_at: '2026-01-01T00:00:00Z' },
        { id: 2, priority: 'MEDIUM', auto_execute: 1, auto_execute_template_id: 'tpl-1', created_at: '2026-01-01T00:00:00Z' },
        { id: 3, priority: 'CRITICAL', auto_execute: 1, auto_execute_template_id: 'tpl-1', created_at: '2026-01-01T00:00:00Z' },
        { id: 4, priority: 'HIGH', auto_execute: 1, auto_execute_template_id: 'tpl-1', created_at: '2026-01-01T00:00:00Z' },
      ],
      activeRuns: [],
    });

    const taskServiceWithTracking = {
      async startTask(taskId: number, _options: Record<string, unknown>) {
        startedTasks.push(taskId);
      },
      getStartedTasks() {
        return [...startedTasks];
      },
    };

    const scheduler = new SchedulerService({
      settingsService: mocks.settingsService as any,
      taskRepository: mocks.taskRepository as any,
      workflowRunRepository: mocks.workflowRunRepository as any,
      taskService: taskServiceWithTracking as any,
    });

    await scheduler.dispatchWorkflows();

    // Should dispatch CRITICAL (id=3) and HIGH (id=4) first
    assert.deepEqual(startedTasks, [3, 4]);

    scheduler.shutdown();
  });
});

test.test('dispatchWorkflows skips tasks without template', async () => {
  await withIsolatedStorage(async () => {
    const mocks = createMockDeps({
      maxConcurrent: 5,
      todoTasks: [
        { id: 1, priority: 'HIGH', auto_execute: 1, auto_execute_template_id: 'tpl-1', created_at: '2026-01-01T00:00:00Z' },
        { id: 2, priority: 'HIGH', auto_execute: 1, auto_execute_template_id: null, created_at: '2026-01-01T00:00:01Z' },
        { id: 3, priority: 'HIGH', auto_execute: 0, auto_execute_template_id: 'tpl-1', created_at: '2026-01-01T00:00:02Z' },
      ],
    });

    const scheduler = new SchedulerService({
      settingsService: mocks.settingsService as any,
      taskRepository: mocks.taskRepository as any,
      workflowRunRepository: mocks.workflowRunRepository as any,
      taskService: mocks.taskService as any,
    });

    const result = await scheduler.dispatchWorkflows();

    // Only task 1 is eligible (auto_execute=1 AND has template)
    assert.equal(result.eligibleTasks, 1);
    assert.equal(result.dispatched, 1);

    scheduler.shutdown();
  });
});

test.test('dispatchWorkflows skips tasks already in active workflow runs', async () => {
  await withIsolatedStorage(async () => {
    const mocks = createMockDeps({
      maxConcurrent: 5,
      todoTasks: [
        { id: 1, priority: 'HIGH', auto_execute: 1, auto_execute_template_id: 'tpl-1', created_at: '2026-01-01T00:00:00Z' },
        { id: 2, priority: 'HIGH', auto_execute: 1, auto_execute_template_id: 'tpl-1', created_at: '2026-01-01T00:00:01Z' },
      ],
      activeRuns: [
        { id: 100, task_id: 1, status: 'RUNNING' },
      ],
    });

    const scheduler = new SchedulerService({
      settingsService: mocks.settingsService as any,
      taskRepository: mocks.taskRepository as any,
      workflowRunRepository: mocks.workflowRunRepository as any,
      taskService: mocks.taskService as any,
    });

    const result = await scheduler.dispatchWorkflows();

    // Task 1 is already running, only task 2 is eligible
    assert.equal(result.eligibleTasks, 1);
    assert.equal(result.dispatched, 1);

    scheduler.shutdown();
  });
});
