import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as crypto from 'node:crypto';

import { TaskSourceService } from '../src/services/taskSourceService.js';
import { TaskSourceRepository } from '../src/repositories/taskSourceRepository.js';
import { TaskRepository } from '../src/repositories/taskRepository.js';
import { SessionRepository } from '../src/repositories/sessionRepository.js';
import { SessionSegmentRepository } from '../src/repositories/sessionSegmentRepository.js';
import { registerAdapter } from '../src/sources/index.js';
import { TaskSourceAdapter } from '../src/sources/base.js';
import type { ImportedTask } from '../src/types/sources.ts';
import { ExecutorType } from '../src/types/executors.js';

class TestSyncAdapter extends TaskSourceAdapter {
  static override type = 'TEST_SYNC_HISTORY';

  static override metadata = {
    type: 'TEST_SYNC_HISTORY',
    name: 'Test sync history adapter',
    description: 'Used by sync history tests',
  };

  override async fetch(): Promise<ImportedTask[]> {
    return [];
  }

  override async testConnection(): Promise<boolean> {
    return true;
  }

  override convertToTask(item: unknown): ImportedTask {
    return item as ImportedTask;
  }
}

registerAdapter(TestSyncAdapter);

function uniquePath() {
  return `/tmp/test-dir-${crypto.randomUUID()}`;
}

function uniqueProjectId() {
  return Date.now() + Math.floor(Math.random() * 10000);
}

test.test('getSyncHistory returns empty array when no sessions exist', async () => {
  const sourceRepo = new TaskSourceRepository();
  const service = new TaskSourceService();
  const dir = uniquePath();
  const projectId = uniqueProjectId();

  const source = await sourceRepo.create({
    name: 'TestDir',
    type: 'TEST_SYNC_HISTORY',
    project_id: projectId,
    config: { directoryPath: dir },
    enabled: true,
  });

  const result = await service.getSyncHistory(String(source.id));
  assert.equal(result.history.length, 0);
});

test.test('getSyncHistory returns sessions matching source directoryPath', async () => {
  const sourceRepo = new TaskSourceRepository();
  const sessionRepo = new SessionRepository();
  const service = new TaskSourceService();
  const dir = uniquePath();
  const projectId = uniqueProjectId();

  const source = await sourceRepo.create({
    name: 'TestDir',
    type: 'TEST_SYNC_HISTORY',
    project_id: projectId,
    config: { directoryPath: dir },
    enabled: true,
  });

  // Create sessions matching the source's directoryPath
  await sessionRepo.create({
    task_id: 0,
    executor_type: ExecutorType.CLAUDE_CODE,
    status: 'COMPLETED',
    worktree_path: dir,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });

  // Create session with different path — should NOT appear
  const otherDir = uniquePath();
  await sessionRepo.create({
    task_id: 0,
    executor_type: ExecutorType.CLAUDE_CODE,
    status: 'COMPLETED',
    worktree_path: otherDir,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });

  const result = await service.getSyncHistory(String(source.id));
  assert.equal(result.history.length, 1);
  assert.equal(result.history[0]!.status, 'COMPLETED');
});

test.test('getSyncHistory detects AI mode from session segments', async () => {
  const sourceRepo = new TaskSourceRepository();
  const sessionRepo = new SessionRepository();
  const segmentRepo = new SessionSegmentRepository();
  const service = new TaskSourceService();
  const dir = uniquePath();
  const projectId = uniqueProjectId();

  const source = await sourceRepo.create({
    name: 'TestDir',
    type: 'TEST_SYNC_HISTORY',
    project_id: projectId,
    config: { directoryPath: dir },
    enabled: true,
  });

  // Create AI session (has segment with agent)
  const aiSession = await sessionRepo.create({
    task_id: 0,
    executor_type: ExecutorType.CLAUDE_CODE,
    status: 'COMPLETED',
    worktree_path: dir,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });

  await segmentRepo.create({
    session_id: aiSession.id,
    status: 'COMPLETED',
    executor_type: ExecutorType.CLAUDE_CODE,
    agent_id: 1,
    trigger_type: 'START',
  });

  // Create fixed session (no segments) — slightly earlier to ensure ordering
  const earlier = new Date(Date.now() - 1000);
  await sessionRepo.create({
    task_id: 0,
    executor_type: ExecutorType.CLAUDE_CODE,
    status: 'COMPLETED',
    worktree_path: dir,
    started_at: earlier.toISOString(),
    completed_at: earlier.toISOString(),
  });

  const result = await service.getSyncHistory(String(source.id));
  assert.equal(result.history.length, 2);
  const aiEntry = result.history.find((h) => h.mode === 'ai');
  const fixedEntry = result.history.find((h) => h.mode === 'fixed');
  assert.ok(aiEntry, 'Should have an AI mode entry');
  assert.ok(fixedEntry, 'Should have a fixed mode entry');
});

test.test('getSyncHistory counts tasks for each session', async () => {
  const sourceRepo = new TaskSourceRepository();
  const sessionRepo = new SessionRepository();
  const taskRepo = new TaskRepository();
  const service = new TaskSourceService();
  const dir = uniquePath();
  const projectId = uniqueProjectId();

  const source = await sourceRepo.create({
    name: 'TestDir',
    type: 'TEST_SYNC_HISTORY',
    project_id: projectId,
    config: { directoryPath: dir },
    enabled: true,
  });

  const now = new Date();
  const session = await sessionRepo.create({
    task_id: 0,
    executor_type: ExecutorType.CLAUDE_CODE,
    status: 'COMPLETED',
    worktree_path: dir,
    started_at: now.toISOString(),
    completed_at: now.toISOString(),
  });

  // Create tasks linked to this source
  await taskRepo.create({
    project_id: projectId,
    title: 'Task 1',
    description: 'desc 1',
    status: 'TODO',
    priority: 'MEDIUM',
    external_id: `file1-${crypto.randomUUID()}.txt`,
    source: 'TEST_SYNC_HISTORY',
  });

  await taskRepo.create({
    project_id: projectId,
    title: 'Task 2',
    description: 'desc 2',
    status: 'TODO',
    priority: 'MEDIUM',
    external_id: `file2-${crypto.randomUUID()}.txt`,
    source: 'TEST_SYNC_HISTORY',
  });

  const result = await service.getSyncHistory(String(source.id));
  assert.equal(result.history.length, 1);
  assert.equal(result.history[0]!.fileCount, 2);
  assert.equal(result.history[0]!.sessionId, session.id);
});
