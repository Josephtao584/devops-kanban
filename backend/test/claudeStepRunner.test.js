import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { ClaudeStepRunner, buildClaudeCliArgs, buildClaudeSpawnCommand, prepareStepResultFile } from '../src/services/claudeStepRunner.js';

test('buildClaudeCliArgs 使用 claude -p 并跳过权限确认', () => {
  assert.deepEqual(buildClaudeCliArgs('生成测试文档'), [
    'claude',
    '-p',
    '生成测试文档',
    '--dangerously-skip-permissions',
    '--verbose',
  ]);
});

test('buildClaudeSpawnCommand 在 Windows 使用 claude.cmd', () => {
  assert.equal(buildClaudeSpawnCommand('win32'), 'claude.cmd');
  assert.equal(buildClaudeSpawnCommand('linux'), 'claude');
});

test('ClaudeStepRunner 返回统一结构化结果', async () => {
  const runner = new ClaudeStepRunner({
    spawnImpl: async () => ({
      exitCode: 0,
      stdout: '__STEP_RESULT__{"changedFiles":["docs/design.md"],"summary":"ok"}',
      stderr: '',
      resultFileContent: JSON.stringify({
        changedFiles: ['docs/design.md'],
        summary: 'ok',
      }),
      resultFilePath: '/tmp/worktree/.kanban/step-result.json',
    }),
  });

  const result = await runner.runStep({
    stepId: 'requirement-design',
    worktreePath: '/tmp/worktree',
    taskTitle: '测试任务',
    taskDescription: '测试描述',
  });

  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.parsedResult.changedFiles, ['docs/design.md']);
  assert.equal(result.parsedResult.summary, 'ok');
  assert.equal(result.resultFilePath, '/tmp/worktree/.kanban/step-result.json');
});

test('ClaudeStepRunner 在非零退出码时抛错', async () => {
  const runner = new ClaudeStepRunner({
    spawnImpl: async () => ({
      exitCode: 1,
      stdout: '',
      stderr: 'boom',
      resultFileContent: '',
      resultFilePath: '/tmp/worktree/.kanban/step-result.json',
    }),
  });

  await assert.rejects(() => runner.runStep({
    stepId: 'requirement-design',
    worktreePath: '/tmp/worktree',
    taskTitle: '测试任务',
    taskDescription: '测试描述',
  }), /Claude step failed/);
});

test('ClaudeStepRunner 在缺少结果 marker 时抛出包含完整输出和命令的错误', async () => {
  const runner = new ClaudeStepRunner({
    spawnImpl: async () => ({
      exitCode: 0,
      stdout: 'stdout line 1\nstdout line 2',
      stderr: 'stderr line 1',
      resultFileContent: '',
      resultFilePath: '/tmp/worktree/.kanban/step-result.json',
      commandSummary: '"claude" "-p" "prompt" "--dangerously-skip-permissions" "--verbose"',
      cwd: '/tmp/worktree',
      prompt: 'prompt body',
    }),
  });

  await assert.rejects(() => runner.runStep({
    stepId: 'requirement-design',
    worktreePath: '/tmp/worktree',
    taskTitle: '测试任务',
    taskDescription: '测试描述',
  }), (error) => {
    assert.match(error.message, /Missing __STEP_RESULT__ marker/);
    assert.match(error.message, /stdout line 1/);
    assert.match(error.message, /stdout line 2/);
    assert.match(error.message, /stderr line 1/);
    assert.match(error.message, /"claude" "-p"/);
    assert.match(error.message, /\/tmp\/worktree/);
    assert.match(error.message, /prompt body/);
    return true;
  });
});

