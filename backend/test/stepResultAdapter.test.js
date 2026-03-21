import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptStepResult } from '../src/services/workflow/stepResultAdapter.js';

test('stepResultAdapter converts Claude native output into workflow step result', () => {
  const result = adaptStepResult('CLAUDE_CODE', {
    rawResult: { summary: 'done' },
  });
  assert.deepEqual(result, { summary: 'done' });
});

test('stepResultAdapter converts Codex native output into workflow step result', () => {
  const result = adaptStepResult('CODEX', {
    rawResult: { summary: 'implemented' },
  });
  assert.deepEqual(result, { summary: 'implemented' });
});

test('stepResultAdapter rejects invalid native output', () => {
  assert.throws(() => adaptStepResult('OPENCODE', {
    rawResult: { summary: '' },
  }), /summary is required/);
});
