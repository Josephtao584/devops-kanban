import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptStepResult } from '../src/services/stepResultAdapter.js';

test('stepResultAdapter converts Claude native output into workflow step result', () => {
  const result = adaptStepResult('CLAUDE_CODE', {
    rawResult: { changedFiles: ['docs/design.md'], summary: 'done' },
  });
  assert.deepEqual(result, { changedFiles: ['docs/design.md'], summary: 'done' });
});

test('stepResultAdapter converts Codex native output into workflow step result', () => {
  const result = adaptStepResult('CODEX', {
    rawResult: { changedFiles: ['src/main.js'], summary: 'implemented' },
  });
  assert.deepEqual(result, { changedFiles: ['src/main.js'], summary: 'implemented' });
});

test('stepResultAdapter rejects invalid native output', () => {
  assert.throws(() => adaptStepResult('OPENCODE', {
    rawResult: { changedFiles: [], summary: '' },
  }), /changedFiles must be a non-empty array/);
});
