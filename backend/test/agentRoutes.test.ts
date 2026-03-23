import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import Fastify from 'fastify';

import { agentRoutes } from '../src/routes/agents.js';
import type { CreateAgentBody, UpdateAgentBody, AgentExecutorType } from '../src/types/dto/agents.ts';

type AgentRecord = {
  id: number;
  name: string;
  executorType: AgentExecutorType;
  role: string;
  description?: string;
  enabled: boolean;
  skills: string[];
  commandOverride?: string | null;
  args: string[];
  env: Record<string, string>;
  created_at: string;
  updated_at: string;
};

type AgentRepositoryStub = {
  findAll(): Promise<AgentRecord[]>;
  findById(id: number): Promise<AgentRecord | null>;
  create(body: CreateAgentBody): Promise<AgentRecord>;
  update(id: number, body: UpdateAgentBody): Promise<AgentRecord | null>;
  delete(id: number): Promise<boolean>;
};

function buildRepositoryStub() {
  const calls = {
    create: 0,
    update: 0,
  };
  const captured = {
    createBody: null as CreateAgentBody | null,
    updateBody: null as UpdateAgentBody | null,
  };

  const repo: AgentRepositoryStub = {
    async findAll() {
      return [];
    },
    async findById() {
      return null;
    },
    async create(body) {
      calls.create += 1;
      captured.createBody = body;
      return {
        id: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...body,
      };
    },
    async update(id, body) {
      calls.update += 1;
      captured.updateBody = body;
      return {
        id,
        name: 'Existing agent',
        executorType: 'CLAUDE_CODE',
        role: 'BACKEND_DEV',
        description: 'existing',
        enabled: true,
        skills: ['fastify'],
        commandOverride: null,
        args: [],
        env: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...body,
      };
    },
    async delete() {
      return true;
    },
  };

  return { repo, calls, captured };
}

async function buildApp(repo: AgentRepositoryStub) {
  const app = Fastify();
  app.register(agentRoutes, { repo: repo as never });
  await app.ready();
  return app;
}

test.test('POST / rejects create payloads missing required runtime config fields with 400 and does not call create', async () => {
  const { repo, calls } = buildRepositoryStub();
  const app = await buildApp(repo);

  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: {
      name: 'Missing env agent',
      executorType: 'CLAUDE_CODE',
      role: 'BACKEND_DEV',
      enabled: true,
      skills: ['api'],
      args: [],
    },
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.json().message, /env is required/);
  assert.equal(calls.create, 0);

  await app.close();
});

test.test('POST / rejects non-string description with 400 and does not call create', async () => {
  const { repo, calls } = buildRepositoryStub();
  const app = await buildApp(repo);

  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: {
      name: 'Bad description agent',
      executorType: 'CLAUDE_CODE',
      role: 'BACKEND_DEV',
      description: 123,
      enabled: true,
      skills: ['api'],
      args: [],
      env: {},
    },
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.json().message, /description must be a string/);
  assert.equal(calls.create, 0);

  await app.close();
});

test.test('POST / rejects malformed skills with 400 and does not call create', async () => {
  const { repo, calls } = buildRepositoryStub();
  const app = await buildApp(repo);

  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: {
      name: 'Bad skills agent',
      executorType: 'CLAUDE_CODE',
      role: 'BACKEND_DEV',
      enabled: true,
      skills: ['api', 1],
      args: [],
      env: {},
    },
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.json().message, /skills must be an array of strings/);
  assert.equal(calls.create, 0);

  await app.close();
});

test.test('POST / rejects malformed args with 400 and does not call create', async () => {
  const { repo, calls } = buildRepositoryStub();
  const app = await buildApp(repo);

  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: {
      name: 'Bad args agent',
      executorType: 'CLAUDE_CODE',
      role: 'BACKEND_DEV',
      enabled: true,
      skills: ['api'],
      args: ['--json', 1],
      env: {},
    },
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.json().message, /args must be an array of strings/);
  assert.equal(calls.create, 0);

  await app.close();
});

test.test('POST / rejects malformed env values with 400 and does not call create', async () => {
  const { repo, calls } = buildRepositoryStub();
  const app = await buildApp(repo);

  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: {
      name: 'Bad env agent',
      executorType: 'CLAUDE_CODE',
      role: 'BACKEND_DEV',
      enabled: true,
      skills: ['api'],
      args: [],
      env: { CI: true },
    },
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.json().message, /env values must be strings/);
  assert.equal(calls.create, 0);

  await app.close();
});

test.test('POST / rejects unsupported executorType with 400 and does not call create', async () => {
  const { repo, calls } = buildRepositoryStub();
  const app = await buildApp(repo);

  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: {
      name: 'Bad agent',
      executorType: 'CURSOR',
      role: 'BACKEND_DEV',
      enabled: true,
      skills: ['api'],
      commandOverride: null,
      args: [],
      env: {},
    },
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.json().message, /Unsupported executor type/);
  assert.equal(calls.create, 0);

  await app.close();
});

