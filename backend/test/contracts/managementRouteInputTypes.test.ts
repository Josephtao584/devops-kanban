import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import type { CreateAgentBody, UpdateAgentBody } from '../../src/types/dto/agents.ts';

test.test('agent DTOs accept explicit create and update inputs', () => {
  const createAgentBody: CreateAgentBody = {
    name: 'Backend Developer - Alice',
    executorType: 'CLAUDE_CODE',
    role: 'BACKEND_DEV',
    description: 'Backend implementation specialist',
    enabled: true,
    skills: ['TypeScript', 'Fastify'],
    commandOverride: null,
    args: [],
    env: {},
  };

  const updateAgentBody: UpdateAgentBody = {
    enabled: false,
    skills: ['TypeScript'],
    executorType: 'OPENCODE',
    commandOverride: 'opencode run',
    args: ['--model', 'gpt-5'],
    env: { CI: 'true' },
  };

  assert.equal(createAgentBody.role, 'BACKEND_DEV');
  assert.equal(createAgentBody.executorType, 'CLAUDE_CODE');
  assert.deepEqual(createAgentBody.args, []);
  assert.deepEqual(createAgentBody.env, {});
  assert.equal(updateAgentBody.enabled, false);
  assert.equal(updateAgentBody.executorType, 'OPENCODE');
});
