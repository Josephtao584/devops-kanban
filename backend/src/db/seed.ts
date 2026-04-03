import { readFile } from 'fs/promises';
import { join } from 'path';
import { getDbClient } from './client.js';
import { PROJECT_ROOT } from '../config/index.js';

/**
 * Seed the database with sample data.
 * Should be called after initDatabase().
 * Reads seed.sql and executes all INSERT statements.
 */
export async function seedSampleData(): Promise<void> {
  const client = getDbClient();

  // Read seed.sql file
  const seedPath = join(import.meta.dirname, 'seed.sql');
  let seedSql = await readFile(seedPath, 'utf-8');

  // Replace placeholder with actual project root path
  seedSql = seedSql.replace(/__PROJECT_ROOT__/g, PROJECT_ROOT);

  // Execute all DML statements
  await client.executeMultiple(seedSql);

  console.log('Sample data seeded successfully.');
}