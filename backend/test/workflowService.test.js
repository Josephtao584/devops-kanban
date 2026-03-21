import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkflowService } from '../src/services/workflow/workflowService.js';

test('cancelWorkflow 会终止当前运行中的 claude 进程', async () => {
  const kills = [];
  let cancelled = false;

  const workflowRunRepo = {
    async findById(runId) {
      return { id: runId, status: 'RUNNING' };
    },
    async update(runId, updateData) {
      return { id: runId, ...updateData };
    },
  };

  const service = new WorkflowService({
    workflowRunRepo,
    taskRepo: {},
  });

  service._activeRuns.set(1, {
    cancel: () => {
      cancelled = true;
    },
    proc: null,
    context: {
      proc: {
        kill(signal) {
          kills.push(signal);
        },
      },
    },
  });

  const result = await service.cancelWorkflow(1);

  assert.equal(cancelled, true);
  assert.deepEqual(kills, ['SIGTERM']);
  assert.equal(result.status, 'CANCELLED');
});

test('_resolveExecutionPath 优先使用 task.worktree_path', async () => {
  const service = new WorkflowService({
    workflowRunRepo: {},
    taskRepo: {},
    projectRepo: {
      async findById() {
        return { id: 1, local_path: '/repo/project' };
      },
    },
  });

  const resolvedPath = await service._resolveExecutionPath({
    project_id: 1,
    worktree_path: '/repo/worktree/task-1',
  });

  assert.equal(resolvedPath, '/repo/worktree/task-1');
});

test('_resolveExecutionPath 在没有 worktree 时回退到 project.local_path', async () => {
  const service = new WorkflowService({
    workflowRunRepo: {},
    taskRepo: {},
    projectRepo: {
      async findById() {
        return { id: 1, local_path: '/repo/project' };
      },
    },
  });

  const resolvedPath = await service._resolveExecutionPath({
    project_id: 1,
    worktree_path: null,
  });

  assert.equal(resolvedPath, '/repo/project');
});

test('startWorkflow 使用解析后的执行路径写入 workflow run', async () => {
  const createdRuns = [];
  const updatedTasks = [];

  const workflowRunRepo = {
    async findByTaskId() {
      return null;
    },
    async create(data) {
      createdRuns.push(data);
      return { id: 7, ...data };
    },
  };

  const taskRepo = {
    async findById(taskId) {
      return {
        id: taskId,
        project_id: 1,
        title: '测试任务',
        description: '测试描述',
        worktree_path: null,
        worktree_branch: null,
      };
    },
    async update(taskId, data) {
      updatedTasks.push({ taskId, data });
      return { id: taskId, ...data };
    },
  };

  const service = new WorkflowService({
    workflowRunRepo,
    taskRepo,
    projectRepo: {
      async findById() {
        return { id: 1, local_path: '/repo/project' };
      },
    },
  });

  service._executeWorkflow = async () => {};

  const run = await service.startWorkflow(123);

  assert.equal(run.id, 7);
  assert.equal(createdRuns[0].worktree_path, '/repo/project');
  assert.deepEqual(createdRuns[0].steps.map((step) => step.step_id), [
    'requirement-design',
    'code-development',
    'testing',
    'code-review',
  ]);
  assert.deepEqual(updatedTasks, [{ taskId: 123, data: { workflow_run_id: 7 } }]);
});

test('_buildInitialWorkflowState returns shared task context for Mastra state', () => {
  const service = new WorkflowService({ workflowRunRepo: {}, taskRepo: {}, projectRepo: {} });

  const initialState = service._buildInitialWorkflowState({
    title: '测试任务',
    description: '测试描述',
    execution_path: '/repo/project',
  });

  assert.deepEqual(initialState, {
    taskTitle: '测试任务',
    taskDescription: '测试描述',
    worktreePath: '/repo/project',
  });
});

