import 'fastify';

import type {
  CreateTaskSourceInput,
  UpdateTaskSourceInput,
  ConfirmSyncItem,
} from './dto/taskSources.js';
import type {
  ImportedTask,
  PreviewImportedTask,
  SourceRecord,
  SourceTypeDefinition,
  TaskSourceImportResult,
} from './sources.ts';
import type {TaskEntity} from "./entities.js";
import type { SchedulerService } from '../services/schedulerService.js';

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
  create(source: CreateTaskSourceInput): Promise<SourceRecord>;
  update(sourceId: string, source: UpdateTaskSourceInput): Promise<SourceRecord | null>;
  delete(sourceId: string): Promise<SourceRecord | null>;
  sync(sourceId: string): Promise<TaskEntity[]>;
  syncWithSession(sourceId: string): Promise<{ sessionId: number | null; tasks: TaskEntity[] }>;
  previewSync(sourceId: string): Promise<PreviewImportedTask[]>;
  importIssues(sourceId: string, items: ImportedTask[], projectId: number, iterationId?: number | null): Promise<TaskSourceImportResult>;
  testConnection(sourceId: string): Promise<boolean>;
  getSyncHistory(sourceId: string, options?: { page: number; pageSize: number }): Promise<{ history: Array<{ sessionId: number; status: string; mode: string; startedAt: string | null; completedAt: string | null; fileCount: number }>; total: number }>;
  previewSyncPrompt(sourceId: string): Promise<{ prompt: string; files: unknown[]; fileCount: number }>;
  previewSyncResults(sourceId: string): Promise<{ sessionId: number | null; results: unknown[] }>;
  confirmSync(sourceId: string, sessionId: number, items: ConfirmSyncItem[]): Promise<{ created: number; skipped: number; total: number }>;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: FastifyRuntimeConfig;
    taskSourceService?: TaskSourceServiceContract;
    schedulerService?: SchedulerService;
  }

  interface FastifyBaseLogger {
    error: (obj: unknown) => void;
  }
}
