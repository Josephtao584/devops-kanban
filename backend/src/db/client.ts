import { createClient, type Client } from '@libsql/client';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(FILE_DIR, '..', '..');
const PROJECT_ROOT = path.resolve(BACKEND_ROOT, '..');

function resolveStoragePath(): string {
  return process.env.STORAGE_PATH
    ? path.resolve(process.env.STORAGE_PATH)
    : path.join(PROJECT_ROOT, 'data');
}

let dbClient: Client | null = null;

/**
 * Get the database client singleton.
 * Creates a new client if one doesn't exist.
 * Resolves STORAGE_PATH from process.env at creation time (not import time),
 * so tests can override it with withIsolatedStorage + closeDbClient().
 */
export function getDbClient(): Client {
  if (!dbClient) {
    const dbPath = path.join(resolveStoragePath(), 'kanban.db');
    dbClient = createClient({ url: `file:${dbPath}` });
  }
  return dbClient;
}

/**
 * Close the database client and reset the singleton.
 * Should be called during graceful shutdown or test isolation.
 */
export async function closeDbClient(): Promise<void> {
  if (dbClient) {
    dbClient.close();
    dbClient = null;
  }
}