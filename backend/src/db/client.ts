import { createClient, type Client } from '@libsql/client';
import * as path from 'node:path';
import { STORAGE_PATH } from '../config/index.js';

let dbClient: Client | null = null;

/**
 * Get the database client singleton.
 * Creates a new client if one doesn't exist.
 */
export function getDbClient(): Client {
  if (!dbClient) {
    const dbPath = path.join(STORAGE_PATH as string, 'kanban.db');
    dbClient = createClient({ url: `file:${dbPath}` });
  }
  return dbClient;
}

/**
 * Close the database client and reset the singleton.
 * Should be called during graceful shutdown.
 */
export async function closeDbClient(): Promise<void> {
  if (dbClient) {
    dbClient.close();
    dbClient = null;
  }
}