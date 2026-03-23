import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import type { CreateAgentBody, UpdateAgentBody } from '../../src/types/dto/agents.ts';

test.test('agent DTOs accept executor runtime config inputs', () => {
  const payload: CreateAgentBody = {
    name: 'Claude Dev',
    executorType: 'CLAUDE_CODE',
    role: 'BACKEND_DEV',
    description: 'Backend coding agent',
    enabled: true,
    skills: ['api', 'fastify'],
    commandOverride: null,
    args: ['--dangerously-skip-permissions'],
    env: { CI: 'true' },
  };

  const updatePayload: UpdateAgentBody = {
    executorType: 'CODEX',
    commandOverride: 'codex run',
    args: ['--json'],
    env: { MODE: 'strict' },
    skills: ['design'],
  };

  assert.equal(payload.executorType, 'CLAUDE_CODE');
  assert.equal(payload.commandOverride, null);
  assert.deepEqual(payload.args, ['--dangerously-skip-permissions']);
  assert.deepEqual(updatePayload.env, { MODE: 'strict' });
});
