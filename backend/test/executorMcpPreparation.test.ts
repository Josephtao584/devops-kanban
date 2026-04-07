import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { prepareExecutionMcp } from '../src/services/workflow/executorMcpPreparation.js';
import { ExecutorType } from '../src/types/executors.js';

async function withTempDir(run: (worktreePath: string) => Promise<void>) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'executor-mcp-prep-test-'));
  try {
    await run(tempRoot);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

test.test('prepareExecutionMcp writes .mcp.json for worktree for CLAUDE_CODE', async () => {
  await withTempDir(async (worktreePath) => {
    await prepareExecutionMcp({
      executorType: ExecutorType.CLAUDE_CODE,
      mcpServerConfigs: [
        { name: 'context7', server_type: 'stdio', config: { command: 'npx', args: ['-y', '@upstash/context7-mcp'] } },
        { name: 'github', server_type: 'http', config: { url: 'https://api.github.com/mcp', headers: { Authorization: 'Bearer token' } } },
      ],
      executionPath: worktreePath,
    });

    const raw = await fs.readFile(path.join(worktreePath, '.mcp.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    assert.equal(Object.keys(parsed.mcpServers).length, 2);
    assert.ok(parsed.mcpServers.context7);
    assert.ok(parsed.mcpServers.github);
  });
});

test.test('prepareExecutionMcp is no-op when no servers configured', async () => {
  await withTempDir(async (worktreePath) => {
    await prepareExecutionMcp({
      executorType: ExecutorType.CLAUDE_CODE,
      mcpServerConfigs: [],
      executionPath: worktreePath,
    });

    await assert.rejects(
      fs.access(path.join(worktreePath, '.mcp.json')),
      /ENOENT/
    );
  });
});
