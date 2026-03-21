import 'fastify';

export interface FastifyRuntimeConfig {
  SERVER_PORT: number;
  SERVER_HOST: string;
  STORAGE_PATH: string;
  [key: string]: unknown;
}

export interface TaskSourceServiceContract {
  getByProject(projectId: number): Promise<unknown>;
  getById(sourceId: string): Promise<unknown>;
  getAvailableSourceTypes(): Promise<unknown>;
  create(source: Record<string, unknown>): Promise<unknown>;
  update(sourceId: string, source: Record<string, unknown>): Promise<unknown>;
  delete(sourceId: string): Promise<unknown>;
  sync(sourceId: string): Promise<unknown>;
  previewSync(sourceId: string): Promise<unknown>;
  importIssues(sourceId: string, items: unknown[], projectId: number, iterationId?: number | null): Promise<unknown>;
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
