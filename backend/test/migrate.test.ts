import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { parseSchemaSql } from '../src/db/migrate.js';

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
  assert.equal(cols[0].name, 'name');
  assert.equal(cols[0].type, 'TEXT');
  assert.equal(cols[0].notNull, true);
  assert.equal(cols[0].defaultValue, undefined);
  assert.equal(cols[1].name, 'description');
  assert.equal(cols[1].notNull, false);
  assert.equal(cols[2].name, 'order');
  assert.equal(cols[2].type, 'INTEGER');
  assert.equal(cols[3].name, 'created_at');
  assert.equal(cols[3].defaultValue, "(datetime('now'))");
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
  assert.equal(result.indexes[0].name, 'idx_tasks_project_id');
  assert.equal(result.indexes[0].table, 'tasks');
  assert.deepEqual(result.indexes[0].columns, ['project_id']);
  assert.equal(result.indexes[0].unique, false);
  assert.equal(result.indexes[1].unique, true);
  assert.deepEqual(result.indexes[1].columns, ['project_id', 'status']);
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
  assert.equal(cols[0].name, 'name');
});
