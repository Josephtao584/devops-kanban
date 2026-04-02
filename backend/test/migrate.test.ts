import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { parseSchemaSql, diffSchemas, migrateSchema, checkSchemaDrift } from '../src/db/migrate.js';
import type { ColumnDef, IndexDef } from '../src/db/migrate.js';
import { createClient, type Client } from '@libsql/client';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

function createTempDb(): { client: Client; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'migrate-test-'));
  const client = createClient({ url: `file:${join(dir, 'test.db')}` });
  return {
    client,
    cleanup: () => {
      try {
        client.close();
      } catch (e) {
        // Ignore close errors
      }
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch (e) {
        // Ignore cleanup errors on Windows
      }
    },
  };
}

test.test('parseSchemaSql extracts table columns', () => {
  const sql = `
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  "order" INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

  const result = parseSchemaSql(sql);
  assert.equal(result.tables.size, 1);

  const cols = result.tables.get('projects')!;
  assert.equal(cols.length, 4); // skip id (PRIMARY KEY AUTOINCREMENT)
  assert.equal(cols[0]!.name, 'name');
  assert.equal(cols[0]!.type, 'TEXT');
  assert.equal(cols[0]!.notNull, true);
  assert.equal(cols[0]!.defaultValue, undefined);
  assert.equal(cols[1]!.name, 'description');
  assert.equal(cols[1]!.notNull, false);
  assert.equal(cols[2]!.name, 'order');
  assert.equal(cols[2]!.type, 'INTEGER');
  assert.equal(cols[3]!.name, 'created_at');
  assert.equal(cols[3]!.defaultValue, "(datetime('now'))");
});

test.test('parseSchemaSql extracts indexes', () => {
  const sql = `
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_unique ON tasks(project_id, status);`;

  const result = parseSchemaSql(sql);
  assert.equal(result.indexes.length, 2);
  assert.equal(result.indexes[0]!.name, 'idx_tasks_project_id');
  assert.equal(result.indexes[0]!.table, 'tasks');
  assert.deepEqual(result.indexes[0]!.columns, ['project_id']);
  assert.equal(result.indexes[0]!.unique, false);
  assert.equal(result.indexes[1]!.unique, true);
  assert.deepEqual(result.indexes[1]!.columns, ['project_id', 'status']);
});

test.test('parseSchemaSql handles multiple tables', () => {
  const sql = `
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  project_id INTEGER NOT NULL
);`;

  const result = parseSchemaSql(sql);
  assert.equal(result.tables.size, 2);
  assert.ok(result.tables.has('projects'));
  assert.ok(result.tables.has('tasks'));
  assert.equal(result.tables.get('projects')!.length, 1);
  assert.equal(result.tables.get('tasks')!.length, 2);
});

test.test('parseSchemaSql skips PRIMARY KEY AUTOINCREMENT column', () => {
  const sql = `
CREATE TABLE IF NOT EXISTS foo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);`;

  const result = parseSchemaSql(sql);
  const cols = result.tables.get('foo')!;
  assert.equal(cols.length, 1);
  assert.equal(cols[0]!.name, 'name');
});

test.test('diffSchemas detects missing columns', () => {
  const expected: Map<string, ColumnDef[]> = new Map([
    ['projects', [
      { name: 'name', type: 'TEXT', notNull: true, defaultValue: undefined },
      { name: 'new_col', type: 'TEXT', notNull: false, defaultValue: "'hello'" },
    ]],
  ]);
  const actual: Map<string, string[]> = new Map([
    ['projects', ['name']],
  ]);
  const existingIndexes: string[] = [];
  const expectedIndexes: IndexDef[] = [];

  const report = diffSchemas(expected, actual, expectedIndexes, existingIndexes);
  assert.equal(report.changes.length, 1);
  assert.ok(report.changes[0]!.includes('ALTER TABLE projects ADD COLUMN new_col'));
  assert.equal(report.errors.length, 0);
});

test.test('diffSchemas detects missing indexes', () => {
  const expected: Map<string, ColumnDef[]> = new Map([
    ['tasks', [{ name: 'id', type: 'INTEGER', notNull: true, defaultValue: undefined }]],
  ]);
  const actual: Map<string, string[]> = new Map([
    ['tasks', ['id']],
  ]);
  const expectedIndexes: IndexDef[] = [
    { name: 'idx_tasks_status', table: 'tasks', columns: ['status'], unique: false, sql: 'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);' },
  ];
  const existingIndexes: string[] = [];

  const report = diffSchemas(expected, actual, expectedIndexes, existingIndexes);
  assert.equal(report.changes.length, 1);
  assert.ok(report.changes[0]!.includes('idx_tasks_status'));
});

test.test('diffSchemas detects destructive column removal', () => {
  const expected: Map<string, ColumnDef[]> = new Map([
    ['projects', [
      { name: 'name', type: 'TEXT', notNull: true, defaultValue: undefined },
    ]],
  ]);
  const actual: Map<string, string[]> = new Map([
    ['projects', ['name', 'old_col']],
  ]);
  const existingIndexes: string[] = [];
  const expectedIndexes: IndexDef[] = [];

  const report = diffSchemas(expected, actual, expectedIndexes, existingIndexes);
  assert.equal(report.errors.length, 1);
  assert.ok(report.errors[0]!.includes('old_col'));
});

test.test('diffSchemas skips NOT NULL column without DEFAULT', () => {
  const expected: Map<string, ColumnDef[]> = new Map([
    ['projects', [
      { name: 'name', type: 'TEXT', notNull: true, defaultValue: undefined },
    ]],
  ]);
  const actual: Map<string, string[]> = new Map([
    ['projects', []],
  ]);
  const existingIndexes: string[] = [];
  const expectedIndexes: IndexDef[] = [];

  const report = diffSchemas(expected, actual, expectedIndexes, existingIndexes);
  assert.equal(report.changes.length, 0);
  assert.equal(report.warnings.length, 1);
  assert.ok(report.warnings[0]!.includes('name'));
});

test.test('diffSchemas auto-fills safe default for TEXT without DEFAULT', () => {
  const expected: Map<string, ColumnDef[]> = new Map([
    ['projects', [
      { name: 'desc', type: 'TEXT', notNull: false, defaultValue: undefined },
    ]],
  ]);
  const actual: Map<string, string[]> = new Map([
    ['projects', []],
  ]);
  const existingIndexes: string[] = [];
  const expectedIndexes: IndexDef[] = [];

  const report = diffSchemas(expected, actual, expectedIndexes, existingIndexes);
  assert.equal(report.changes.length, 1);
  assert.ok(report.changes[0]!.includes("DEFAULT ''"));
});

test.test('diffSchemas auto-fills safe default for INTEGER without DEFAULT', () => {
  const expected: Map<string, ColumnDef[]> = new Map([
    ['projects', [
      { name: 'count', type: 'INTEGER', notNull: false, defaultValue: undefined },
    ]],
  ]);
  const actual: Map<string, string[]> = new Map([
    ['projects', []],
  ]);
  const existingIndexes: string[] = [];
  const expectedIndexes: IndexDef[] = [];

  const report = diffSchemas(expected, actual, expectedIndexes, existingIndexes);
  assert.equal(report.changes.length, 1);
  assert.ok(report.changes[0]!.includes('DEFAULT 0'));
});

test.test('migrateSchema adds missing column to existing table', async () => {
  const { client, cleanup } = createTempDb();
  try {
    await client.execute('CREATE TABLE projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)');

    const schemaSql = `
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT
);`;

    const report = await migrateSchema(client, schemaSql);
    assert.equal(report.applied.length, 1);
    assert.ok(report.applied[0]!.includes('description'));
    assert.equal(report.errors.length, 0);

    const result = await client.execute('PRAGMA table_info(projects)');
    const colNames = result.rows.map(r => r.name as string);
    assert.ok(colNames.includes('description'));
  } finally {
    cleanup();
  }
});

test.test('migrateSchema detects destructive drift', async () => {
  const { client, cleanup } = createTempDb();
  try {
    await client.execute('CREATE TABLE projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, old_col TEXT)');

    const schemaSql = `
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);`;

    const report = await migrateSchema(client, schemaSql);
    assert.equal(report.errors.length, 1);
    assert.ok(report.errors[0]!.includes('old_col'));
  } finally {
    cleanup();
  }
});

test.test('migrateSchema is idempotent', async () => {
  const { client, cleanup } = createTempDb();
  try {
    const schemaSql = `
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);`;

    await client.execute('CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)');

    const report = await migrateSchema(client, schemaSql);
    assert.equal(report.applied.length, 0);
    assert.equal(report.changes.length, 0);
    assert.equal(report.errors.length, 0);
  } finally {
    cleanup();
  }
});

test.test('checkSchemaDrift does not execute changes', async () => {
  const { client, cleanup } = createTempDb();
  try {
    await client.execute('CREATE TABLE projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)');

    const schemaSql = `
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT
);`;

    const report = await checkSchemaDrift(client, schemaSql);
    assert.equal(report.changes.length, 1);
    assert.equal(report.applied.length, 0);

    const result = await client.execute('PRAGMA table_info(projects)');
    const colNames = result.rows.map(r => r.name as string);
    assert.ok(!colNames.includes('description'));
  } finally {
    cleanup();
  }
});
