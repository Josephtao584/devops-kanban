import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { AgentExecutorRegistry } from '../src/services/workflow/agentExecutorRegistry.js';
import { ExecutorType } from '../src/types/executors.js';

const supportedExecutorTypes: ExecutorType[] = [ExecutorType.CLAUDE_CODE];

test.test('AgentExecutorRegistry resolves CLAUDE_CODE executor', () => {
  const registry = new AgentExecutorRegistry();
  for (const type of supportedExecutorTypes) {
    assert.ok(registry.getExecutor(type));
  }
});

test.test('AgentExecutorRegistry rejects unsupported executor types', () => {
  const registry = new AgentExecutorRegistry();
  assert.throws(() => registry.getExecutor('UNKNOWN' as ExecutorType), /Unsupported executor type/);
});
