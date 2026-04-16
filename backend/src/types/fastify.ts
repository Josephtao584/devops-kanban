import 'fastify';

import type {
  CreateTaskSourceInput,
  UpdateTaskSourceInput,
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
