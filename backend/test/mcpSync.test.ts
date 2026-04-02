import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { ensureMcpJsonInWorktree } from '../src/utils/mcpSync.js';

async function withTempDir(run: (worktreePath: string) => Promise<void>) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-sync-test-'));
  try {
    await run(tempRoot);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

test.test('ensureMcpJsonInWorktree writes .mcp.json with stdio config', async () => {
  await withTempDir(async (worktreePath) => {
    await ensureMcpJsonInWorktree([
      { name: 'context7', server_type: 'stdio', config: { command: 'npx', args: ['-y', '@upstash/context7-mcp'] } },
    ], worktreePath);

    const raw = await fs.readFile(path.join(worktreePath, '.mcp.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    assert.deepEqual(parsed, {
      mcpServers: {
        context7: {
          command: 'npx',
          args: ['-y', '@upstash/context7-mcp'],
        },
      },
    });
  });
});

test.test('ensureMcpJsonInWorktree writes .mcp.json with http config', async () => {
  await withTempDir(async (worktreePath) => {
    await ensureMcpJsonInWorktree([
      { name: 'github', server_type: 'http', config: { url: 'https://api.github.com/mcp', headers: { Authorization: 'Bearer token' } } },
    ], worktreePath);

    const raw = await fs.readFile(path.join(worktreePath, '.mcp.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    assert.deepEqual(parsed, {
      mcpServers: {
        github: {
          type: 'http',
          url: 'https://api.github.com/mcp',
          headers: { Authorization: 'Bearer token' },
        },
      },
    });
  });
});

test.test('ensureMcpJsonInWorktree writes multiple servers', async () => {
  await withTempDir(async (worktreePath) => {
    await ensureMcpJsonInWorktree([
      { name: 'context7', server_type: 'stdio', config: { command: 'npx' } },
      { name: 'github', server_type: 'http', config: { url: 'https://api.github.com/mcp' } },
    ], worktreePath);

    const raw = await fs.readFile(path.join(worktreePath, '.mcp.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    assert.ok(parsed.mcpServers.context7);
    assert.ok(parsed.mcpServers.github);
    assert.equal(Object.keys(parsed.mcpServers).length, 2);
  });
});

test.test('ensureMcpJsonInWorktree cleans up .mcp.json when empty servers', async () => {
  await withTempDir(async (worktreePath) => {
    // First write a file
    await fs.writeFile(path.join(worktreePath, '.mcp.json'), '{"mcpServers":{}}', 'utf-8');

    // Then call with empty array
    await ensureMcpJsonInWorktree([], worktreePath);

    await assert.rejects(
      fs.access(path.join(worktreePath, '.mcp.json')),
      /ENOENT/
    );
  });
});

test.test('ensureMcpJsonInWorktree includes env for stdio', async () => {
  await withTempDir(async (worktreePath) => {
    await ensureMcpJsonInWorktree([
      { name: 'my-server', server_type: 'stdio', config: { command: 'node', args: ['server.js'], env: { API_KEY: 'secret' } } },
    ], worktreePath);

    const raw = await fs.readFile(path.join(worktreePath, '.mcp.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    assert.equal(parsed.mcpServers['my-server'].env.API_KEY, 'secret');
  });
});

test.test('ensureMcpJsonInWorktree is no-op when servers empty and no file exists', async () => {
  await withTempDir(async (worktreePath) => {
    await ensureMcpJsonInWorktree([], worktreePath);

    await assert.rejects(
      fs.access(path.join(worktreePath, '.mcp.json')),
      /ENOENT/
    );
  });
});
