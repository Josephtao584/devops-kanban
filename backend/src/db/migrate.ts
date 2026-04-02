import { readFile } from 'fs/promises';
import { join } from 'path';
import type { Client } from '@libsql/client';

// --- Types ---

export interface ColumnDef {
  name: string;
  type: string;
  notNull: boolean;
  defaultValue: string | undefined;
}

export interface IndexDef {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
  sql: string;
}

export interface ParsedSchema {
  tables: Map<string, ColumnDef[]>;
  indexes: IndexDef[];
}

export interface MigrationReport {
  changes: string[];
  warnings: string[];
  errors: string[];
  applied: string[];
}

// --- SQL Parsing ---

export function parseSchemaSql(sql: string): ParsedSchema {
  const tables = new Map<string, ColumnDef[]>();
  const indexes: IndexDef[] = [];

  // Extract CREATE TABLE blocks
  const tableRegex = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)\s*\(([^;]+)\);/gis;
  let match: RegExpExecArray | null;

  while ((match = tableRegex.exec(sql)) !== null) {
    const tableName = match[1];
    const body = match[2];
    const columns = parseColumnDefs(body);
    tables.set(tableName, columns);
  }

  // Extract CREATE INDEX statements
  const indexRegex = /CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+ON\s+(\w+)\(([^)]+)\);/gis;
  while ((match = indexRegex.exec(sql)) !== null) {
    indexes.push({
      unique: match[1] !== undefined && match[1] !== null,
      name: match[2],
      table: match[3],
      columns: match[4].split(',').map(c => c.trim()),
      sql: match[0],
    });
  }

  return { tables, indexes };
}

function parseColumnDefs(body: string): ColumnDef[] {
  const columns: ColumnDef[] = [];
  const lines = body.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  for (const line of lines) {
    // Skip PRIMARY KEY AUTOINCREMENT lines
    if (/PRIMARY\s+KEY\s+AUTOINCREMENT/i.test(line)) {
      continue;
    }
    // Skip standalone constraints (FOREIGN KEY, CHECK, UNIQUE, etc.)
    if (/^(FOREIGN\s+KEY|CHECK|UNIQUE|CONSTRAINT|PRIMARY\s+KEY)\s/i.test(line)) {
      continue;
    }

    const col = parseColumnLine(line);
    if (col) {
      columns.push(col);
    }
  }

  return columns;
}

function parseColumnLine(line: string): ColumnDef | null {
  // Remove trailing comma
  const cleaned = line.replace(/,\s*$/, '');

  // Match: column_name TYPE [NOT NULL] [DEFAULT ...] [UNIQUE] [...]
  // Handle quoted identifiers like "order"
  const colMatch = cleaned.match(/^("?\w+"?)\s+(\w+(?:\(\s*\d+\s*(?:,\s*\d+\s*)?\))?)\s*(.*)/i);
  if (!colMatch) {
    return null;
  }

  const name = colMatch[1].replace(/"/g, '');
  const type = colMatch[2].toUpperCase();
  const rest = colMatch[3];

  const notNull = /\bNOT\s+NULL\b/i.test(rest);

  let defaultValue: string | undefined;
  const defaultMatch = rest.match(/DEFAULT\s+((?:\([^()]*\)|\((?:[^()]*|\([^()]*\))*\)|'[^']*'|\S+))/i);
  if (defaultMatch) {
    defaultValue = defaultMatch[1];
  }

  return { name, type, notNull, defaultValue };
}
