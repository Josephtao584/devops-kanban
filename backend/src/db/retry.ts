import { logger } from '../utils/logger.js';

/**
 * Retry a database operation on SQLITE_BUSY errors.
 * Uses exponential backoff: 200ms, 400ms, 800ms, 1.6s, 3.2s
 */
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 200;

function isBusyError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message || '';
    return msg.includes('SQLITE_BUSY') || msg.includes('database is locked');
  }
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withRetry<T>(operation: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (isBusyError(error) && attempt < retries) {
        const waitMs = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[DB] SQLITE_BUSY on attempt ${attempt + 1}/${retries + 1}, retrying in ${waitMs}ms...`);
        logger.warn('DB', `SQLITE_BUSY on attempt ${attempt + 1}/${retries + 1}, retrying in ${waitMs}ms`);
        await delay(waitMs);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}
