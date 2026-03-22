import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { AgentExecutorRegistry } from '../src/services/workflow/agentExecutorRegistry.js';
import type { ExecutorType } from '../src/types/executors.js';

const supportedExecutorTypes: ExecutorType[] = ['CLAUDE_CODE', 'CODEX', 'OPENCODE'];

test.test('AgentExecutorRegistry resolves CLAUDE_CODE, CODEX, and OPENCODE executors', () => {
  const registry = new AgentExecutorRegistry();
  for (const type of supportedExecutorTypes) {
    assert.ok(registry.getExecutor(type));
  }
});

test.test('AgentExecutorRegistry rejects unsupported executor types', () => {
  const registry = new AgentExecutorRegistry();
  assert.throws(() => registry.getExecutor('UNKNOWN' as ExecutorType), /Unsupported executor type/);
});
