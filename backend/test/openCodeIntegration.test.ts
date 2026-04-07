import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import { AgentExecutorRegistry } from '../src/services/workflow/agentExecutorRegistry.js';
import { ExecutorType } from '../src/types/executors.js';

test.test('ExecutorType enum includes OPEN_CODE', () => {
  assert.equal(ExecutorType.OPEN_CODE, 'OPEN_CODE');
});

test.test('AgentExecutorRegistry resolves OPEN_CODE executor', () => {
  const registry = new AgentExecutorRegistry();
  const executor = registry.getExecutor(ExecutorType.OPEN_CODE);
  assert.ok(executor);
  assert.equal(typeof executor.execute, 'function');
  assert.equal(typeof executor.continue, 'function');
});

test.test('AgentExecutorRegistry resolves all supported executor types', () => {
  const registry = new AgentExecutorRegistry();
  const supportedTypes: ExecutorType[] = [ExecutorType.CLAUDE_CODE, ExecutorType.OPEN_CODE];
  for (const type of supportedTypes) {
    assert.ok(registry.getExecutor(type), `Should resolve ${type}`);
  }
});
