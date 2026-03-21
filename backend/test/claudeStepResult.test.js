import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStepResult, validateStepResult } from '../src/services/workflow/executors/claudeStepResult.js';

test('parseStepResult 从 stdout 提取 summary', async () => {
  const result = await parseStepResult({
    stdout: '已生成设计文档\n补充了 workflow summary 传递',
  });

  assert.deepEqual(result, {
    summary: '已生成设计文档\n补充了 workflow summary 传递',
  });
});

test('parseStepResult 保留原始 stdout 文本，清理首尾空白', async () => {
  const result = await parseStepResult({
    stdout: '\n  log line 1\nlog line 2\n\n',
  });

  assert.deepEqual(result, {
    summary: 'log line 1\nlog line 2',
  });
});

test('validateStepResult 在 summary 为空时抛错', () => {
  assert.throws(() => validateStepResult({ summary: '   ' }), /summary is required/);
});

test('validateStepResult 返回修剪后的 summary', () => {
  assert.deepEqual(validateStepResult({ summary: '  done  ' }), { summary: 'done' });
});
