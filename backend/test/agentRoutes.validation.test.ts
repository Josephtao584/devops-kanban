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
      return [{ id: 1, identifier: 'brainstorming', name: '头脑风暴' }];
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

const longName = 'a'.repeat(201);
const exactName = 'a'.repeat(200);
const longDesc = 'b'.repeat(5001);
const exactDesc = 'b'.repeat(5000);
const longRole = 'c'.repeat(201);
const exactRole = 'c'.repeat(200);

const validPayload = {
  name: 'agent',
  executorType: 'CLAUDE_CODE',
  role: 'BACKEND_DEV',
  description: 'desc',
  enabled: true,
  skills: [1],
};

// ─── POST / validation ───────────────────────────────────

test.test('POST / rejects name exceeding 200 characters', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: { ...validPayload, name: longName },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, '名称不能超过 200 个字符');
  await app.close();
});

test.test('POST / accepts name at exactly 200 characters', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: { ...validPayload, name: exactName },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.name, exactName);
  await app.close();
});

test.test('POST / rejects description exceeding 5000 characters', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: { ...validPayload, description: longDesc },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, '描述不能超过 5000 个字符');
  await app.close();
});

test.test('POST / accepts description at exactly 5000 characters', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: { ...validPayload, description: exactDesc },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.description, exactDesc);
  await app.close();
});

test.test('POST / rejects role exceeding 200 characters', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: { ...validPayload, role: longRole },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, '角色不能超过 200 个字符');
  await app.close();
});

test.test('POST / accepts role at exactly 200 characters', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: { ...validPayload, role: exactRole },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.role, exactRole);
  await app.close();
});

// ─── PUT /:id validation ─────────────────────────────────

test.test('PUT /:id rejects name exceeding 200 characters', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'PUT',
    url: '/1',
    payload: { name: longName },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, '名称不能超过 200 个字符');
  await app.close();
});

test.test('PUT /:id accepts name at exactly 200 characters', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'PUT',
    url: '/1',
    payload: { name: exactName },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.name, exactName);
  await app.close();
});

test.test('PUT /:id rejects description exceeding 5000 characters', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'PUT',
    url: '/1',
    payload: { description: longDesc },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, '描述不能超过 5000 个字符');
  await app.close();
});

test.test('PUT /:id accepts description at exactly 5000 characters', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'PUT',
    url: '/1',
    payload: { description: exactDesc },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.description, exactDesc);
  await app.close();
});

test.test('PUT /:id rejects role exceeding 200 characters', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'PUT',
    url: '/1',
    payload: { role: longRole },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, '角色不能超过 200 个字符');
  await app.close();
});
