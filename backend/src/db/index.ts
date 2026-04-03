export { getDbClient, closeDbClient } from './client.js';
export { initDatabase } from './schema.js';
export { seedSampleData } from './seed.js';
export { migrateSchema, checkSchemaDrift } from './migrate.js';

import type { MigrationReport } from './migrate.js';
export type { MigrationReport };
