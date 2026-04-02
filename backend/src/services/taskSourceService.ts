import { TaskSourceRepository } from '../repositories/taskSourceRepository.js';
import { TaskRepository } from '../repositories/taskRepository.js';
import { loadAdapterTypes } from '../config/taskSources.js';
import { getAdapter, getAdapterMetadata } from '../sources/index.js';
import type { TaskSourceLike, FetchOptions } from '../sources/base.js';
import type {
  CreateTaskSourceInput,
  UpdateTaskSourceInput,
} from '../types/dto/taskSources.js';
import type {
  ImportedTask,
  SourceRecord,
  SourceTypeDefinition as SharedSourceTypeDefinition,
} from '../types/sources.ts';
import type {TaskEntity} from "../types/entities.js";

const READ_ONLY_ERROR_MESSAGE = 'Task sources are read-only and managed by configuration';

type SourceTypeDefinition = SharedSourceTypeDefinition;

class TaskSourceService {
  repository: TaskSourceRepository;
  taskRepository: TaskRepository;

  constructor() {
    this.repository = new TaskSourceRepository();
    this.taskRepository = new TaskRepository();
  }

  async loadSources(): Promise<SourceRecord[]> {
    const records = await this.repository.findAll();
    return records.map((record) => this._toSourceRecord(record));
  }

  _toSourceRecord(record: { id: number; type: string; name: string; project_id: number; config: Record<string, unknown>; enabled: boolean; last_sync_at?: string | null }): SourceRecord {
    const source: SourceRecord = {
      id: String(record.id),
      type: record.type,
      name: record.name,
      project_id: record.project_id,
      config: record.config,
      enabled: record.enabled,
    };

    if (record.last_sync_at) {
      source.last_sync_at = record.last_sync_at;
    }

    return source;
  }

  async getAll() {
    return await this.loadSources();
  }

  async getById(sourceId: string) {
    const sources = await this.loadSources();
    const numericSourceId = Number(sourceId);
    return sources.find((source) => Number(source.id) === numericSourceId) || null;
  }

  async getByProject(projectId: number) {
    const sources = await this.loadSources();
    const numericProjectId = typeof projectId === 'string' ? parseInt(projectId, 10) : projectId;
    return sources.filter((source) => {
      const sourceProjectId = typeof source.project_id === 'string'
        ? parseInt(source.project_id, 10)
        : source.project_id;
      return sourceProjectId === numericProjectId;
    });
  }

  async getAvailableSourceTypes(): Promise<Record<string, SourceTypeDefinition>> {
    const adapterTypes = await loadAdapterTypes();
    return Object.fromEntries(adapterTypes.map((typeDefinition) => [String(typeDefinition.key), typeDefinition as SourceTypeDefinition]));
  }

  _buildReadOnlyError() {
    const error = new Error(READ_ONLY_ERROR_MESSAGE) as Error & { statusCode?: number };
    error.statusCode = 405;
    return error;
  }

  async create(sourceData: CreateTaskSourceInput) {
    // Ensure project_id is a number
    const normalizedData = {
      ...sourceData,
      project_id: typeof sourceData.project_id === 'string'
        ? parseInt(sourceData.project_id, 10)
        : sourceData.project_id,
    };
    const entity = await this.repository.create(normalizedData as unknown as Omit<import('../types/entities.js').TaskSourceEntity, 'id'>);
    return this._toSourceRecord(entity);
  }

  async update(sourceId: string, sourceData: UpdateTaskSourceInput) {
    const existing = await this.getById(sourceId);
    if (!existing) {
      return null;
    }

    const keys = Object.keys(sourceData);
    if (keys.length === 1 && keys[0] === 'last_sync_at') {
      return existing;
    }

    const numericId = parseInt(sourceId, 10);
    const updated = await this.repository.update(numericId, sourceData as unknown as Partial<import('../types/entities.js').TaskSourceEntity>);
    return updated ? this._toSourceRecord(updated) : null;
  }

  async delete(sourceId: string) {
    const numericId = parseInt(sourceId, 10);
    return await this.repository.delete(numericId);
  }

  async exists(sourceId: string) {
    const source = await this.getById(sourceId);
    return source !== null;
  }

  async getAvailableAdapterTypes() {
    return await loadAdapterTypes();
  }

  async sync(sourceId: string): Promise<TaskEntity[]> {
    const source = await this.getById(sourceId);
    if (!source) {
      const error = new Error('Task source not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    const adapter = getAdapter(source.type, source as TaskSourceLike);
    const fetchedTasks = (await adapter.fetch()) as ImportedTask[];
    const projectId = source.project_id;

    const createdTasks: TaskEntity[] = [];
    for (const taskData of fetchedTasks) {
      const existing = await this.taskRepository.findByExternalId(taskData.external_id);
      if (existing) {
        const updatedTask = await this.taskRepository.update(existing.id, {
          project_id: projectId,
          title: taskData.title,
          description: taskData.description ?? '',
          external_url: typeof taskData.external_url === 'string' ? taskData.external_url : '',
          labels: taskData.labels || [],
          source: source.type,
        });
        createdTasks.push(updatedTask || { ...existing, project_id: projectId });
      } else {
        const newTask = await this.taskRepository.create({
          ...taskData,
          description: taskData.description ?? undefined,
          project_id: projectId,
          status: 'TODO',
          priority: 'MEDIUM',
          source: source.type,
        });
        createdTasks.push(newTask);
      }
    }

    return createdTasks;
  }

  async testConnection(sourceId: string) {
    const source = await this.getById(sourceId);
    if (!source) {
      const error = new Error('Task source not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    const adapter = getAdapter(source.type, source as TaskSourceLike);
    return await adapter.testConnection();
  }

  getAdapterConfigFields(type: string) {
    return getAdapterMetadata(type);
  }

  async previewSync(sourceId: string, options?: FetchOptions) {
    const source = await this.getById(sourceId);
    if (!source) {
      const error = new Error('Task source not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    const adapter = getAdapter(source.type, source as TaskSourceLike);
    const issues = (await adapter.fetch(options)) as ImportedTask[];

    const allTasks = await this.taskRepository.findByProject(source.project_id);
    const importedExternalIds = new Set(
      allTasks
        .filter((task) => task.external_id)
        .map((task) => task.external_id as string)
    );

    return issues.map((issue) => ({
      ...issue,
      imported: importedExternalIds.has(issue.external_id),
    }));
  }

  async importIssues(sourceId: string, selectedItems: ImportedTask[], projectId: number | string, iterationId: number | null = null) {
    const numericProjectId = typeof projectId === 'string' ? parseInt(projectId, 10) : projectId;
    const source = await this.getById(sourceId);
    if (!source) {
      const error = new Error('Task source not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    let created = 0;
    let skipped = 0;

    for (const item of selectedItems) {
      const existing = await this.taskRepository.findByExternalIdAndProject(item.external_id, numericProjectId);
      if (existing) {
        skipped++;
        continue;
      }

      await this.taskRepository.create({
        project_id: numericProjectId,
        title: item.title,
        description: item.description || '',
        status: 'TODO',
        priority: 'MEDIUM',
        external_id: item.external_id,
        external_url: typeof item.external_url === 'string' ? item.external_url : '',
        source: source.type,
        labels: item.labels || [],
        iteration_id: iterationId || null,
      });
      created++;
    }

    return { created, skipped, total: selectedItems.length };
  }
}

export { READ_ONLY_ERROR_MESSAGE, TaskSourceService };
