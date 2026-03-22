import 'fastify';

import type {
  ImportedTask,
  PreviewImportedTask,
  SourceRecord,
  SourceTypeDefinition,
  TaskSourceImportResult,
} from './sources.ts';

export interface FastifyRuntimeConfig {
  SERVER_PORT: number;
  SERVER_HOST: string;
  STORAGE_PATH: string;
  [key: string]: unknown;
}

export interface TaskSourceServiceContract {
  getByProject(projectId: number): Promise<SourceRecord[]>;
  getById(sourceId: string): Promise<SourceRecord | null>;
  getAvailableSourceTypes(): Promise<Record<string, SourceTypeDefinition>>;
  create(source: Record<string, unknown>): Promise<SourceRecord>;
  update(sourceId: string, source: Record<string, unknown>): Promise<SourceRecord | null>;
  delete(sourceId: string): Promise<SourceRecord | null>;
  sync(sourceId: string): Promise<Record<string, unknown>[]>;
  previewSync(sourceId: string): Promise<PreviewImportedTask[]>;
  importIssues(sourceId: string, items: ImportedTask[], projectId: number, iterationId?: number | null): Promise<TaskSourceImportResult>;
  testConnection(sourceId: string): Promise<boolean>;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: FastifyRuntimeConfig;
    taskSourceService?: TaskSourceServiceContract;
  }

  interface FastifyBaseLogger {
    error: (obj: unknown) => void;
  }
}
