import { readFile } from 'fs/promises';
import { join } from 'path';
import type { Client } from '@libsql/client';

// --- Types ---

export interface ColumnDef {
  name: string;
  type: string;
  notNull: boolean;
  defaultValue: string | undefined;
}

export interface IndexDef {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
  sql: string;
}

export interface ParsedSchema {
  tables: Map<string, ColumnDef[]>;
  indexes: IndexDef[];
}

export interface MigrationReport {
  changes: string[];
  warnings: string[];
  errors: string[];
  applied: string[];
}

// --- SQL Parsing ---

export function parseSchemaSql(sql: string): ParsedSchema {
  const tables = new Map<string, ColumnDef[]>();
  const indexes: IndexDef[] = [];

  // Extract CREATE TABLE blocks
  const tableRegex = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)\s*\(([\s\S]*?)\)\s*;/gis;
  let match: RegExpExecArray | null;

  while ((match = tableRegex.exec(sql)) !== null) {
    const tableName = match[1];
    const body = match[2];
    const columns = parseColumnDefs(body);
    tables.set(tableName, columns);
  }

  // Extract CREATE INDEX statements
  const indexRegex = /CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+ON\s+(\w+)\(([^)]+)\);/gis;
  while ((match = indexRegex.exec(sql)) !== null) {
    indexes.push({
      unique: match[1] !== undefined && match[1] !== null,
      name: match[2],
      table: match[3],
      columns: match[4].split(',').map(c => c.trim()),
      sql: match[0],
    });
  }

  return { tables, indexes };
}

function parseColumnDefs(body: string): ColumnDef[] {
  const columns: ColumnDef[] = [];
  const lines = body.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  for (const line of lines) {
    // Skip PRIMARY KEY AUTOINCREMENT lines
    if (/PRIMARY\s+KEY\s+AUTOINCREMENT/i.test(line)) {
      continue;
    }
    // Skip standalone constraints (FOREIGN KEY, CHECK, UNIQUE, etc.)
    if (/^(FOREIGN\s+KEY|CHECK|UNIQUE|CONSTRAINT|PRIMARY\s+KEY)\s/i.test(line)) {
      continue;
    }

    const col = parseColumnLine(line);
    if (col) {
      columns.push(col);
    }
  }

  return columns;
}

