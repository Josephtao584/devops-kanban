import { TaskSourceRepository } from '../repositories/taskSourceRepository.js';
import { TaskRepository } from '../repositories/taskRepository.js';
import { loadAdapterTypes } from '../config/taskSources.js';
import { getAdapter, getAdapterMetadata } from '../sources/index.js';
import type { TaskSourceLike } from '../sources/base.js';
import type { ImportedTask, SourceRecord } from '../types/sources.ts';

const READ_ONLY_ERROR_MESSAGE = 'Task sources are read-only and managed by configuration';

type SourceTypeDefinition = Record<string, unknown> & { key: string };

class TaskSourceService {
  repository: TaskSourceRepository;
  taskRepository: TaskRepository;

  constructor() {
    this.repository = new TaskSourceRepository();
    this.taskRepository = new TaskRepository();
  }

  async loadSources(): Promise<SourceRecord[]> {
    return (await this.repository.findAll()) as unknown as SourceRecord[];
  }

  async getAll() {
    return await this.loadSources();
  }

  async getById(sourceId: string) {
    const sources = await this.loadSources();
    return sources.find((source) => source.id === sourceId) || null;
  }

  async getByProject(projectId: number) {
    const sources = await this.loadSources();
    return sources.filter((source) => source.project_id === projectId);
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

  async create(_sourceData: Record<string, unknown>) {
    throw this._buildReadOnlyError();
  }

  async update(sourceId: string, sourceData: Record<string, unknown>) {
    const existing = await this.getById(sourceId);
    if (!existing) {
      return null;
    }

    const keys = Object.keys(sourceData);
    if (keys.length === 1 && keys[0] === 'last_sync_at') {
      return existing;
    }

    throw this._buildReadOnlyError();
  }

  async delete(_sourceId: string) {
    throw this._buildReadOnlyError();
  }

  async exists(sourceId: string) {
    const source = await this.getById(sourceId);
    return source !== null;
  }

  async getAvailableAdapterTypes() {
    return await loadAdapterTypes();
  }

  async sync(sourceId: string) {
    const source = await this.getById(sourceId);
    if (!source) {
      const error = new Error('Task source not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    const adapter = getAdapter(source.type, source as TaskSourceLike);
    const fetchedTasks = (await adapter.fetch()) as ImportedTask[];
    const projectId = source.project_id;

    const createdTasks: Array<Record<string, unknown>> = [];
    for (const taskData of fetchedTasks) {
      const existing = await this.taskRepository.findByExternalId(taskData.external_id);
      if (existing) {
        if (existing.project_id !== projectId) {
          await this.taskRepository.update(existing.id, { project_id: projectId });
        }
        createdTasks.push({ ...existing, project_id: projectId });
      } else {
        const newTask = await this.taskRepository.create({
          ...taskData,
          project_id: projectId,
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

  async previewSync(sourceId: string) {
    const source = await this.getById(sourceId);
    if (!source) {
      const error = new Error('Task source not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    const adapter = getAdapter(source.type, source as TaskSourceLike);
    const issues = (await adapter.fetch()) as ImportedTask[];

    const allTasks = await this.taskRepository.findAll();
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

  async importIssues(sourceId: string, selectedItems: ImportedTask[], projectId: number, iterationId: number | null = null) {
    const source = await this.getById(sourceId);
    if (!source) {
      const error = new Error('Task source not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    let created = 0;
    let skipped = 0;

    for (const item of selectedItems) {
      const existing = await this.taskRepository.findByExternalId(item.external_id);
      if (existing) {
        skipped++;
        continue;
      }

      await this.taskRepository.create({
        project_id: projectId,
        title: item.title,
        description: item.description,
        status: 'TODO',
        priority: 'MEDIUM',
        external_id: item.external_id,
        external_url: item.external_url,
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
