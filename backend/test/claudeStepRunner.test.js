import test from 'node:test';
import assert from 'node:assert/strict';
import { ClaudeStepRunner, CLAUDE_DEFAULT_COMMAND, buildClaudeCliArgs, buildClaudeSpawnCommand, resolveCrossSpawn } from '../src/services/claudeStepRunner.js';

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

test('resolveCrossSpawn loads spawn function from package', async () => {
  const crossSpawn = await resolveCrossSpawn();
  assert.equal(typeof crossSpawn, 'function');
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

test('ClaudeStepRunner returns stdout summary result', async () => {
  const runner = new ClaudeStepRunner({
    spawnImpl: async () => ({
      exitCode: 0,
      stdout: '已完成需求分析\n修改了 workflow 定义并简化结果传递',
      stderr: '',
    }),
  });

  const result = await runner.runStep({
    stepId: 'requirement-design',
    worktreePath: '/tmp/worktree',
    taskTitle: '测试任务',
    taskDescription: '测试描述',
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.parsedResult.summary, '已完成需求分析\n修改了 workflow 定义并简化结果传递');
});

test('ClaudeStepRunner throws on non-zero exit code', async () => {
  const runner = new ClaudeStepRunner({
    spawnImpl: async () => ({
      exitCode: 1,
      stdout: '',
      stderr: 'boom',
    }),
  });

  await assert.rejects(() => runner.runStep({
    stepId: 'requirement-design',
    worktreePath: '/tmp/worktree',
    taskTitle: '测试任务',
    taskDescription: '测试描述',
  }), /Claude step failed/);
});

test('ClaudeStepRunner includes diagnostics when stdout summary is missing', async () => {
  const runner = new ClaudeStepRunner({
    spawnImpl: async () => ({
      exitCode: 0,
      stdout: '   \n\n',
      stderr: 'stderr line 1',
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
    assert.match(error.message, /summary is required/);
    assert.match(error.message, /stderr line 1/);
    assert.match(error.message, /@anthropic-ai\/claude-code@2\.1\.62/);
    return true;
  });
});
