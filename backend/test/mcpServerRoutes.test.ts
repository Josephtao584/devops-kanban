import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import Fastify from 'fastify';
import { mcpServerRoutes } from '../src/routes/mcpServers.js';

type McpServerServiceStub = {
  listMcpServers: () => Promise<unknown[]>;
  getMcpServer: (id: number) => Promise<unknown>;
  createMcpServer: (data: unknown) => Promise<unknown>;
  updateMcpServer: (id: number, data: unknown) => Promise<unknown>;
  deleteMcpServer: (id: number) => Promise<boolean>;
};

function buildMcpServerService(): McpServerServiceStub {
  const servers: Map<number, { id: number; name: string; description: string; server_type: string; config: Record<string, unknown>; created_at: string; updated_at: string }> = new Map();
  let nextId = 1;

  return {
    async listMcpServers() {
      return [...servers.values()];
    },
    async getMcpServer(id: number) {
      return servers.get(id) || null;
    },
    async createMcpServer(data: unknown) {
      const d = data as { name: string; description?: string; server_type: string; config: Record<string, unknown> };
      if ([...servers.values()].some(s => s.name === d.name)) {
        const error: any = new Error(`MCP server "${d.name}" already exists`);
        error.statusCode = 409;
        throw error;
      }
      const server = { id: nextId++, name: d.name, description: d.description || '', server_type: d.server_type, config: d.config, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      servers.set(server.id, server);
      return server;
    },
    async updateMcpServer(id: number, data: unknown) {
      const existing = servers.get(id);
      if (!existing) return null;
      const d = data as Record<string, unknown>;
      const updated = { ...existing, ...d, updated_at: new Date().toISOString() };
      servers.set(id, updated);
      return updated;
    },
    async deleteMcpServer(id: number) {
      return servers.delete(id);
    },
  };
}

async function buildApp() {
  const app = Fastify();
  app.register(mcpServerRoutes, { mcpServerService: buildMcpServerService() as never });
  await app.ready();
  return app;
}

// ─── GET / ──────────────────────────────────────────────

test.test('GET / returns empty list initially', async () => {
  const app = await buildApp();
  const response = await app.inject({ method: 'GET', url: '/' });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().success, true);
  assert.deepEqual(response.json().data, []);
  await app.close();
});

// ─── POST / (create) ───────────────────────────────────

test.test('POST / creates a stdio MCP server', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: {
      name: 'context7',
      description: 'Documentation lookup',
      server_type: 'stdio',
      config: { command: 'npx', args: ['-y', '@upstash/context7-mcp'] },
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.success, true);
  assert.equal(body.data.name, 'context7');
  assert.equal(body.data.server_type, 'stdio');
  assert.deepEqual(body.data.config, { command: 'npx', args: ['-y', '@upstash/context7-mcp'] });
  await app.close();
});

test.test('POST / creates an http MCP server', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: {
      name: 'github',
      server_type: 'http',
      config: { url: 'https://api.github.com/mcp', headers: { Authorization: 'Bearer token' } },
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.success, true);
  assert.equal(body.data.name, 'github');
  assert.equal(body.data.server_type, 'http');
  await app.close();
});

test.test('POST / rejects missing name', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: { server_type: 'stdio', config: { command: 'npx' } },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, 'name is required');
  await app.close();
});

test.test('POST / rejects blank name', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: { name: '   ', server_type: 'stdio', config: { command: 'npx' } },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, 'name is required');
  await app.close();
});

test.test('POST / rejects invalid server_type', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: { name: 'test', server_type: 'invalid', config: {} },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, 'server_type must be "stdio" or "http"');
  await app.close();
});

test.test('POST / rejects duplicate name', async () => {
  const app = await buildApp();
  await app.inject({
    method: 'POST',
    url: '/',
    payload: { name: 'context7', server_type: 'stdio', config: { command: 'npx' } },
  });

  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: { name: 'context7', server_type: 'stdio', config: { command: 'npx' } },
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().message, 'MCP server "context7" already exists');
  await app.close();
});

test.test('POST / rejects missing config', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: { name: 'test', server_type: 'stdio' },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, 'config is required and must be an object');
  await app.close();
});

test.test('POST / rejects non-object config', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: { name: 'test', server_type: 'stdio', config: 'invalid' },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, 'config is required and must be an object');
  await app.close();
});

// ─── GET /:id ───────────────────────────────────────────

test.test('GET /:id returns a single MCP server', async () => {
  const app = await buildApp();
  const created = await app.inject({
    method: 'POST',
    url: '/',
    payload: { name: 'context7', server_type: 'stdio', config: { command: 'npx' } },
  });
  const id = created.json().data.id;

  const response = await app.inject({ method: 'GET', url: `/${id}` });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.name, 'context7');
  await app.close();
});

test.test('GET /:id returns 404 for missing server', async () => {
  const app = await buildApp();
  const response = await app.inject({ method: 'GET', url: '/999' });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().message, 'MCP server not found');
  await app.close();
});

// ─── PUT /:id (update) ─────────────────────────────────

test.test('PUT /:id updates an MCP server', async () => {
  const app = await buildApp();
  const created = await app.inject({
    method: 'POST',
    url: '/',
    payload: { name: 'context7', server_type: 'stdio', config: { command: 'npx' } },
  });
  const id = created.json().data.id;

  const response = await app.inject({
    method: 'PUT',
    url: `/${id}`,
    payload: { description: 'Updated description' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.description, 'Updated description');
  await app.close();
});

test.test('PUT /:id updates config', async () => {
  const app = await buildApp();
  const created = await app.inject({
    method: 'POST',
    url: '/',
    payload: { name: 'context7', server_type: 'stdio', config: { command: 'npx' } },
  });
  const id = created.json().data.id;

  const response = await app.inject({
    method: 'PUT',
    url: `/${id}`,
    payload: { config: { command: 'node', args: ['server.js'] } },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().data.config, { command: 'node', args: ['server.js'] });
  await app.close();
});

test.test('PUT /:id returns 404 for missing server', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'PUT',
    url: '/999',
    payload: { description: 'nope' },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().message, 'MCP server not found');
  await app.close();
});

test.test('PUT /:id rejects invalid server_type', async () => {
  const app = await buildApp();
  const created = await app.inject({
    method: 'POST',
    url: '/',
    payload: { name: 'context7', server_type: 'stdio', config: { command: 'npx' } },
  });
  const id = created.json().data.id;

  const response = await app.inject({
    method: 'PUT',
    url: `/${id}`,
    payload: { server_type: 'invalid' },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, 'server_type must be "stdio" or "http"');
  await app.close();
});

// ─── DELETE /:id ────────────────────────────────────────

test.test('DELETE /:id deletes an MCP server', async () => {
  const app = await buildApp();
  const created = await app.inject({
    method: 'POST',
    url: '/',
    payload: { name: 'context7', server_type: 'stdio', config: { command: 'npx' } },
  });
  const id = created.json().data.id;

  const response = await app.inject({ method: 'DELETE', url: `/${id}` });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().message, 'MCP server deleted');

  // Verify it's gone
  const getResponse = await app.inject({ method: 'GET', url: `/${id}` });
  assert.equal(getResponse.statusCode, 404);
  await app.close();
});

test.test('DELETE /:id returns 404 for missing server', async () => {
  const app = await buildApp();
  const response = await app.inject({ method: 'DELETE', url: '/999' });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().message, 'MCP server not found');
  await app.close();
});
