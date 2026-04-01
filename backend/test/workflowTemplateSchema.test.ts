import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

test.test('schema initialization adds order column to existing workflow_templates tables', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'workflow-template-schema-'));
  const dbPath = join(tempDir, 'kanban.db');
  const client = createClient({ url: `file:${dbPath}` });

  try {
    await client.execute(`
      CREATE TABLE workflow_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        steps TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    client.close();

    await execFileAsync(
      'node',
      [
        '--import',
        'tsx',
        '--eval',
        "import('./src/db/schema.ts').then(async ({ initDatabase }) => { await initDatabase(); }).catch((error) => { console.error(error); process.exit(1); })",
      ],
      {
        cwd: join(import.meta.dirname, '..'),
        env: {
          ...process.env,
          STORAGE_PATH: tempDir,
        },
      },
    );

    const verifyClient = createClient({ url: `file:${dbPath}` });
    const result = await verifyClient.execute('PRAGMA table_info(workflow_templates)');
    const columnNames = result.rows.map((row) => String(row.name));
    verifyClient.close();

    assert.ok(
      columnNames.includes('order'),
      `Expected workflow_templates columns to include order, got: ${columnNames.join(', ')}`,
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
