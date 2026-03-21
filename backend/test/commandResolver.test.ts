import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import { resolveCommand } from '../src/services/workflow/executors/commandResolver.js';

test.test('resolveCommand uses executor default command when no override is set', () => {
  assert.deepEqual(resolveCommand({
    defaultCommand: ['npx', '-y', '@anthropic-ai/claude-code@2.1.62'],
    executorConfig: { commandOverride: null, args: [], env: {} },
    processEnv: { PATH: 'x' },
  }), {
    command: 'npx',
    args: ['-y', '@anthropic-ai/claude-code@2.1.62'],
    env: { PATH: 'x' },
  });
});

test.test('resolveCommand merges command override args and env', () => {
  const resolved = resolveCommand({
    defaultCommand: ['npx', '-y', '@anthropic-ai/claude-code@2.1.62'],
    executorConfig: {
      commandOverride: 'node custom-cli.js',
      args: ['--foo'],
      env: { DEBUG: '1' },
    },
    processEnv: { PATH: 'x' },
  });

  assert.equal(resolved.command, 'node');
  assert.deepEqual(resolved.args, ['custom-cli.js', '--foo']);
  assert.equal(resolved.env.DEBUG, '1');
  assert.equal(resolved.env.PATH, 'x');
});
