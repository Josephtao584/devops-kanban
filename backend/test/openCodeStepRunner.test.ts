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
