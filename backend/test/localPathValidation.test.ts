import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { WorkflowService } from '../src/services/workflow/workflowService.js';
import { TaskService } from '../src/services/taskService.js';

// ---------------------------------------------------------------------------
// _resolveExecutionPath tests (WorkflowService)
// ---------------------------------------------------------------------------

test.describe('_resolveExecutionPath', () => {
  test.test('returns task worktree_path when path exists on disk', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wfe-test-'));
    try {
      const service = new WorkflowService({
        projectRepo: {
          async findById() { return null; },
        } as never,
      });

      const result = await service._resolveExecutionPath({
        id: 1,
        project_id: 10,
        worktree_path: tmpDir,
      });

      assert.equal(result, tmpDir);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test.test('falls back to project local_path when worktree_path is missing', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wfe-test-'));
    try {
      const service = new WorkflowService({
        projectRepo: {
          async findById() {
            return { id: 10, local_path: tmpDir };
          },
        } as never,
      });

      const result = await service._resolveExecutionPath({
        id: 1,
        project_id: 10,
        worktree_path: null,
      });

      assert.equal(result, tmpDir);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test.test('throws when worktree_path does not exist and project has no local_path', async () => {
    const service = new WorkflowService({
      projectRepo: {
        async findById() { return { id: 10, local_path: null, git_url: 'https://github.com/example/repo.git' }; },
      } as never,
    });

    await assert.rejects(
      () => service._resolveExecutionPath({
        id: 1,
        project_id: 10,
        worktree_path: '/nonexistent/path/that/does/not/exist',
      }),
      (error: Error & { statusCode?: number }) => {
        assert.equal(error.statusCode, 400);
        assert.match(error.message, /local_path/);
        return true;
      },
    );
  });

  test.test('throws when worktree_path is null and project local_path does not exist on disk', async () => {
    const service = new WorkflowService({
      projectRepo: {
        async findById() { return { id: 10, local_path: '/nonexistent/dir' }; },
      } as never,
    });

    await assert.rejects(
      () => service._resolveExecutionPath({
        id: 1,
        project_id: 10,
        worktree_path: null,
      }),
      (error: Error & { statusCode?: number }) => {
        assert.equal(error.statusCode, 400);
        assert.match(error.message, /local_path/);
        return true;
      },
    );
  });

  test.test('throws when project has no local_path and no git_url', async () => {
    const service = new WorkflowService({
      projectRepo: {
        async findById() { return { id: 10, local_path: null, git_url: null }; },
      } as never,
    });

    await assert.rejects(
      () => service._resolveExecutionPath({
        id: 1,
        project_id: 10,
        worktree_path: null,
      }),
      (error: Error & { statusCode?: number }) => {
        assert.equal(error.statusCode, 400);
        assert.match(error.message, /local_path/);
        return true;
      },
    );
  });
});

// ---------------------------------------------------------------------------
// createWorktree tests (TaskService)
// ---------------------------------------------------------------------------

test.describe('createWorktree local_path validation', () => {
  test.test('throws when project has no local_path', async () => {
    const service = new TaskService({
      taskRepo: {
        async findById() { return { id: 1, project_id: 10, title: 'Test task' }; },
      } as never,
      projectRepo: {
        async findById() { return { id: 10, name: 'Test', local_path: null, git_url: 'https://github.com/example/repo.git' }; },
      } as never,
    });

    await assert.rejects(
      () => service.createWorktree(1),
      (error: Error & { statusCode?: number }) => {
        assert.equal(error.statusCode, 400);
        assert.match(error.message, /local_path/);
        return true;
      },
    );
  });

  test.test('throws when project local_path does not exist on disk', async () => {
    const service = new TaskService({
      taskRepo: {
        async findById() { return { id: 1, project_id: 10, title: 'Test task' }; },
      } as never,
      projectRepo: {
        async findById() { return { id: 10, name: 'Test', local_path: '/nonexistent/path/xyz', git_url: 'https://github.com/example/repo.git' }; },
      } as never,
    });

    await assert.rejects(
      () => service.createWorktree(1),
      (error: Error & { statusCode?: number }) => {
        assert.equal(error.statusCode, 400);
        assert.match(error.message, /local_path/);
        return true;
      },
    );
  });

  test.test('does not attempt git clone when local_path is missing', async () => {
    let cloneAttempted = false;
    const service = new TaskService({
      taskRepo: {
        async findById() { return { id: 1, project_id: 10, title: 'Test task' }; },
      } as never,
      projectRepo: {
        async findById() { return { id: 10, name: 'Test', local_path: null, git_url: 'https://github.com/example/repo.git' }; },
      } as never,
    });

    // Override getOrCloneRepo to detect if clone is attempted
    service.getOrCloneRepo = async () => {
      cloneAttempted = true;
      throw new Error('Should not be called');
    };

    await assert.rejects(
      () => service.createWorktree(1),
      (error: Error & { statusCode?: number }) => {
        assert.equal(error.statusCode, 400);
        assert.match(error.message, /local_path/);
        return true;
      },
    );

    assert.equal(cloneAttempted, false, 'getOrCloneRepo should not be called when local_path is missing');
  });
});
