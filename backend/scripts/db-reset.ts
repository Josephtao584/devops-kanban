import 'dotenv/config';
import { resetDatabase } from '../src/db/reset.js';

async function main() {
  const args = process.argv.slice(2);

  const options = {
    cleanOnly: args.includes('--clean-only'),
    seedOnly: args.includes('--seed-only'),
    dryRun: args.includes('--dry-run'),
  };

  // 互斥检查
  if (options.cleanOnly && options.seedOnly) {
    console.error('Error: --clean-only and --seed-only cannot be used together');
    process.exit(1);
  }

  // 帮助信息
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npm run db:reset [options]

Options:
  --clean-only   Only clean data, don't seed
  --seed-only    Only seed data, don't clean
  --dry-run      Show what would be done without executing
  --help, -h     Show this help message

Examples:
  npm run db:reset              # Full reset: clean + seed
  npm run db:reset -- --clean-only  # Only clean data
  npm run db:reset -- --seed-only   # Only seed data
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