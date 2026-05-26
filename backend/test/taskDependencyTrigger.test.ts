import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taskService } from '../src/services/taskService.js';
import { taskRepository } from '../src/repositories/taskRepository.js';
import { projectRepository } from '../src/repositories/projectRepository.js';

// 拆分子任务现在直接建为 TODO（不再使用 WAITING）。onTaskStatusChange
// 在 upstream DONE 时只对仍是 TODO 的依赖做自动启动尝试，IN_PROGRESS/DONE
// 等状态跳过。
test('onTaskStatusChange leaves TODO dependent unchanged when all deps DONE (auto-start gating)', async () => {
  const project = await projectRepository.create({ name: 'test-deps-promote', env: {} } as any);
  const a = await taskRepository.create({ title: 'A', project_id: project.id, status: 'DONE', priority: 'MEDIUM', source: 'internal', depends_on: [] } as any);
  const b = await taskRepository.create({ title: 'B', project_id: project.id, status: 'TODO', priority: 'MEDIUM', source: 'internal', depends_on: [a.id] } as any);

  await taskService.onTaskStatusChange(a.id, 'DONE');

  const bAfter = await taskRepository.findById(b.id);
  // 没有 auto_execute_template_id，自动启动这一支不会触发；状态仍是 TODO（用户手动启动）
  assert.equal(bAfter!.status, 'TODO');

  await taskRepository.delete(b.id);
  await taskRepository.delete(a.id);
  await projectRepository.delete(project.id);
});

test('onTaskStatusChange leaves TODO dependent as TODO when other deps still pending', async () => {
  const project = await projectRepository.create({ name: 'test-deps-partial', env: {} } as any);
  const a = await taskRepository.create({ title: 'A', project_id: project.id, status: 'DONE', priority: 'MEDIUM', source: 'internal', depends_on: [] } as any);
  const b = await taskRepository.create({ title: 'B', project_id: project.id, status: 'IN_PROGRESS', priority: 'MEDIUM', source: 'internal', depends_on: [] } as any);
  const c = await taskRepository.create({ title: 'C', project_id: project.id, status: 'TODO', priority: 'MEDIUM', source: 'internal', depends_on: [a.id, b.id] } as any);

  await taskService.onTaskStatusChange(a.id, 'DONE');

  const cAfter = await taskRepository.findById(c.id);
  // b 仍 IN_PROGRESS，allDone=false，不会触发自动启动；c 状态保持 TODO
  assert.equal(cAfter!.status, 'TODO');

  await taskRepository.delete(c.id);
  await taskRepository.delete(b.id);
  await taskRepository.delete(a.id);
  await projectRepository.delete(project.id);
});

// Cascade test — uses unique project name to avoid SQLite isolation issues
test('onTaskStatusChange cascade-fails dependents when upstream BLOCKED', async () => {
  const project = await projectRepository.create({ name: 'test-cascade-fail', env: {} } as any);
  const a = await taskRepository.create({ title: 'A', project_id: project.id, status: 'BLOCKED', priority: 'MEDIUM', source: 'internal', depends_on: [] } as any);
  const b = await taskRepository.create({ title: 'B', project_id: project.id, status: 'TODO', priority: 'MEDIUM', source: 'internal', depends_on: [a.id] } as any);
  const c = await taskRepository.create({ title: 'C', project_id: project.id, status: 'TODO', priority: 'MEDIUM', source: 'internal', depends_on: [b.id] } as any);

  await taskService.onTaskStatusChange(a.id, 'BLOCKED');

  const bAfter = await taskRepository.findById(b.id);
  const cAfter = await taskRepository.findById(c.id);
  assert.equal(bAfter!.status, 'BLOCKED');
  assert.equal(cAfter!.status, 'BLOCKED');

  await taskRepository.delete(c.id);
  await taskRepository.delete(b.id);
  await taskRepository.delete(a.id);
  await projectRepository.delete(project.id);
});
