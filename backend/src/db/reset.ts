import { getDbClient } from './client.js';
import { initDatabase } from './schema.js';
import { seedSampleData } from './seed.js';

interface ResetOptions {
  cleanOnly?: boolean;   // 仅清空数据
  seedOnly?: boolean;    // 仅插入seed数据
  dryRun?: boolean;      // 干跑模式
}

// 表清空顺序（按外键依赖逆序）
const TABLES_IN_ORDER = [
  'session_events',
  'session_segments',
  'sessions',
  'executions',
  'workflow_runs',
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
      console.log('  - Truncate all tables');
      console.log('  - Reset AUTOINCREMENT counters');
    }
    if (!cleanOnly) {
      console.log('  - Insert seed data');
    }
    return;
  }

  // Step 1: 确保表结构存在（必须在清空数据之前）
  await initDatabase();

  // Step 2: 清空数据（除非 --seed-only）
  if (!seedOnly) {
    console.log('Cleaning database...');

    // 使用事务批量删除
    const deleteStatements = TABLES_IN_ORDER.map(
      table => `DELETE FROM ${table}`
    );

    // 添加重置自增 ID 的语句
    const resetStatements = TABLES_IN_ORDER.map(
      table => `DELETE FROM sqlite_sequence WHERE name = '${table}'`
    );

    await client.batch([
      ...deleteStatements.map(sql => ({ sql })),
      ...resetStatements.map(sql => ({ sql })),
    ], 'write');

    console.log('Database cleaned.');
  }

  // Step 3: 插入 seed 数据（除非 --clean-only）
  if (!cleanOnly) {
    console.log('Seeding sample data...');
    await seedSampleData();
    console.log('Sample data inserted.');
  }

  console.log('Database reset completed.');
}

/**
 * Truncate all tables without seeding.
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