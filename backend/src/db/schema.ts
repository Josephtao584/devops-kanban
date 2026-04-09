import { readFile } from 'fs/promises';
import { join } from 'path';
import { getDbClient } from './client.js';
import { migrateSchema } from './migrate.js';

/**
 * Extract CREATE TABLE statements from schema SQL.
 * Returns them as a single executable SQL string.
 */
function extractCreateTableSql(sql: string): string {
  const matches = sql.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+[\s\S]*?\);/gi);
  return matches ? matches.join('\n\n') : '';
}

/**
 * Extract CREATE INDEX statements from schema SQL.
 * Returns them as a single executable SQL string.
 */
function extractCreateIndexSql(sql: string): string {
  const matches = sql.match(/CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?\w+\s+ON\s+\w+\([^)]+\);/gi);
  return matches ? matches.join('\n\n') : '';
}

/**
 * Initialize all database tables.
 * Creates tables if they don't exist, then auto-migrates schema drift
 * (new columns, dropped columns), then creates indexes.
 * Throws only on type changes or other truly destructive drift.
 */
export async function initDatabase(): Promise<void> {
  const client = getDbClient();
  await client.execute('PRAGMA journal_mode = WAL');
  await client.execute('PRAGMA busy_timeout = 30000');
  await client.execute('PRAGMA synchronous = NORMAL');

  const schemaPath = join(import.meta.dirname, 'schema.sql');
  const schemaSql = await readFile(schemaPath, 'utf-8');

  // 1. Create missing tables only (no indexes)
  const tableSql = extractCreateTableSql(schemaSql);
  if (tableSql) {
    await client.executeMultiple(tableSql);
  }

  // 2. Auto-migrate: add missing columns, drop old columns
  const report = await migrateSchema(client, schemaSql);
  if (report.errors.length > 0) {
    throw new Error(
      `[DB Migration] Destructive schema drift detected. Run 'npm run db:reset'.\n${report.errors.join('\n')}`,
    );
  }

  // 3. Create indexes (after columns are migrated)
  const indexSql = extractCreateIndexSql(schemaSql);
  if (indexSql) {
    await client.executeMultiple(indexSql);
  }
}
