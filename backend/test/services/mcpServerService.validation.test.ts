import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { McpServerService } from '../../src/services/mcpServerService.js';
import { closeDbClient } from '../../src/db/client.js';
import { initDatabase } from '../../src/db/schema.js';

async function withIsolatedStorage(run: () => Promise<void>) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-service-validation-test-'));
  process.env.STORAGE_PATH = tempRoot;
  await closeDbClient();
  await initDatabase();
  try {
    await run();
  } finally {
    await closeDbClient();
    delete process.env.STORAGE_PATH;
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

const longName = 'a'.repeat(201);
const exactName = 'a'.repeat(200);
const longDesc = 'b'.repeat(5001);
const exactDesc = 'b'.repeat(5000);
const longCmd = 'c'.repeat(501);
const exactCmd = 'c'.repeat(500);

// ─── createMcpServer() validation ────────────────────────

test.test('createMcpServer rejects name exceeding 200 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new McpServerService();
    await assert.rejects(
      async () => service.createMcpServer({
        name: longName,
        server_type: 'stdio',
        config: { command: 'npx' },
      }),
      /MCP server name exceeds maximum length of 200 characters/
    );
  });
});

test.test('createMcpServer accepts name at exactly 200 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new McpServerService();
    const server = await service.createMcpServer({
      name: exactName,
      server_type: 'stdio',
      config: { command: 'npx' },
    });
    assert.equal(server.name, exactName);
  });
});

test.test('createMcpServer rejects description exceeding 5000 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new McpServerService();
    await assert.rejects(
      async () => service.createMcpServer({
        name: 'valid',
        description: longDesc,
        server_type: 'stdio',
        config: { command: 'npx' },
      }),
      /MCP server description exceeds maximum length of 5000 characters/
    );
  });
});

test.test('createMcpServer accepts description at exactly 5000 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new McpServerService();
    const server = await service.createMcpServer({
      name: 'valid',
      description: exactDesc,
      server_type: 'stdio',
      config: { command: 'npx' },
    });
    assert.equal(server.description, exactDesc);
  });
});

test.test('createMcpServer rejects install_command exceeding 500 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new McpServerService();
    await assert.rejects(
      async () => service.createMcpServer({
        name: 'valid',
        server_type: 'stdio',
        config: { command: 'npx' },
        install_command: longCmd,
      }),
      /Install command exceeds maximum length of 500 characters/
    );
  });
});

test.test('createMcpServer accepts install_command at exactly 500 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new McpServerService();
    const server = await service.createMcpServer({
      name: 'valid',
      server_type: 'stdio',
      config: { command: 'npx' },
      install_command: exactCmd,
    });
    assert.equal(server.install_command, exactCmd);
  });
});

// ─── updateMcpServer() validation ────────────────────────

test.test('updateMcpServer rejects name exceeding 200 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new McpServerService();
    const server = await service.createMcpServer({
      name: 'original',
      server_type: 'stdio',
      config: { command: 'npx' },
    });
    await assert.rejects(
      async () => service.updateMcpServer(server.id, { name: longName }),
      /MCP server name exceeds maximum length of 200 characters/
    );
  });
});

test.test('updateMcpServer accepts name at exactly 200 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new McpServerService();
    const server = await service.createMcpServer({
      name: 'original',
      server_type: 'stdio',
      config: { command: 'npx' },
    });
    const updated = await service.updateMcpServer(server.id, { name: exactName });
    assert.ok(updated);
    assert.equal(updated!.name, exactName);
  });
});

test.test('updateMcpServer rejects description exceeding 5000 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new McpServerService();
    const server = await service.createMcpServer({
      name: 'original',
      server_type: 'stdio',
      config: { command: 'npx' },
    });
    await assert.rejects(
      async () => service.updateMcpServer(server.id, { description: longDesc }),
      /MCP server description exceeds maximum length of 5000 characters/
    );
  });
});

test.test('updateMcpServer accepts description at exactly 5000 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new McpServerService();
    const server = await service.createMcpServer({
      name: 'original',
      server_type: 'stdio',
      config: { command: 'npx' },
    });
    const updated = await service.updateMcpServer(server.id, { description: exactDesc });
    assert.ok(updated);
    assert.equal(updated!.description, exactDesc);
  });
});

test.test('updateMcpServer rejects install_command exceeding 500 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new McpServerService();
    const server = await service.createMcpServer({
      name: 'original',
      server_type: 'stdio',
      config: { command: 'npx' },
    });
    await assert.rejects(
      async () => service.updateMcpServer(server.id, { install_command: longCmd }),
      /Install command exceeds maximum length of 500 characters/
    );
  });
});
