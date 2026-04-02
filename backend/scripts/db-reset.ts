import 'dotenv/config';
import { getDbClient } from '../src/db/client.js';
import { initDatabase } from '../src/db/schema.js';
import { seedSampleData } from '../src/db/seed.js';

interface ResetOptions {
  cleanOnly?: boolean;   // Only clean data
  seedOnly?: boolean;    // Only seed data
  dryRun?: boolean;      // Dry run mode
}

// Table cleanup order (reverse of foreign key dependencies)
const TABLES_IN_ORDER = [
  'session_events',
  'session_segments',
  'sessions',
  'executions',
  'workflow_runs',
  'workflow_instances',
  'tasks',
  'task_sources',
  'iterations',
  'workflow_templates',
  'agents',
  'skills',
  'projects',
];

/**
 * Reset the database with optional clean and seed operations.
 *
 * @param options - Reset options
 *   - cleanOnly: Only clean data, don't seed
 *   - seedOnly: Only seed data, don't clean
 *   - dryRun: Show what would be done without executing
 */
export async function resetDatabase(options: ResetOptions = {}): Promise<void> {
  const client = getDbClient();
  const { cleanOnly, seedOnly, dryRun } = options;

  if (dryRun) {
    console.log('[DRY RUN] Database reset operations:');
    if (!seedOnly) {
      console.log('  - Drop all tables');
      console.log('  - Recreate tables with fresh schema');
    }
    if (!cleanOnly) {
      console.log('  - Insert seed data');
    }
    return;
  }

  // Disable foreign key checks during reset
  await client.execute('PRAGMA foreign_keys = OFF');

  // Step 1: Drop all existing tables (ensures fresh schema)
  if (!seedOnly) {
    console.log('Dropping all tables...');
    const dropStatements = TABLES_IN_ORDER.map(
      table => `DROP TABLE IF EXISTS ${table}`
    );
    await client.batch(dropStatements.map(sql => ({ sql })), 'write');
    console.log('Tables dropped.');
  }

  // Step 2: Recreate tables with fresh schema
  console.log('Creating tables...');
  await initDatabase();
  console.log('Tables created.');

  // Step 3: Insert seed data (unless --clean-only)
  if (!cleanOnly) {
    console.log('Seeding sample data...');
    await seedSampleData();
    console.log('Sample data inserted.');
  }

  // Re-enable foreign key checks
  await client.execute('PRAGMA foreign_keys = ON');

  console.log('Database reset completed.');
}

/**
 * Truncate all tables without seeding.
 * Drops and recreates all tables.
 */
export async function truncateDatabase(): Promise<void> {
  await resetDatabase({ cleanOnly: true });
}

/**
 * Seed the database with sample data.
 * Creates tables if they don't exist.
 */
export async function seedDatabase(): Promise<void> {
  await initDatabase();
  await seedSampleData();
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2);

  const options = {
    cleanOnly: args.includes('--clean-only'),
    seedOnly: args.includes('--seed-only'),
    dryRun: args.includes('--dry-run'),
  };

  // Check for conflicting options
  if (options.cleanOnly && options.seedOnly) {
    console.error('Error: --clean-only and --seed-only cannot be used together');
    process.exit(1);
  }

  // Help information
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npm run db:reset [options]

Options:
  --clean-only   Drop and recreate tables without seeding
  --seed-only    Only seed data, don't drop tables
  --dry-run      Show what would be done without executing
  --help, -h     Show this help message

Examples:
  npm run db:reset              # Full reset: drop tables + recreate + seed
  npm run db:reset -- --clean-only  # Drop tables and recreate (no seed data)
  npm run db:reset -- --seed-only   # Only seed data (keep existing tables)
  npm run db:reset -- --dry-run     # Preview operations
`);
    process.exit(0);
  }

  try {
    await resetDatabase(options);
  } catch (error) {
    console.error('Database reset failed:', error);
    process.exit(1);
  }
}

main();