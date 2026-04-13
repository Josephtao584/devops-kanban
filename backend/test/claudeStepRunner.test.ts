import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import {
  ClaudeStepRunner,
  CLAUDE_DEFAULT_COMMAND,
  buildClaudeCliArgs,
  buildClaudeSpawnCommand,
  resolveCrossSpawn,
  parseStreamEvent,
} from '../src/services/workflow/executors/claudeStepRunner.js';

test.test('buildClaudeCliArgs uses -p prompt and skip permissions', () => {
  assert.deepEqual(buildClaudeCliArgs('生成测试文档'), [
    '-p',
    '生成测试文档',
    '--dangerously-skip-permissions',
    '--output-format',
    'stream-json',
    '--verbose',
  ]);
});

test.test('buildClaudeSpawnCommand uses npx-based default command', () => {
  const resolved = buildClaudeSpawnCommand({ args: [], env: {} }, { PATH: 'x' });
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

// --- AskUserQuestion detection tests ---

test.test('parseStreamEvent detects AskUserQuestion tool_use and returns ask_user event', () => {
  const json = {
    type: 'assistant',
    message: {
      content: [{
        type: 'tool_use',
        id: 'toolu_01ABC',
        name: 'AskUserQuestion',
        input: {
          questions: [{
            question: 'Which approach do you prefer?',
            header: 'Approach',
            options: [
              { label: 'Option A', value: 'a', description: 'Approach A' },
              { label: 'Option B', value: 'b', description: 'Approach B' },
            ],
            multiSelect: false,
          }],
        },
      }],
    },
  };

  const event = parseStreamEvent(json);
  assert.ok(event);
  assert.equal(event!.kind, 'ask_user');
  assert.equal(event!.role, 'assistant');
  assert.equal(event!.content, 'AskUserQuestion');
  assert.equal(event!.payload?.tool_name, 'AskUserQuestion');
  assert.equal(event!.payload?.tool_id, 'toolu_01ABC');

  const askData = event!.payload?.ask_user_question as { tool_use_id: string; questions: any[] };
  assert.equal(askData.tool_use_id, 'toolu_01ABC');
  assert.equal(askData.questions.length, 1);
  assert.equal(askData.questions[0].question, 'Which approach do you prefer?');
  assert.equal(askData.questions[0].header, 'Approach');
  assert.equal(askData.questions[0].options.length, 2);
  assert.equal(askData.questions[0].options[0].label, 'Option A');
  assert.equal(askData.questions[0].multiSelect, false);
});

test.test('parseStreamEvent returns regular tool_call for non-AskUserQuestion tools', () => {
  const json = {
    type: 'assistant',
    message: {
      content: [{
        type: 'tool_use',
        id: 'toolu_01DEF',
        name: 'Bash',
        input: { command: 'ls -la' },
      }],
    },
  };

  const event = parseStreamEvent(json);
  assert.ok(event);
  assert.equal(event!.kind, 'tool_call');
  assert.equal(event!.payload?.tool_name, 'Bash');
});

test.test('parseStreamEvent handles AskUserQuestion with missing questions gracefully', () => {
  const json = {
    type: 'assistant',
    message: {
      content: [{
        type: 'tool_use',
        id: 'toolu_01GHI',
        name: 'AskUserQuestion',
        input: {},
      }],
    },
  };

  const event = parseStreamEvent(json);
  assert.ok(event);
  assert.equal(event!.kind, 'ask_user');
  const askData = event!.payload?.ask_user_question as { tool_use_id: string; questions: any[] };
  assert.equal(askData.questions.length, 0);
});

test.test('ClaudeStepRunner throws STEP_AWAITING_USER_INPUT when AskUserQuestion is detected', async () => {
  let capturedAskUserData: any = null;
  const runner = new ClaudeStepRunner({
    spawnImpl: async ({ onAskUser }) => {
      const askData = {
        tool_use_id: 'toolu_test',
        questions: [{ question: 'Choose?', header: 'Choice', options: [{ label: 'A', value: 'a' }], multiSelect: false }],
      };
      // Simulate what defaultSpawnImpl does: call onAskUser then set askUserQuestion on result
      if (onAskUser) {
        await onAskUser(askData);
      }
      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
        commandSummary: 'mock command',
        cwd: '/tmp/worktree',
        prompt: 'prompt',
        proc: null,
        askUserQuestion: askData,
      };
    },
  });

  await assert.rejects(() => runner.runStep({
    prompt: 'prompt',
    worktreePath: '/tmp/worktree',
    executorConfig: {},
    onAskUser: (data) => { capturedAskUserData = data; },
  }), (error: unknown) => {
    const err = error as any;
    assert.equal(err.message, 'STEP_AWAITING_USER_INPUT');
    assert.ok(err.askUserQuestion);
    assert.equal(err.askUserQuestion.tool_use_id, 'toolu_test');
    assert.equal(err.askUserQuestion.questions.length, 1);
    return true;
  });

  assert.ok(capturedAskUserData);
  assert.equal(capturedAskUserData.tool_use_id, 'toolu_test');
});

test.test('ClaudeStepRunner does not throw STEP_AWAITING_USER_INPUT when no AskUserQuestion', async () => {
  const runner = new ClaudeStepRunner({
    spawnImpl: async () => ({
      exitCode: 0,
      stdout: '已完成任务',
      stderr: '',
      commandSummary: 'mock command',
      cwd: '/tmp/worktree',
      prompt: 'prompt',
      proc: null,
    }),
  });

  const result = await runner.runStep({
    prompt: 'prompt',
    worktreePath: '/tmp/worktree',
    executorConfig: {},
  });
  assert.equal(result.exitCode, 0);
  assert.equal(result.parsedResult.summary, '已完成任务');
});
