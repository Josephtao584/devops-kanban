import { readFile } from 'fs/promises';
import { join } from 'path';
import { getDbClient } from './client.js';

/**
 * Seed the database with sample data.
 * Should be called after initDatabase().
 * Reads seed.sql and executes all INSERT statements.
 */
export async function seedSampleData(): Promise<void> {
  const client = getDbClient();

  // Read seed.sql file
  const seedPath = join(import.meta.dirname, 'seed.sql');
  const seedSql = await readFile(seedPath, 'utf-8');

  // Execute all DML statements
  await client.executeMultiple(seedSql);

  console.log('Sample data seeded successfully.');
}