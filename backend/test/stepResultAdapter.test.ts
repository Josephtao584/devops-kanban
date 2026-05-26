import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import { adaptStepResult } from '../src/services/workflow/stepResultAdapter.js';

test.test('stepResultAdapter converts Claude native output into workflow step result', () => {
  const result = adaptStepResult('CLAUDE_CODE', {
    rawResult: { summary: 'done' },
  });
  assert.equal(result.summary, 'done');
  assert.equal(result.earlyExitDecision, 'CONTINUE');
  assert.equal(result.earlyExitReason, null);
});

test.test('stepResultAdapter converts Codex native output into workflow step result', () => {
  const result = adaptStepResult('CODEX', {
    rawResult: { summary: 'implemented' },
  });
  assert.equal(result.summary, 'implemented');
  assert.equal(result.earlyExitDecision, 'CONTINUE');
  assert.equal(result.earlyExitReason, null);
});

test.test('stepResultAdapter rejects invalid native output', () => {
  assert.throws(() => adaptStepResult('OPENCODE', {
    rawResult: { summary: '' },
  }), /summary is required/);
});
