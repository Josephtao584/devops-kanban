import test from 'node:test';
import assert from 'node:assert/strict';
import { ClaudeStepRunner, CLAUDE_DEFAULT_COMMAND, buildClaudeCliArgs, buildClaudeSpawnCommand } from '../src/services/claudeStepRunner.js';

test('buildClaudeCliArgs uses -p prompt and skip permissions', () => {
  assert.deepEqual(buildClaudeCliArgs('生成测试文档'), [
    '-p',
    '生成测试文档',
    '--dangerously-skip-permissions',
  ]);
});

test('buildClaudeSpawnCommand uses npx-based default command', () => {
  const resolved = buildClaudeSpawnCommand({ commandOverride: null, args: [], env: {} }, { PATH: 'x' });
  assert.equal(resolved.command, 'npx');
  assert.deepEqual(resolved.args, CLAUDE_DEFAULT_COMMAND.slice(1));
  assert.equal(resolved.env.PATH, 'x');
});

test('buildClaudeSpawnCommand applies override args and env', () => {
  const resolved = buildClaudeSpawnCommand({
    commandOverride: 'node custom-cli.js',
    args: ['--debug'],
    env: { DEBUG: '1' },
  }, { PATH: 'x' });

  assert.equal(resolved.command, 'node');
  assert.deepEqual(resolved.args, ['custom-cli.js', '--debug']);
  assert.equal(resolved.env.DEBUG, '1');
});

test('ClaudeStepRunner returns parsed structured result', async () => {
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
});

test('ClaudeStepRunner throws on non-zero exit code', async () => {
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

test('ClaudeStepRunner includes diagnostics when result marker is missing', async () => {
  const runner = new ClaudeStepRunner({
    spawnImpl: async () => ({
      exitCode: 0,
      stdout: 'stdout line 1\nstdout line 2',
      stderr: 'stderr line 1',
      resultFileContent: '',
      resultFilePath: '/tmp/worktree/.kanban/step-result.json',
      commandSummary: '"npx" "-y" "@anthropic-ai/claude-code@2.1.62" "-p" "prompt"',
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
    assert.match(error.message, /stderr line 1/);
    assert.match(error.message, /@anthropic-ai\/claude-code@2\.1\.62/);
    return true;
  });
});