test.test('POST / rejects blank commandOverride with 400 and does not call create', async () => {
  const { repo, calls } = buildRepositoryStub();
  const app = await buildApp(repo);

  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: {
      name: 'Bad agent',
      executorType: 'CLAUDE_CODE',
      role: 'BACKEND_DEV',
      enabled: true,
      skills: ['api'],
      commandOverride: '   ',
      args: [],
      env: {},
    },
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.json().message, /commandOverride cannot be blank/);
  assert.equal(calls.create, 0);

  await app.close();
});

test.test('POST / accepts a valid create payload with runtime config fields', async () => {
  const { repo, calls, captured } = buildRepositoryStub();
  const app = await buildApp(repo);

  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: {
      name: 'Claude Dev',
      executorType: 'CLAUDE_CODE',
      role: 'BACKEND_DEV',
      description: 'Backend coding agent',
      enabled: true,
      skills: ['api', 'fastify'],
      commandOverride: 'claude-code',
      args: ['--json'],
      env: { CI: 'true' },
    },
  });

  const payload = response.json() as { success: boolean; data: AgentRecord };

  assert.equal(response.statusCode, 200);
  assert.equal(payload.success, true);
  assert.equal(calls.create, 1);
  assert.deepEqual(captured.createBody, {
    name: 'Claude Dev',
    executorType: 'CLAUDE_CODE',
    role: 'BACKEND_DEV',
    description: 'Backend coding agent',
    enabled: true,
    skills: ['api', 'fastify'],
    commandOverride: 'claude-code',
    args: ['--json'],
    env: { CI: 'true' },
  });
  assert.equal(payload.data.executorType, 'CLAUDE_CODE');
  assert.equal(payload.data.commandOverride, 'claude-code');
  assert.deepEqual(payload.data.args, ['--json']);
  assert.deepEqual(payload.data.env, { CI: 'true' });

  await app.close();
});

test.test('PUT /:id rejects non-string description with 400 and does not call update', async () => {
  const { repo, calls } = buildRepositoryStub();
  const app = await buildApp(repo);

  const response = await app.inject({
    method: 'PUT',
    url: '/7',
    payload: {
      description: 123,
    },
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.json().message, /description must be a string/);
  assert.equal(calls.update, 0);

  await app.close();
});

test.test('PUT /:id rejects unsupported executorType with 400 and does not call update', async () => {
  const { repo, calls } = buildRepositoryStub();
  const app = await buildApp(repo);

  const response = await app.inject({
    method: 'PUT',
    url: '/7',
    payload: {
      executorType: 'CURSOR',
    },
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.json().message, /Unsupported executor type/);
  assert.equal(calls.update, 0);

  await app.close();
});

test.test('PUT /:id rejects blank commandOverride with 400 and does not call update', async () => {
  const { repo, calls } = buildRepositoryStub();
  const app = await buildApp(repo);

  const response = await app.inject({
    method: 'PUT',
    url: '/7',
    payload: {
      commandOverride: '   ',
    },
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.json().message, /commandOverride cannot be blank/);
  assert.equal(calls.update, 0);

  await app.close();
});

test.test('PUT /:id rejects non-string-array args with 400 and does not call update', async () => {
  const { repo, calls } = buildRepositoryStub();
  const app = await buildApp(repo);

  const response = await app.inject({
    method: 'PUT',
    url: '/7',
    payload: {
      args: ['--json', 1],
    },
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.json().message, /args must be an array of strings/);
  assert.equal(calls.update, 0);

  await app.close();
});

test.test('PUT /:id rejects non-string env values with 400 and does not call update', async () => {
  const { repo, calls } = buildRepositoryStub();
  const app = await buildApp(repo);

  const response = await app.inject({
    method: 'PUT',
    url: '/7',
    payload: {
      env: { CI: true },
    },
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.json().message, /env values must be strings/);
  assert.equal(calls.update, 0);

  await app.close();
});

test.test('PUT /:id accepts a valid partial update payload with runtime config fields', async () => {
  const { repo, calls, captured } = buildRepositoryStub();
  const app = await buildApp(repo);

  const response = await app.inject({
    method: 'PUT',
    url: '/7',
    payload: {
      executorType: 'OPENCODE',
      commandOverride: 'opencode run',
      args: ['--model', 'gpt-5'],
      env: { CI: 'true' },
      skills: ['review'],
    },
  });

  const payload = response.json() as { success: boolean; data: AgentRecord };

  assert.equal(response.statusCode, 200);
  assert.equal(payload.success, true);
  assert.equal(calls.update, 1);
  assert.deepEqual(captured.updateBody, {
    executorType: 'OPENCODE',
    commandOverride: 'opencode run',
    args: ['--model', 'gpt-5'],
    env: { CI: 'true' },
    skills: ['review'],
  });
  assert.equal(payload.data.executorType, 'OPENCODE');
  assert.equal(payload.data.commandOverride, 'opencode run');
  assert.deepEqual(payload.data.args, ['--model', 'gpt-5']);
  assert.deepEqual(payload.data.env, { CI: 'true' });
  assert.deepEqual(payload.data.skills, ['review']);

  await app.close();
});
