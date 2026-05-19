import { logger } from './logger.js';

/**
 * Parse a JSON string with a fallback. Used for repository row decoding so a
 * single corrupt row in the database doesn't crash every query that touches
 * that table. Failures are logged so corruption is visible operationally.
 */
export function safeJsonParse<T>(raw: unknown, fallback: T, context: string): T {
  if (raw == null) return fallback;
  try {
    return JSON.parse(String(raw)) as T;
  } catch (error) {
    logger.error(
      'safeJsonParse',
      `Failed to parse JSON (${context}): ${error instanceof Error ? error.message : String(error)}`,
    );
    return fallback;
  }
}
