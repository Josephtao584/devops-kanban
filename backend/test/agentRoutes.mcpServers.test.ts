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
  findAll: () => Promise<Array<{ id: number; identifier: string; name: string }>>;
};

type McpServerRepoStub = {
  findAll: () => Promise<Array<{ id: number; name: string; server_type: string }>>;
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
        { id: 1, identifier: 'brainstorming', name: '头脑风暴' },
      ];
    },
  };

  const mcpServerRepo: McpServerRepoStub = {
    async findAll() {
      return [
        { id: 10, name: 'context7', server_type: 'stdio' },
        { id: 20, name: 'playwright', server_type: 'stdio' },
      ];
    },
  };

  return { agentRepo, skillRepo, mcpServerRepo };
}

async function buildApp() {
  const app = Fastify();
  const { agentRepo, skillRepo, mcpServerRepo } = buildRepos();
  app.register(agentRoutes, { repo: agentRepo as never, skillRepo: skillRepo as never, mcpServerRepo: mcpServerRepo as never });
  await app.ready();
  return app;
}

// ─── POST / with mcpServers ─────────────────────────────

test.test('POST / accepts valid mcpServers', async () => {
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
      skills: [],
      mcpServers: [10, 20],
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().data.mcpServers, [10, 20]);
  await app.close();
});

test.test('POST / rejects unknown mcpServers', async () => {
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
      skills: [],
      mcpServers: [10, 999],
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, 'Unknown MCP servers: 999');
  await app.close();
});

test.test('POST / rejects non-array mcpServers', async () => {
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
      skills: [],
      mcpServers: 10,
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, 'mcpServers must be an array of numbers');
  await app.close();
});

// ─── PUT /:id with mcpServers ───────────────────────────

test.test('PUT /:id accepts valid mcpServers update', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'PUT',
    url: '/1',
    payload: {
      mcpServers: [20],
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().data.mcpServers, [20]);
  await app.close();
});

test.test('PUT /:id rejects unknown mcpServers', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'PUT',
    url: '/1',
    payload: {
      mcpServers: [999],
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, 'Unknown MCP servers: 999');
  await app.close();
});

test.test('PUT /:id allows updates without mcpServers field', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'PUT',
    url: '/1',
    payload: {
      description: 'updated desc',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.description, 'updated desc');
  await app.close();
});
