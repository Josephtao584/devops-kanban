import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import { parseStepResult, validateStepResult } from '../src/services/workflow/executors/openCodeStepResult.js';

test.test('parseStepResult extracts summary from opencode json output', async () => {
  const result = await parseStepResult({
    stdout: JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Task completed successfully' }] } }),
  });

  assert.deepEqual(result, {
    summary: 'Task completed successfully',
  });
});

test.test('parseStepResult extracts summary from result event', async () => {
  const result = await parseStepResult({
    stdout: JSON.stringify({ type: 'result', result: 'Final answer from opencode' }),
  });

  assert.deepEqual(result, {
    summary: 'Final answer from opencode',
  });
});

test.test('parseStepResult prefers result event over assistant text', async () => {
  const lines = [
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'intermediate text' }] } }),
    JSON.stringify({ type: 'result', result: 'final result text' }),
  ];

  const result = await parseStepResult({
    stdout: lines.join('\n'),
  });

  assert.deepEqual(result, {
    summary: 'final result text',
  });
});

test.test('parseStepResult falls back to raw stdout when no json events', async () => {
  const result = await parseStepResult({
    stdout: 'plain text output from opencode',
  });

  assert.deepEqual(result, {
    summary: 'plain text output from opencode',
  });
});

test.test('validateStepResult throws when summary is empty', () => {
  assert.throws(() => validateStepResult({ summary: '   ' }), /summary is required/);
});

test.test('validateStepResult returns trimmed summary', () => {
  assert.deepEqual(validateStepResult({ summary: '  done  ' }), { summary: 'done' });
});
