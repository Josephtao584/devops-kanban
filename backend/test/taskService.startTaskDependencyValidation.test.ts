import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taskService } from '../src/services/taskService.js';
import { taskRepository } from '../src/repositories/taskRepository.js';
import { projectRepository } from '../src/repositories/projectRepository.js';

// 拦截 workflowService.startWorkflow，避免触发真实 worktree / Mastra 流程；
// 我们只关心 startTask 内部的依赖校验门是否正确放行 / 拦截。
function stubStartWorkflow(): () => void {
  const original = (taskService as any).workflowService.startWorkflow;
  (taskService as any).workflowService.startWorkflow = async () => undefined;
  return () => {
    (taskService as any).workflowService.startWorkflow = original;
  };
}

test.test('startTask passes when all upstream tasks are DONE', async () => {
  const restore = stubStartWorkflow();
  const project = await projectRepository.create({ name: 'dep-val-allDone', env: {} } as any);
  const a = await taskRepository.create({ title: 'A', project_id: project.id, status: 'DONE', priority: 'MEDIUM', source: 'internal', depends_on: [] } as any);
  const b = await taskRepository.create({ title: 'B', project_id: project.id, status: 'TODO', priority: 'MEDIUM', source: 'internal', depends_on: [a.id] } as any);

  try {
    await taskService.startTask(b.id, {} as any);
    const bAfter = await taskRepository.findById(b.id);
    assert.equal(bAfter!.status, 'IN_PROGRESS');
  } finally {
    restore();
    await taskRepository.delete(b.id);
    await taskRepository.delete(a.id);
    await projectRepository.delete(project.id);
  }
});

test.test('startTask throws BusinessError when an upstream task is TODO', async () => {
  const restore = stubStartWorkflow();
  const project = await projectRepository.create({ name: 'dep-val-upstreamTodo', env: {} } as any);
  const a = await taskRepository.create({ title: 'A', project_id: project.id, status: 'TODO', priority: 'MEDIUM', source: 'internal', depends_on: [] } as any);
  const b = await taskRepository.create({ title: 'B', project_id: project.id, status: 'TODO', priority: 'MEDIUM', source: 'internal', depends_on: [a.id] } as any);

  try {
    await assert.rejects(
      () => taskService.startTask(b.id, {} as any),
      (err: any) => {
        assert.equal(err.name, 'BusinessError');
        assert.match(err.message, /上游任务未全部完成|Upstream tasks not all DONE/);
        assert.deepEqual(err.context?.blockerIds, [a.id]);
        return true;
      }
    );
    const bAfter = await taskRepository.findById(b.id);
    assert.equal(bAfter!.status, 'TODO', '失败时不应将任务置为 IN_PROGRESS');
  } finally {
    restore();
    await taskRepository.delete(b.id);
    await taskRepository.delete(a.id);
    await projectRepository.delete(project.id);
  }
});

test.test('startTask throws BusinessError when an upstream task is IN_PROGRESS', async () => {
  const restore = stubStartWorkflow();
  const project = await projectRepository.create({ name: 'dep-val-inprogress', env: {} } as any);
  const a = await taskRepository.create({ title: 'A', project_id: project.id, status: 'IN_PROGRESS', priority: 'MEDIUM', source: 'internal', depends_on: [] } as any);
  const b = await taskRepository.create({ title: 'B', project_id: project.id, status: 'TODO', priority: 'MEDIUM', source: 'internal', depends_on: [a.id] } as any);

  try {
    await assert.rejects(
      () => taskService.startTask(b.id, {} as any),
      (err: any) => err.name === 'BusinessError'
    );
  } finally {
    restore();
    await taskRepository.delete(b.id);
    await taskRepository.delete(a.id);
    await projectRepository.delete(project.id);
  }
});

test.test('startTask throws BusinessError when an upstream task is BLOCKED', async () => {
  const restore = stubStartWorkflow();
  const project = await projectRepository.create({ name: 'dep-val-blocked', env: {} } as any);
  const a = await taskRepository.create({ title: 'A', project_id: project.id, status: 'BLOCKED', priority: 'MEDIUM', source: 'internal', depends_on: [] } as any);
  const b = await taskRepository.create({ title: 'B', project_id: project.id, status: 'TODO', priority: 'MEDIUM', source: 'internal', depends_on: [a.id] } as any);

  try {
    await assert.rejects(
      () => taskService.startTask(b.id, {} as any),
      (err: any) => err.name === 'BusinessError'
    );
  } finally {
    restore();
    await taskRepository.delete(b.id);
    await taskRepository.delete(a.id);
    await projectRepository.delete(project.id);
  }
});

test.test('startTask throws BusinessError when a depends_on points to a non-existent task', async () => {
  const restore = stubStartWorkflow();
  const project = await projectRepository.create({ name: 'dep-val-missing', env: {} } as any);
  const b = await taskRepository.create({ title: 'B', project_id: project.id, status: 'TODO', priority: 'MEDIUM', source: 'internal', depends_on: [999999] } as any);

  try {
    await assert.rejects(
      () => taskService.startTask(b.id, {} as any),
      (err: any) => {
        assert.equal(err.name, 'BusinessError');
        assert.deepEqual(err.context?.blockerIds, [999999]);
        return true;
      }
    );
  } finally {
    restore();
    await taskRepository.delete(b.id);
    await projectRepository.delete(project.id);
  }
});

test.test('startTask passes when depends_on is empty (regression)', async () => {
  const restore = stubStartWorkflow();
  const project = await projectRepository.create({ name: 'dep-val-empty', env: {} } as any);
  const b = await taskRepository.create({ title: 'B', project_id: project.id, status: 'TODO', priority: 'MEDIUM', source: 'internal', depends_on: [] } as any);

  try {
    await taskService.startTask(b.id, {} as any);
    const bAfter = await taskRepository.findById(b.id);
    assert.equal(bAfter!.status, 'IN_PROGRESS');
  } finally {
    restore();
    await taskRepository.delete(b.id);
    await projectRepository.delete(project.id);
  }
});
