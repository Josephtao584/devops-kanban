import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStepResult, validateStepResult } from '../src/services/claudeStepResult.js';

test('parseStepResult 优先读取结果文件 JSON', async () => {
  const result = await parseStepResult({
    resultFileContent: JSON.stringify({
      changedFiles: ['docs/design.md'],
      summary: '已生成设计文档',
    }),
    stdout: '__STEP_RESULT__{"changedFiles":["docs/ignored.md"],"summary":"ignored"}',
  });

  assert.deepEqual(result, {
    changedFiles: ['docs/design.md'],
    summary: '已生成设计文档',
  });
});

test('parseStepResult 在没有结果文件时回退到 stdout marker', async () => {
  const result = await parseStepResult({
    stdout: 'log line\n__STEP_RESULT__{"changedFiles":["docs/design.md"],"summary":"from stdout"}',
  });

  assert.deepEqual(result, {
    changedFiles: ['docs/design.md'],
    summary: 'from stdout',
  });
});

test('validateStepResult 在 changedFiles 为空时抛错', () => {
  assert.throws(() => {
    validateStepResult({ changedFiles: [], summary: 'ok' });
  }, /changedFiles/);
});

test('validateStepResult 在 summary 为空时抛错', () => {
  assert.throws(() => {
    validateStepResult({ changedFiles: ['docs/design.md'], summary: '   ' });
  }, /summary/);
});
