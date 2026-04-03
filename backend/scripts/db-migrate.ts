import 'dotenv/config';
import { getDbClient } from '../src/db/client.js';
import { initDatabase } from '../src/db/schema.js';
import { migrateSchema, checkSchemaDrift } from '../src/db/migrate.js';

async function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npm run db:migrate [options]

Options:
  --check   Show schema drift without applying changes
  --help    Show this help message

Examples:
  npm run db:migrate            # Execute migration
  npm run db:migrate:check      # Check drift only
`);
    process.exit(0);
  }

  // Ensure tables exist first
  await initDatabase();

  const client = getDbClient();

  if (checkOnly) {
    const report = await checkSchemaDrift(client);
    if (report.changes.length === 0 && report.errors.length === 0 && report.warnings.length === 0) {
      console.log('[DB Migration] Schema is up to date, no drift detected.');
    }
    if (report.errors.length > 0) {
      process.exit(1);
    }
  } else {
    const report = await migrateSchema(client);
    if (report.applied.length === 0 && report.errors.length === 0) {
      console.log('[DB Migration] Schema is up to date, no migration needed.');
    }
    if (report.errors.length > 0) {
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error('[DB Migration] Fatal:', err);
  process.exit(1);
});
