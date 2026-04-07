import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import {
  OpenCodeStepRunner,
  buildOpenCodeCliArgs,
  buildOpenCodeSpawnCommand,
  parseStreamEvent,
} from '../src/services/workflow/executors/openCodeStepRunner.js';

test.test('buildOpenCodeCliArgs uses run subcommand with json format', () => {
  assert.deepEqual(buildOpenCodeCliArgs('implement the feature'), [
    'run',
    '--format', 'json',
    'implement the feature',
  ]);
});

test.test('buildOpenCodeCliArgs includes model flag when provided', () => {
  assert.deepEqual(buildOpenCodeCliArgs('fix the bug', { model: 'anthropic/claude-3.7-sonnet' }), [
    'run',
    '--format', 'json',
    '--model', 'anthropic/claude-3.7-sonnet',
    'fix the bug',
  ]);
});

test.test('buildOpenCodeCliArgs includes session flag for continue', () => {
  assert.deepEqual(buildOpenCodeCliArgs('continue work', { session: 'sess-123' }), [
    'run',
    '--format', 'json',
    '--session', 'sess-123',
    'continue work',
  ]);
});

test.test('buildOpenCodeCliArgs throws on invalid model format', () => {
  assert.throws(() => buildOpenCodeCliArgs('test', { model: 'bad;model' }), /Invalid model format/);
  assert.throws(() => buildOpenCodeCliArgs('test', { model: '$(inject)' }), /Invalid model format/);
});

test.test('buildOpenCodeCliArgs accepts valid model formats', () => {
  assert.doesNotThrow(() => buildOpenCodeCliArgs('test', { model: 'anthropic/claude-3.7-sonnet' }));
  assert.doesNotThrow(() => buildOpenCodeCliArgs('test', { model: 'openai/gpt-4.1' }));
  assert.doesNotThrow(() => buildOpenCodeCliArgs('test', { model: 'local:model:8b' }));
});

test.test('buildOpenCodeSpawnCommand uses opencode default from config', () => {
  const resolved = buildOpenCodeSpawnCommand({}, { PATH: 'x' });
  assert.equal(resolved.command, 'opencode');
  assert.deepEqual(resolved.args, []);
  assert.equal(resolved.env.PATH, 'x');
});

test.test('buildOpenCodeSpawnCommand applies commandOverride', () => {
  const resolved = buildOpenCodeSpawnCommand({
    commandOverride: '/usr/local/bin/my-agent',
    args: ['--verbose'],
    env: { DEBUG: '1' },
  }, { PATH: 'x' });

  assert.equal(resolved.command, '/usr/local/bin/my-agent');
  assert.deepEqual(resolved.args, ['--verbose']);
  assert.equal(resolved.env.DEBUG, '1');
});

test.test('parseStreamEvent converts assistant text to message event', () => {
  const event = parseStreamEvent({
    type: 'assistant',
    message: {
      content: [{ type: 'text', text: 'Hello from opencode' }],
    },
  });

  assert.ok(event);
  assert.equal(event!.kind, 'message');
  assert.equal(event!.role, 'assistant');
  assert.equal(event!.content, 'Hello from opencode');
});

test.test('parseStreamEvent converts tool use to tool_call event', () => {
  const event = parseStreamEvent({
    type: 'assistant',
    message: {
      content: [{ type: 'tool_use', name: 'read_file', id: 'tu-1', input: { path: '/tmp/file.ts' } }],
    },
  });

  assert.ok(event);
  assert.equal(event!.kind, 'tool_call');
  assert.equal(event!.content, 'read_file');
  assert.equal(event!.payload!.tool_name, 'read_file');
});

test.test('parseStreamEvent converts tool result to tool_result event', () => {
  const event = parseStreamEvent({
    type: 'user',
    message: {
      content: [{ type: 'tool_result', tool_use_id: 'tu-1', content: 'file contents here' }],
    },
  });

  assert.ok(event);
  assert.equal(event!.kind, 'tool_result');
  assert.equal(event!.role, 'tool');
});

test.test('parseStreamEvent converts result to status event', () => {
  const event = parseStreamEvent({
    type: 'result',
    result: 'Final answer',
  });

  assert.ok(event);
  assert.equal(event!.kind, 'status');
  assert.equal(event!.content, 'completed');
});

test.test('parseStreamEvent converts error to error event', () => {
  const event = parseStreamEvent({
    type: 'error',
    error: { message: 'Something went wrong' },
  });

  assert.ok(event);
  assert.equal(event!.kind, 'error');
  assert.equal(event!.content, 'Something went wrong');
});

test.test('parseStreamEvent returns null for unknown event types', () => {
  const event = parseStreamEvent({ type: 'unknown_type' });
  assert.equal(event, null);
});

test.test('parseStreamEvent extracts text from part.text for type "text"', () => {
  const event = parseStreamEvent({
    type: 'text',
    timestamp: 1775565774253,
    sessionID: 'ses_298086c81ffeKf6A5BcXwU9C0V',
    part: {
      id: 'prt_d67f79d100012iooqBRZATxW2c',
      messageID: 'msg_d67f79426001f51QwkosDKpUYg',
      sessionID: 'ses_298086c81ffeKf6A5BcXwU9C0V',
      type: 'text',
      text: 'Hello!',
    },
  });
  assert.ok(event);
  assert.equal(event!.kind, 'message');
  assert.equal(event!.role, 'assistant');
  assert.equal(event!.content, 'Hello!');
});