function parseColumnLine(line: string): ColumnDef | null {
  // Remove trailing comma
  const cleaned = line.replace(/,\s*$/, '');

  // Match: column_name TYPE [NOT NULL] [DEFAULT ...] [UNIQUE] [...]
  // Handle quoted identifiers like "order"
  const colMatch = cleaned.match(/^("?\w+"?)\s+([A-Z]+(?:\(\s*\d+\s*(?:,\s*\d+\s*)?\))?)\s*(.*)/i);
  if (!colMatch) {
    return null;
  }

  const name = colMatch[1].replace(/"/g, '');
  const type = colMatch[2].toUpperCase();
  const rest = colMatch[3];

  const notNull = /\bNOT\s+NULL\b/i.test(rest);

  let defaultValue: string | undefined;
  const defaultMatch = rest.match(/DEFAULT\s+((?:\([^()]*\)|\((?:[^()]*|\([^()]*\))*\)|'[^']*'|\S+))/i);
  if (defaultMatch) {
    defaultValue = defaultMatch[1];
  }

  return { name, type, notNull, defaultValue };
}

// --- Diff Engine ---

function safeDefaultValue(col: ColumnDef): string | null {
  if (col.defaultValue !== undefined) {
    return `DEFAULT ${col.defaultValue}`;
  }
  if (col.notNull) {
    return null; // Cannot safely add NOT NULL column without DEFAULT
  }
  if (col.type === 'TEXT') {
    return "DEFAULT ''";
  }
  if (col.type === 'INTEGER') {
    return 'DEFAULT 0';
  }
  return "DEFAULT ''";
}

export function diffSchemas(
  expectedTables: Map<string, ColumnDef[]>,
  actualTables: Map<string, string[]>,
  expectedIndexes: IndexDef[],
  existingIndexNames: string[],
): MigrationReport {
  const changes: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  for (const [table, expectedCols] of expectedTables) {
    const actualColNames = actualTables.get(table);

    // Table doesn't exist yet — CREATE TABLE IF NOT EXISTS handles this
    if (!actualColNames) {
      continue;
    }

    // Detect missing columns
    const actualSet = new Set(actualColNames);
    for (const col of expectedCols) {
      if (!actualSet.has(col.name)) {
        const defaultExpr = safeDefaultValue(col);
        if (defaultExpr === null) {
          warnings.push(
            `Column '${table}.${col.name}' defined as NOT NULL without DEFAULT, skipped`,
          );
          continue;
        }
        const notNullSql = col.notNull ? ' NOT NULL' : '';
        changes.push(
          `ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.type}${notNullSql} ${defaultExpr}`,
        );
      }
    }

    // Detect extra columns in DB (destructive)
    const expectedSet = new Set(expectedCols.map(c => c.name));
    for (const colName of actualColNames) {
      if (!expectedSet.has(colName)) {
        errors.push(
          `Column '${table}.${colName}' exists in DB but not in schema.sql`,
        );
      }
    }
  }

  // Detect missing indexes
  const existingSet = new Set(existingIndexNames);
  for (const idx of expectedIndexes) {
    if (!existingSet.has(idx.name)) {
      const unique = idx.unique ? 'UNIQUE ' : '';
      changes.push(
        `CREATE ${unique}INDEX IF NOT EXISTS ${idx.name} ON ${idx.table}(${idx.columns.join(', ')})`,
      );
    }
  }

  return { changes, warnings, errors, applied: [] };
}

// --- Schema Introspection ---

async function getExistingTables(client: Client): Promise<string[]> {
  const result = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  );
  return result.rows.map(r => r.name as string);
}

async function isPrimaryKeyAutoincrement(client: Client, table: string, column: string): Promise<boolean> {
  const result = await client.execute(`PRAGMA table_info(${table})`);
  const colInfo = result.rows.find(r => r.name === column);
  if (!colInfo) return false;

  // Check if it's the primary key
  if (colInfo.pk !== 1) return false;

  // Check the CREATE TABLE SQL to see if it's AUTOINCREMENT
  const tableSqlResult = await client.execute(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${table}'`);
  if (!tableSqlResult.rows.length) return false;

  const createSql = tableSqlResult.rows[0].sql as string;
  const idPattern = new RegExp(`\\b${column}\\s+INTEGER\\s+PRIMARY\\s+KEY\\s+AUTOINCREMENT`, 'i');
  return idPattern.test(createSql);
}

async function getExistingColumns(client: Client, table: string): Promise<string[]> {
  const result = await client.execute(`PRAGMA table_info(${table})`);
  const columns: string[] = [];

  for (const row of result.rows) {
    const colName = row.name as string;
    // Skip PRIMARY KEY AUTOINCREMENT columns (they're handled by CREATE TABLE IF NOT EXISTS)
    const isPkAutoincrement = await isPrimaryKeyAutoincrement(client, table, colName);
    if (!isPkAutoincrement) {
      columns.push(colName);
    }
  }

  return columns;
}

async function getExistingIndexNames(client: Client, table: string): Promise<string[]> {
  const result = await client.execute(`PRAGMA index_list(${table})`);
  return result.rows.map(r => r.name as string);
}

// --- Core Migration Functions ---

async function buildDiffReport(client: Client, schemaSql: string): Promise<MigrationReport> {
  const parsed = parseSchemaSql(schemaSql);

  const actualTables = new Map<string, string[]>();
  const tableNames = await getExistingTables(client);

  const allIndexNames: string[] = [];
  for (const t of tableNames) {
    const cols = await getExistingColumns(client, t);
    actualTables.set(t, cols);
    const idxNames = await getExistingIndexNames(client, t);
    allIndexNames.push(...idxNames);
  }

  return diffSchemas(parsed.tables, actualTables, parsed.indexes, allIndexNames);
}

export async function migrateSchema(client: Client, schemaSql?: string): Promise<MigrationReport> {
  if (!schemaSql) {
    const schemaPath = join(import.meta.dirname, 'schema.sql');
    schemaSql = await readFile(schemaPath, 'utf-8');
  }

  const report = await buildDiffReport(client, schemaSql);

  // Check destructive changes first — do not execute anything
  if (report.errors.length > 0) {
    logReport(report);
    return report;
  }

  // Execute safe migrations
  for (const sql of report.changes) {
    await client.execute(sql);
    report.applied.push(sql);
  }

  logReport(report);
  return report;
}

export async function checkSchemaDrift(client: Client, schemaSql?: string): Promise<MigrationReport> {
  if (!schemaSql) {
    const schemaPath = join(import.meta.dirname, 'schema.sql');
    schemaSql = await readFile(schemaPath, 'utf-8');
  }

  const report = await buildDiffReport(client, schemaSql);
  logReport(report);
  return report;
}

function logReport(report: MigrationReport): void {
  if (report.applied.length > 0) {
    console.log(`[DB Migration] Applied ${report.applied.length} change(s):`);
    for (const sql of report.applied) {
      console.log(`  ${sql}`);
    }
  }

  if (report.warnings.length > 0) {
    console.warn(`[DB Migration] ${report.warnings.length} warning(s):`);
    for (const w of report.warnings) {
      console.warn(`  ${w}`);
    }
  }

  if (report.errors.length > 0) {
    console.error(`[DB Migration] ERROR: ${report.errors.length} destructive change(s) detected, cannot start:`);
    for (const e of report.errors) {
      console.error(`  ${e}`);
    }
    console.error("  Run 'npm run db:reset' to reset the database.");
  }
}
