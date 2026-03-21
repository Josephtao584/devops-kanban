import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import {
  ClaudeStepRunner,
  CLAUDE_DEFAULT_COMMAND,
  buildClaudeCliArgs,
  buildClaudeSpawnCommand,
  resolveCrossSpawn,
} from '../src/services/workflow/executors/claudeStepRunner.js';

test.test('buildClaudeCliArgs uses -p prompt and skip permissions', () => {
  assert.deepEqual(buildClaudeCliArgs('生成测试文档'), [
    '-p',
    '生成测试文档',
    '--dangerously-skip-permissions',
  ]);
});

test.test('buildClaudeSpawnCommand uses npx-based default command', () => {
  const resolved = buildClaudeSpawnCommand({ commandOverride: null, args: [], env: {} }, { PATH: 'x' });
  assert.equal(resolved.command, 'npx');
  assert.deepEqual(resolved.args, CLAUDE_DEFAULT_COMMAND.slice(1));
  assert.equal(resolved.env.PATH, 'x');
});

test.test('resolveCrossSpawn loads spawn function from package', async () => {
  const crossSpawn = await resolveCrossSpawn();
  assert.equal(typeof crossSpawn, 'function');
});

test.test('buildClaudeSpawnCommand applies override args and env', () => {
  const resolved = buildClaudeSpawnCommand({
    commandOverride: 'node custom-cli.js',
    args: ['--debug'],
    env: { DEBUG: '1' },
  }, { PATH: 'x' });

  assert.equal(resolved.command, 'node');
  assert.deepEqual(resolved.args, ['custom-cli.js', '--debug']);
  assert.equal(resolved.env.DEBUG, '1');
});

test.test('ClaudeStepRunner passes provided prompt to spawn implementation', async () => {
  let receivedPrompt: string | null = null;
  const runner = new ClaudeStepRunner({
    spawnImpl: async ({ prompt }) => {
      receivedPrompt = prompt;
      return {
        exitCode: 0,
        stdout: '已完成需求分析\n修改了 workflow 定义并简化结果传递',
        stderr: '',
        commandSummary: 'mock command',
        cwd: '/tmp/worktree',
        prompt,
        proc: null,
      };
    },
  });

  const result = await runner.runStep({
    prompt: '当前步骤：代码开发\n\n本步骤要求：\n根据设计摘要完成代码实现。',
    worktreePath: '/tmp/worktree',
    executorConfig: {},
  });

  assert.equal(receivedPrompt, '当前步骤：代码开发\n\n本步骤要求：\n根据设计摘要完成代码实现。');
  assert.equal(result.exitCode, 0);
  assert.equal(result.parsedResult.summary, '已完成需求分析\n修改了 workflow 定义并简化结果传递');
});

test.test('ClaudeStepRunner throws on non-zero exit code', async () => {
  const runner = new ClaudeStepRunner({
    spawnImpl: async () => ({
      exitCode: 1,
      stdout: '',
      stderr: 'boom',
      commandSummary: 'mock command',
      cwd: '/tmp/worktree',
      prompt: 'prompt body',
      proc: null,
    }),
  });

  await assert.rejects(() => runner.runStep({
    prompt: 'prompt body',
    worktreePath: '/tmp/worktree',
    executorConfig: {},
  }), /Claude step failed/);
});

test.test('ClaudeStepRunner includes diagnostics when stdout summary is missing', async () => {
  const runner = new ClaudeStepRunner({
    spawnImpl: async () => ({
      exitCode: 0,
      stdout: '   \n\n',
      stderr: 'stderr line 1',
      commandSummary: '"npx" "-y" "@anthropic-ai/claude-code@2.1.62" "-p" "prompt"',
      cwd: '/tmp/worktree',
      prompt: 'prompt body',
      proc: null,
    }),
  });

  await assert.rejects(() => runner.runStep({
    prompt: 'prompt body',
    worktreePath: '/tmp/worktree',
    executorConfig: {},
  }), (error: unknown) => {
    const typedError = error as Error;
    assert.match(typedError.message, /summary is required/);
    assert.match(typedError.message, /stderr line 1/);
    assert.match(typedError.message, /@anthropic-ai\/claude-code@2\.1\.62/);
    return true;
  });
});
