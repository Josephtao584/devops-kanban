import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { WorkflowTemplateService } from '../../src/services/workflow/workflowTemplateService.js';

const baseStep = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: id,
  instructionPrompt: 'p',
  agentId: 1,
  ...extra,
});

function makeService(): WorkflowTemplateService {
  // The new normalize/cleanup methods do not touch the repo, so a stub is fine.
  return new WorkflowTemplateService({ workflowTemplateRepo: {} as any, agentRepo: {} as any });
}

test.test('normalizeTemplate accepts maxLoops >= 0', () => {
  const svc = makeService();
  const t = svc.normalizeTemplate({
    template_id: 't1',
    name: 'T',
    steps: [baseStep('s1')],
    maxLoops: 3,
  });
  assert.equal(t.maxLoops, 3);
});

test.test('normalizeTemplate rejects negative maxLoops', () => {
  const svc = makeService();
  assert.throws(() => svc.normalizeTemplate({
    template_id: 't1',
    name: 'T',
    steps: [baseStep('s1')],
    maxLoops: -1,
  }), /maxLoops/);
});

test.test('normalizeTemplate defaults maxLoops to 0 when missing', () => {
  const svc = makeService();
  const t = svc.normalizeTemplate({
    template_id: 't1',
    name: 'T',
    steps: [baseStep('s1')],
  });
  assert.equal(t.maxLoops, 0);
});

test.test('onFailureLoopTo must reference an earlier step in the template', () => {
  const svc = makeService();
  assert.throws(() => svc.normalizeTemplate({
    template_id: 't1',
    name: 'T',
    steps: [
      baseStep('s1', { onFailureLoopTo: 's2' }),
      baseStep('s2'),
    ],
  }), /onFailureLoopTo/);
});

test.test('onFailureLoopTo accepts a valid earlier step', () => {
  const svc = makeService();
  const t = svc.normalizeTemplate({
    template_id: 't1',
    name: 'T',
    steps: [
      baseStep('s1'),
      baseStep('s2'),
      baseStep('s3', { onFailureLoopTo: 's1' }),
    ],
  });
  assert.equal(t.steps[2].onFailureLoopTo, 's1');
});

test.test('onFailureLoopTo cannot point to itself', () => {
  const svc = makeService();
  assert.throws(() => svc.normalizeTemplate({
    template_id: 't1',
    name: 'T',
    steps: [baseStep('s1', { onFailureLoopTo: 's1' })],
  }), /onFailureLoopTo/);
});

test.test('onFailureLoopTo must reference an existing step id', () => {
  const svc = makeService();
  assert.throws(() => svc.normalizeTemplate({
    template_id: 't1',
    name: 'T',
    steps: [
      baseStep('s1'),
      baseStep('s2', { onFailureLoopTo: 'ghost' }),
    ],
  }), /onFailureLoopTo/);
});

test.test('removing a step auto-nullifies references to it', () => {
  const svc = makeService();
  const before = svc.normalizeTemplate({
    template_id: 't1',
    name: 'T',
    steps: [
      baseStep('s1'),
      baseStep('s2'),
      baseStep('s3', { onFailureLoopTo: 's2' }),
    ],
  });
  const after = svc.cleanupReferences({
    ...before,
    id: 0,
    created_at: '',
    updated_at: '',
    steps: [before.steps[0], before.steps[2]],
  });
  assert.equal(after.steps[1].onFailureLoopTo, null);
});
