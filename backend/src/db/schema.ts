import { readFile } from 'fs/promises';
import { join } from 'path';
import { getDbClient } from './client.js';

/**
 * Initialize all database tables.
 * Creates tables if they don't exist by reading schema.sql.
 */
export async function initDatabase(): Promise<void> {
  const client = getDbClient();

  // Read schema.sql file
  const schemaPath = join(import.meta.dirname, 'schema.sql');
  const schemaSql = await readFile(schemaPath, 'utf-8');

  // Execute all DDL statements
  await client.executeMultiple(schemaSql);

  const workflowTemplateColumns = await client.execute('PRAGMA table_info(workflow_templates)');
  const hasOrderColumn = workflowTemplateColumns.rows.some((row) => row.name === 'order');
  if (!hasOrderColumn) {
    await client.execute('ALTER TABLE workflow_templates ADD COLUMN "order" INTEGER');
  }
}