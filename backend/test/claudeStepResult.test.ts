import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import { parseStepResult, validateStepResult } from '../src/services/workflow/executors/claudeStepResult.js';

test.test('parseStepResult extracts summary from stdout', async () => {
  const result = await parseStepResult({
    stdout: '已生成设计文档\n补充了 workflow summary 传递',
  });

  assert.deepEqual(result, {
    summary: '已生成设计文档\n补充了 workflow summary 传递',
  });
});

test.test('parseStepResult trims surrounding whitespace and preserves content', async () => {
  const result = await parseStepResult({
    stdout: '\n  log line 1\nlog line 2\n\n',
  });

  assert.deepEqual(result, {
    summary: 'log line 1\nlog line 2',
  });
});

test.test('validateStepResult throws when summary is empty', () => {
  assert.throws(() => validateStepResult({ summary: '   ' }), /summary is required/);
});

test.test('validateStepResult returns trimmed summary', () => {
  assert.deepEqual(validateStepResult({ summary: '  done  ' }), { summary: 'done' });
});
