import { getDbClient } from '../db/client.js';
import type { Client } from '@libsql/client';
import type { SettingEntity } from '../types/entities.ts';

class SettingsRepository {
  private client: Client;

  constructor(deps?: { client?: Client }) {
    this.client = deps?.client || getDbClient();
  }

  async get(key: string): Promise<SettingEntity | null> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM settings WHERE key = ?',
      args: [key],
    });
    if (result.rows.length === 0) return null;
    return result.rows[0] as unknown as SettingEntity;
  }

  async set(key: string, value: string): Promise<void> {
    const now = new Date().toISOString();
    await this.client.execute({
      sql: `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      args: [key, value, now],
    });
  }

  async getAll(): Promise<SettingEntity[]> {
    const result = await this.client.execute('SELECT * FROM settings');
    return result.rows as unknown as SettingEntity[];
  }

  async setMany(items: Array<{ key: string; value: string }>): Promise<void> {
    for (const item of items) {
      await this.set(item.key, item.value);
    }
  }
}

export { SettingsRepository };
