import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { cropInstanceForLoop, formatLoopContext, collectPriorSummaries } from '../../src/services/workflow/workflows.js';

const instance = {
  instance_id: 'i',
  template_id: 't',
  template_version: 'v1',
  name: 'I',
  steps: [
    { id: 'step1', name: 'S1', agentId: 1, instructionPrompt: 'p1' },
    { id: 'step2', name: 'S2', agentId: 1, instructionPrompt: 'p2' },
    { id: 'step3', name: 'S3', agentId: 1, instructionPrompt: 'p3' },
  ],
} as any;

test.test('cropInstanceForLoop returns instance starting at fromStepId', () => {
  const cropped = cropInstanceForLoop(instance, 'step2');
  assert.deepEqual(cropped.steps.map((s: any) => s.id), ['step2', 'step3']);
});

test.test('cropInstanceForLoop returns full instance when fromStepId is null', () => {
  const cropped = cropInstanceForLoop(instance, null);
  assert.deepEqual(cropped.steps.map((s: any) => s.id), ['step1', 'step2', 'step3']);
});

test.test('cropInstanceForLoop throws when fromStepId is not in instance', () => {
  assert.throws(() => cropInstanceForLoop(instance, 'ghost'), /not found/);
});

test.test('formatLoopContext renders failure + prior summaries', () => {
  const text = formatLoopContext({
    fromStepId: 'step2',
    failureContext: { failed_step_id: 'step3', error: 'boom', summary: 'tests failed' },
    priorSummaries: [
      { stepId: 'step1', name: 'S1', summary: 'analysed requirements' },
    ],
  });
  assert.match(text, /上一轮在步骤.*step3.*失败/);
  assert.match(text, /boom/);
  assert.match(text, /analysed requirements/);
});

test.test('formatLoopContext shows placeholder for missing summary', () => {
  const text = formatLoopContext({
    fromStepId: 'step2',
    failureContext: { failed_step_id: 'step3', error: 'boom', summary: null },
    priorSummaries: [{ stepId: 'step1', name: 'S1', summary: null }],
  });
  assert.match(text, /摘要不可用/);
});

test.test('collectPriorSummaries walks parent chain', async () => {
  const repo = {
    findById: async (id: number) => ({
      id,
      parent_run_id: id === 2 ? 1 : null,
      steps: id === 2
        ? [{ step_id: 'step1', name: 'S1', summary: 'r1', status: 'SKIPPED', inherited_from_run_id: 1 }]
        : [{ step_id: 'step1', name: 'S1', summary: 'analysed', status: 'COMPLETED' }],
    }),
  } as any;
  const summaries = await collectPriorSummaries(repo, 2, 'step2');
  assert.equal(summaries[0]?.summary, 'analysed');
  assert.equal(summaries[0]?.stepId, 'step1');
});
