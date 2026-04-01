import { getDbClient } from '../db/client.js';
import type { Client, InValue } from '@libsql/client';

/**
 * Base entity interface that all entities must extend.
 */
interface BaseEntity {
  id: number;
  created_at: string;
  updated_at: string;
}

/**
 * Base repository class that provides CRUD operations over database tables.
 * Replaces the previous JSON file-based implementation with LibSQL database.
 */
class BaseRepository<T extends BaseEntity> {
  tableName: string;
  protected client: Client;

  constructor(tableName: string) {
    this.tableName = tableName;
    this.client = getDbClient();
  }

  /**
   * Parse a database row into an entity.
   * Override this method in subclasses to handle JSON fields.
   */
  protected parseRow(row: Record<string, unknown>): T {
    return row as T;
  }

  /**
   * Serialize an entity for database insertion/update.
   * Override this method in subclasses to handle JSON fields.
   */
  protected serializeRow(entity: Partial<T>): Record<string, unknown> {
    return { ...entity } as Record<string, unknown>;
  }

  /**
   * Get the column names for this table (excluding auto-managed fields).
   * Override in subclasses if needed.
   */
  protected getColumnNames(): string[] {
    return [];
  }

  /**
   * Retrieve all records from the table.
   */
  async findAll(): Promise<T[]> {
    const result = await this.client.execute(`SELECT * FROM "${this.tableName}"`);
    return result.rows.map(row => this.parseRow(row as Record<string, unknown>));
  }

  /**
   * Find a record by its ID.
   */
  async findById(entityId: number): Promise<T | null> {
    const result = await this.client.execute({
      sql: `SELECT * FROM "${this.tableName}" WHERE "id" = ?`,
      args: [entityId],
    });
    if (result.rows.length === 0) return null;
    return this.parseRow(result.rows[0] as Record<string, unknown>);
  }

  /**
   * Create a new record.
   */
  async create(entityData: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T> {
    const now = new Date().toISOString();
    const data = this.serializeRow(entityData as Partial<T>);

    // Filter out undefined values
    const definedEntries = Object.entries(data).filter(
      ([, value]) => value !== undefined
    );
    const columns = definedEntries.map(([key]) => `"${key}"`);
    const values = definedEntries.map(([, value]) => value);
    const placeholders = columns.map(() => '?').join(', ');

    const sql = `INSERT INTO ${this.tableName} (${columns.join(', ')}, "created_at", "updated_at") VALUES (${placeholders}, ?, ?)`;
    const result = await this.client.execute({
      sql,
      args: [...values as InValue[], now, now],
    });

    // Fetch the created record to get all fields with correct defaults
    const created = await this.findById(Number(result.lastInsertRowid));
    if (!created) {
      throw new Error(`Failed to fetch created record with id ${result.lastInsertRowid}`);
    }
    return created;
  }

  /**
   * Update an existing record.
   */
  async update(entityId: number, entityData: Partial<Omit<T, keyof BaseEntity>>): Promise<T | null> {
    const existing = await this.findById(entityId);
    if (!existing) return null;

    const now = new Date().toISOString();
    const data = this.serializeRow(entityData as Partial<T>);

    // Filter out id, undefined values, and auto-managed fields
    const definedEntries = Object.entries(data).filter(
      ([key, value]) => key !== 'id' && key !== 'created_at' && key !== 'updated_at' && value !== undefined
    );

    if (definedEntries.length === 0) return existing;

    const setClauses = definedEntries.map(([key]) => `"${key}" = ?`);
    const values = definedEntries.map(([, value]) => value);

    const sql = `UPDATE ${this.tableName} SET ${setClauses.join(', ')}, "updated_at" = ? WHERE "id" = ?`;
    await this.client.execute({
      sql,
      args: [...values as InValue[], now, entityId],
    });

    // Re-fetch to get properly parsed row (e.g. JSON fields parsed correctly)
    return await this.findById(entityId);
  }

  /**
   * Delete a record by its ID.
   */
  async delete(entityId: number): Promise<boolean> {
    const result = await this.client.execute({
      sql: `DELETE FROM "${this.tableName}" WHERE "id" = ?`,
      args: [entityId],
    });
    return result.rowsAffected > 0;
  }

  /**
   * Count all records in the table.
   */
  async count(): Promise<number> {
    const result = await this.client.execute(`SELECT COUNT(*) as count FROM "${this.tableName}"`);
    return Number(result.rows[0]?.count ?? 0);
  }
}

export { BaseRepository };
export type { BaseEntity };