test.test('parseStreamEvent captures session_id from step_start', () => {
  const event = parseStreamEvent({
    type: 'step_start',
    timestamp: 1775565774099,
    sessionID: 'ses_298086c81ffeKf6A5BcXwU9C0V',
    part: {
      id: 'prt_d67f79d0e001hE3eHqnoDn54D1',
      messageID: 'msg_d67f79426001f51QwkosDKpUYg',
      sessionID: 'ses_298086c81ffeKf6A5BcXwU9C0V',
      type: 'step-start',
    },
  });
  assert.ok(event);
  assert.equal(event!.kind, 'status');
  assert.equal(event!.payload!.session_id, 'ses_298086c81ffeKf6A5BcXwU9C0V');
});

test.test('parseStreamEvent captures session_id from step_finish', () => {
  const event = parseStreamEvent({
    type: 'step_finish',
    timestamp: 1775565774365,
    sessionID: 'ses_298086c81ffeKf6A5BcXwU9C0V',
    part: {
      type: 'step-finish',
      reason: 'stop',
      tokens: { total: 11713, input: 9894, output: 3 },
      cost: 0.00612042,
    },
  });
  assert.ok(event);
  assert.equal(event!.kind, 'status');
  assert.equal(event!.payload!.session_id, 'ses_298086c81ffeKf6A5BcXwU9C0V');
});

test.test('parseStreamEvent returns null for text event without part', () => {
  const event = parseStreamEvent({ type: 'text', timestamp: 123 });
  assert.equal(event, null);
});

test.test('parseStreamEvent converts tool_use to tool_call event with output', () => {
  const event = parseStreamEvent({
    type: 'tool_use',
    timestamp: 1775566804097,
    sessionID: 'ses_297f8b2d8ffe1ftYOzWccMypPV',
    part: {
      type: 'tool',
      tool: 'bash',
      callID: 'call_function_69eh54xim4h0_1',
      state: {
        status: 'completed',
        input: { command: 'ls -la' },
        output: 'total 168\ndrwxr-xr-x 21 user staff 672 Apr 7 .\n',
      },
    },
  });

  assert.ok(event);
  assert.equal(event!.kind, 'tool_call');
  assert.equal(event!.content, 'bash');
  assert.equal(event!.payload!.tool_name, 'bash');
  assert.equal(event!.payload!.tool_id, 'call_function_69eh54xim4h0_1');
  assert.equal(event!.payload!.is_error, false);
});

test.test('parseStreamEvent converts tool_use with error status', () => {
  const event = parseStreamEvent({
    type: 'tool_use',
    timestamp: 1775566804315,
    sessionID: 'ses_test',
    part: {
      type: 'tool',
      tool: 'read',
      callID: 'call_test_1',
      state: {
        status: 'error',
        input: { filePath: '/tmp/missing.txt' },
        error: 'File not found',
      },
    },
  });

  assert.ok(event);
  assert.equal(event!.kind, 'tool_call');
  assert.equal(event!.content, 'read');
  assert.equal(event!.payload!.tool_name, 'read');
  assert.equal(event!.payload!.is_error, true);
});

test.test('parseStreamEvent returns null for tool_use without part', () => {
  const event = parseStreamEvent({ type: 'tool_use', timestamp: 123 });
  assert.equal(event, null);
});

test.test('OpenCodeStepRunner passes prompt to spawn implementation', async () => {
  let receivedPrompt: string | null = null;
  const runner = new OpenCodeStepRunner({
    spawnImpl: async ({ prompt }) => {
      receivedPrompt = prompt;
      return {
        exitCode: 0,
        stdout: JSON.stringify({ type: 'result', result: 'Task completed' }),
        stderr: '',
        commandSummary: 'mock command',
        cwd: '/tmp/worktree',
        prompt,
        proc: null,
      };
    },
  });

  const result = await runner.runStep({
    prompt: 'Implement the login feature',
    worktreePath: '/tmp/worktree',
  });

  assert.equal(receivedPrompt, 'Implement the login feature');
  assert.equal(result.exitCode, 0);
  assert.equal(result.parsedResult.summary, 'Task completed');
});

test.test('OpenCodeStepRunner throws on non-zero exit code', async () => {
  const runner = new OpenCodeStepRunner({
    spawnImpl: async () => ({
      exitCode: 1,
      stdout: '',
      stderr: 'command not found: opencode',
      commandSummary: 'mock command',
      cwd: '/tmp/worktree',
      prompt: 'prompt body',
      proc: null,
    }),
  });

  await assert.rejects(() => runner.runStep({
    prompt: 'prompt body',
    worktreePath: '/tmp/worktree',
  }), /OpenCode step failed/);
});

test.test('OpenCodeStepRunner includes diagnostics when stdout summary is missing', async () => {
  const runner = new OpenCodeStepRunner({
    spawnImpl: async () => ({
      exitCode: 0,
      stdout: '   \n\n',
      stderr: 'some stderr warning',
      commandSummary: '"opencode" "run" "--format" "json" "prompt"',
      cwd: '/tmp/worktree',
      prompt: 'prompt body',
      proc: null,
    }),
  });

  await assert.rejects(() => runner.runStep({
    prompt: 'prompt body',
    worktreePath: '/tmp/worktree',
  }), (error: unknown) => {
    const typedError = error as Error;
    assert.match(typedError.message, /summary is required/);
    assert.match(typedError.message, /some stderr warning/);
    return true;
  });
});
