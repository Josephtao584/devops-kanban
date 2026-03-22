import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { WorkflowService } from '../src/services/workflow/workflowService.js';
import type { ExecutorProcessHandle } from '../src/types/executors.js';

test.test('cancelWorkflow terminates the active process', async () => {
  const kills: string[] = [];
  let cancelled = false;

  const workflowRunRepo = {
    async findById(runId: number) {
      return { id: runId, status: 'RUNNING' };
    },
    async update(runId: number, updateData: Record<string, unknown>) {
      return { id: runId, ...updateData };
    },
  };

  const service = new WorkflowService({
    workflowRunRepo: workflowRunRepo as never,
    taskRepo: {} as never,
  });

  const proc: ExecutorProcessHandle = {
    kill(signal: string) {
      kills.push(signal);
    },
  };

  service._activeRuns.set(1, {
    cancel: () => {
      cancelled = true;
    },
    proc: null,
    context: {
      proc,
    },
  });

  const result = await service.cancelWorkflow(1);

  assert.equal(cancelled, true);
  assert.deepEqual(kills, ['SIGTERM']);
  assert.equal(result?.status, 'CANCELLED');
});
