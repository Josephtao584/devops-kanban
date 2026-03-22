export interface SourceDefinition extends Record<string, unknown> {
  type: string;
  key?: string;
  name?: string;
  description?: string;
  configFields?: Record<string, unknown>;
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
  mapping?: Record<string, string>;
  transforms?: Record<string, string | Record<string, unknown>>;
}

export interface SourceRegistryEntry {
  type: string;
  kind: 'class' | 'config';
  metadata: SourceDefinition;
}

export interface SourceRecord {
  id: number | string;
  type: string;
  name: string;
  project_id: number;
  config: Record<string, unknown>;
  enabled?: boolean;
  last_sync_at?: string | null;
}

export interface ImportedTask {
  external_id: string;
  title: string;
  description?: string;
  external_url?: string;
  labels?: string[];
  [key: string]: unknown;
}
