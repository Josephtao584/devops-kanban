import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import Fastify from 'fastify';
import { agentRoutes } from '../src/routes/agents.js';

type AgentRepoStub = {
  findAll: () => Promise<unknown[]>;
  findById: (id: number) => Promise<unknown>;
  create: (body: unknown) => Promise<unknown>;
  update: (id: number, body: unknown) => Promise<unknown>;
  delete: (id: number) => Promise<boolean>;
};

type SkillRepoStub = {
  findAll: () => Promise<Array<{ id: number; name: string }>>;
};

function buildRepos() {
  const agentRepo: AgentRepoStub = {
    async findAll() { return []; },
    async findById(id: number) { return { id, name: 'agent' }; },
    async create(body: unknown) { return { id: 1, ...(body as object) }; },
    async update(id: number, body: unknown) { return { id, ...(body as object) }; },
    async delete() { return true; },
  };

  const skillRepo: SkillRepoStub = {
    async findAll() {
      return [
        { id: 1, name: 'brainstorming' },
        { id: 2, name: 'systematic-debugging' },
      ];
    },
  };

  return { agentRepo, skillRepo };
}

async function buildApp() {
  const app = Fastify();
  const { agentRepo, skillRepo } = buildRepos();
  app.register(agentRoutes, { repo: agentRepo as never, skillRepo: skillRepo as never });
  await app.ready();
  return app;
}

test.test('POST / rejects unknown skills', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: {
      name: 'agent',
      executorType: 'CLAUDE_CODE',
      role: 'BACKEND_DEV',
      description: 'desc',
      enabled: true,
      skills: ['ghost-skill']
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, 'Unknown skills: ghost-skill');
  await app.close();
});

test.test('POST / accepts existing skills', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: {
      name: 'agent',
      executorType: 'CLAUDE_CODE',
      role: 'BACKEND_DEV',
      description: 'desc',
      enabled: true,
      skills: ['brainstorming']
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.skills[0], 'brainstorming');
  await app.close();
});

test.test('PUT /:id rejects unknown skills', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'PUT',
    url: '/1',
    payload: {
      skills: ['brainstorming', 'ghost-skill']
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, 'Unknown skills: ghost-skill');
  await app.close();
});
