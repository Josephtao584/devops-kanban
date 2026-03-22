import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { AgentExecutorRegistry } from '../src/services/workflow/agentExecutorRegistry.js';

test.test('AgentExecutorRegistry resolves CLAUDE_CODE, CODEX, and OPENCODE executors', () => {
  const registry = new AgentExecutorRegistry();
  assert.ok(registry.getExecutor('CLAUDE_CODE'));
  assert.ok(registry.getExecutor('CODEX'));
  assert.ok(registry.getExecutor('OPENCODE'));
});

test.test('AgentExecutorRegistry rejects unsupported executor types', () => {
  const registry = new AgentExecutorRegistry();
  assert.throws(() => registry.getExecutor('UNKNOWN'), /Unsupported executor type/);
});
