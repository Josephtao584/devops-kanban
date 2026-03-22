import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import type { CreateAgentBody, UpdateAgentBody } from '../../src/types/dto/agents.ts';

test.test('agent DTOs accept explicit create and update inputs', () => {
  const createAgentBody: CreateAgentBody = {
    name: 'Backend Developer - Alice',
    type: 'CLAUDE',
    role: 'BACKEND_DEV',
    description: 'Backend implementation specialist',
    enabled: true,
    skills: ['TypeScript', 'Fastify'],
  };

  const updateAgentBody: UpdateAgentBody = {
    enabled: false,
    skills: ['TypeScript'],
  };

  assert.equal(createAgentBody.role, 'BACKEND_DEV');
  assert.equal(updateAgentBody.enabled, false);
});
