import { TaskSourceRepository } from '../repositories/taskSourceRepository.js';
import { TaskRepository } from '../repositories/taskRepository.js';
import { SessionRepository } from '../repositories/sessionRepository.js';
import { SessionSegmentRepository } from '../repositories/sessionSegmentRepository.js';
import { AgentRepository } from '../repositories/agentRepository.js';
import { loadAdapterTypes } from '../config/taskSources.js';
import { getAdapter, getAdapterMetadata, getAvailableTypes } from '../sources/index.js';
import { LocalDirectoryAdapter } from '../sources/localDirectoryAdapter.js';
import { NotFoundError, BusinessError, ValidationError } from '../utils/errors.js';
import type { TaskSourceLike, FetchOptions } from '../sources/base.js';
import type {
  CreateTaskSourceInput,
  UpdateTaskSourceInput,
  ConfirmSyncItem,
} from '../types/dto/taskSources.js';
import type {
  ImportedTask,
  SourceRecord,
  SourceTypeDefinition as SharedSourceTypeDefinition,
} from '../types/sources.ts';
import type {TaskEntity} from "../types/entities.js";
import { ExecutorType } from '../types/executors.js';
import { logger } from '../utils/logger.js';

const READ_ONLY_ERROR_MESSAGE = 'Task sources are read-only and managed by configuration';

type SourceTypeDefinition = SharedSourceTypeDefinition;

class TaskSourceService {
  repository: TaskSourceRepository;
  taskRepository: TaskRepository;

  constructor(_options?: { taskSourceStoragePath?: string; taskStoragePath?: string }) {
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
    const yamlTypes = Object.fromEntries(adapterTypes.map((typeDefinition) => [String(typeDefinition.key), typeDefinition as SourceTypeDefinition]));
    const classTypes = getAvailableTypes();
    return { ...yamlTypes, ...classTypes } as Record<string, SourceTypeDefinition>;
  }

  _buildReadOnlyError() {
    return new BusinessError('任务源为只读，由配置管理', READ_ONLY_ERROR_MESSAGE);
  }

  async create(sourceData: CreateTaskSourceInput) {
    if (!sourceData.name?.trim()) {
      throw new ValidationError('任务源名称不能为空', 'Task source name is required');
    }
    if (sourceData.name.length > 200) {
      throw new ValidationError('任务源名称不能超过 200 个字符', 'Task source name exceeds maximum length of 200 characters');
    }

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

    if (sourceData.name !== undefined) {
      if (!sourceData.name.trim()) {
        throw new ValidationError('任务源名称不能为空', 'Task source name is required');
      }
      if (sourceData.name.length > 200) {
        throw new ValidationError('任务源名称不能超过 200 个字符', 'Task source name exceeds maximum length of 200 characters');
      }
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
      throw new NotFoundError('未找到任务源', 'Task source not found', { sourceId });
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

  async syncWithSession(sourceId: string): Promise<{ sessionId: number | null; tasks: TaskEntity[] }> {
    const source = await this.getById(sourceId);
    if (!source) {
      throw new NotFoundError('未找到任务源', 'Task source not found', { sourceId });
    }

    const adapter = getAdapter(source.type, source as TaskSourceLike);

    if (source.type === 'LOCAL_DIRECTORY' && adapter instanceof LocalDirectoryAdapter && adapter.descriptionMode === 'ai') {
      const sessionRepo = new SessionRepository();
      const projectId = source.project_id;

      // Scan files and deduplicate against existing tasks
      const allFiles = await adapter._scanFiles();
      const newFiles = [];
      for (const file of allFiles) {
        const existing = await this.taskRepository.findByExternalIdAndProject(file.filename, projectId);
        if (!existing) {
          newFiles.push(file);
        }
      }

      // No new files — skip session creation
      if (newFiles.length === 0) {
        return { sessionId: null, tasks: [] };
      }

      const agentRepo = new AgentRepository();
      let sessionExecutorType = ExecutorType.CLAUDE_CODE;
      let sessionAgentId: number | null = null;

      if (adapter.agentId) {
        const agent = await agentRepo.findById(adapter.agentId);
        if (agent) {
          sessionExecutorType = agent.executorType;
          sessionAgentId = agent.id;
        } else {
          logger.warn('TaskSourceService', `Agent ${adapter.agentId} not found, falling back to CLAUDE_CODE`);
        }
      }

      const session = await sessionRepo.create({
        task_id: 0,
        executor_type: sessionExecutorType,
        agent_id: sessionAgentId,
        status: 'RUNNING',
        worktree_path: adapter.directoryPath,
        started_at: new Date().toISOString(),
      });

      const sessionId = session.id;

      adapter.fetchWithAiDescriptions(sessionId, newFiles).then(async (fetchedTasks) => {
        for (const taskData of fetchedTasks) {
          const existing = await this.taskRepository.findByExternalIdAndProject(taskData.external_id, projectId);
          if (existing) {
            await this.taskRepository.update(existing.id, {
              project_id: projectId,
              title: taskData.title,
              description: taskData.description ?? '',
              source: source.type,
            });
          } else {
            await this.taskRepository.create({
              ...taskData,
              description: taskData.description ?? undefined,
              project_id: projectId,
              status: 'TODO',
              priority: 'MEDIUM',
              source: source.type,
            });
          }
        }

        try {
          await sessionRepo.update(sessionId, {
            status: 'COMPLETED',
            completed_at: new Date().toISOString(),
          });
        } catch {
          // DB may be closed.
        }
      }).catch(async (err) => {
        logger.error('TaskSourceService', `AI sync failed: ${err}`);
        try {
          await sessionRepo.update(sessionId, {
            status: 'FAILED',
            completed_at: new Date().toISOString(),
          });
        } catch {
          // DB may be closed — nothing we can do at this point.
        }
      });

      return { sessionId, tasks: [] };
    }

    const tasks = await this.sync(sourceId);
    return { sessionId: null, tasks };
  }

  async testConnection(sourceId: string) {
    const source = await this.getById(sourceId);
    if (!source) {
      throw new NotFoundError('未找到任务源', 'Task source not found', { sourceId });
    }

    const adapter = getAdapter(source.type, source as TaskSourceLike);
    return await adapter.testConnection();
  }

  async getSyncHistory(sourceId: string, options?: { page: number; pageSize: number }) {
    const source = await this.getById(sourceId);
    if (!source) {
      throw new NotFoundError('未找到任务源', 'Task source not found', { sourceId });
    }

    const config = source.config as Record<string, unknown>;
    const directoryPath = typeof config.directoryPath === 'string' ? config.directoryPath : '';
    if (!directoryPath) return { history: [], total: 0 };

    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const sessionRepo = new SessionRepository();
    const segmentRepo = new SessionSegmentRepository();
    const { rows: sessions, total } = await sessionRepo.getByWorktreePathPaginated(directoryPath, { offset, limit: pageSize });

    // Count tasks for this source once (total across all syncs)
    const allSourceTasks = await this.taskRepository.findByProject(source.project_id);
    const totalSourceTaskCount = allSourceTasks.filter(
      (t) => t.source === source.type,
    ).length;

    const history = [];
    for (const session of sessions) {
      // Detect mode: if session has segments with agent → "ai", otherwise "fixed"
      const segments = await segmentRepo.findBySessionId(session.id);
      const mode = segments.length > 0 ? 'ai' : 'fixed';

      history.push({
        sessionId: session.id,
        status: session.status || 'UNKNOWN',
        mode,
        startedAt: session.started_at,
        completedAt: session.completed_at,
        fileCount: totalSourceTaskCount,
      });
    }

    return { history, total };
  }

  getAdapterConfigFields(type: string) {
    return getAdapterMetadata(type);
  }

  async previewSync(sourceId: string, options?: FetchOptions) {
    const source = await this.getById(sourceId);
    if (!source) {
      throw new NotFoundError('未找到任务源', 'Task source not found', { sourceId });
    }

    // 强制限制 preview 的数量，防止大量数据导致前端卡死
    const safeOptions = {
      limit: Math.min(options?.limit ?? 20, 20),
      offset: options?.offset ?? 0,
    };

    const adapter = getAdapter(source.type, source as TaskSourceLike);
    const issues = (await adapter.fetch(safeOptions)) as ImportedTask[];

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

  async previewSyncPrompt(sourceId: string) {
    const source = await this.getById(sourceId);
    if (!source) {
      throw new NotFoundError('未找到任务源', 'Task source not found', { sourceId });
    }

    const adapter = getAdapter(source.type, source as TaskSourceLike);
    if (source.type !== 'LOCAL_DIRECTORY' || !(adapter instanceof LocalDirectoryAdapter) || adapter.descriptionMode !== 'ai') {
      throw new BusinessError('仅支持 LOCAL_DIRECTORY AI 模式', 'Only LOCAL_DIRECTORY AI mode is supported');
    }

    const allFiles = await adapter._scanFiles();
    const projectId = source.project_id;
    const newFiles = [];
    for (const file of allFiles) {
      const existing = await this.taskRepository.findByExternalIdAndProject(file.filename, projectId);
      if (!existing) {
        newFiles.push(file);
      }
    }

    const prompt = adapter.buildAiPromptTemplate();
    return { prompt, files: newFiles, fileCount: newFiles.length };
  }

  async previewSyncResults(sourceId: string, customPrompt?: string) {
    const source = await this.getById(sourceId);
    if (!source) {
      throw new NotFoundError('未找到任务源', 'Task source not found', { sourceId });
    }

    const adapter = getAdapter(source.type, source as TaskSourceLike);
    if (source.type !== 'LOCAL_DIRECTORY' || !(adapter instanceof LocalDirectoryAdapter) || adapter.descriptionMode !== 'ai') {
      throw new BusinessError('仅支持 LOCAL_DIRECTORY AI 模式', 'Only LOCAL_DIRECTORY AI mode is supported');
    }

    const allFiles = await adapter._scanFiles();
    const projectId = source.project_id;
    const newFiles = [];
    for (const file of allFiles) {
      const existing = await this.taskRepository.findByExternalIdAndProject(file.filename, projectId);
      if (!existing) {
        newFiles.push(file);
      }
    }

    if (newFiles.length === 0) {
      return { sessionId: null, status: 'no_files' };
    }

    const agentRepo = new AgentRepository();
    const sessionRepo = new SessionRepository();

    // Resolve agent to get real executorType
    let sessionExecutorType = ExecutorType.CLAUDE_CODE;
    let sessionAgentId: number | null = adapter.agentId ?? null;

    if (adapter.agentId) {
      const agent = await agentRepo.findById(adapter.agentId);
      if (agent) {
        sessionExecutorType = agent.executorType;
        sessionAgentId = agent.id;
      } else {
        logger.warn('TaskSourceService', `Agent ${adapter.agentId} not found for preview, falling back to CLAUDE_CODE`);
      }
    }

    const session = await sessionRepo.create({
      task_id: 0,
      executor_type: sessionExecutorType,
      agent_id: sessionAgentId,
      status: 'RUNNING',
      worktree_path: adapter.directoryPath,
      started_at: new Date().toISOString(),
      metadata: {},
    });

    // Fire-and-forget: run AI in background, store results in session metadata when done
    adapter.fetchWithAiDescriptions(session.id, newFiles, customPrompt).then(async (tasks) => {
      const allFallback = tasks.every(t => t.title === t.external_id);
      if (allFallback) {
        await sessionRepo.update(session.id, {
          status: 'FAILED',
          completed_at: new Date().toISOString(),
        });
        return;
      }

      const results = tasks.map(t => ({
        externalId: t.external_id,
        title: t.title,
        description: t.description ?? '',
        external_url: t.external_url,
      }));

      await sessionRepo.update(session.id, {
        status: 'PENDING_REVIEW',
        completed_at: new Date().toISOString(),
        metadata: { aiResults: results },
      });
    }).catch(async (err) => {
      logger.error('TaskSourceService', `AI preview failed: ${err}`);
      try {
        await sessionRepo.update(session.id, {
          status: 'FAILED',
          completed_at: new Date().toISOString(),
        });
      } catch {
        // DB may be closed.
      }
    });

    return { sessionId: session.id, status: 'processing' };
  }

  async confirmSync(sourceId: string, sessionId: number, items: ConfirmSyncItem[]) {
    const source = await this.getById(sourceId);
    if (!source) {
      throw new NotFoundError('未找到任务源', 'Task source not found', { sourceId });
    }

    const sessionRepo = new SessionRepository();
    const session = await sessionRepo.findById(sessionId);
    if (!session) {
      throw new NotFoundError('未找到会话', 'Session not found', { sessionId });
    }

    if (session.status !== 'PENDING_REVIEW') {
      throw new BusinessError('会话未处于待确认状态', 'Session is not in PENDING_REVIEW status', { sessionId });
    }

    const sourceEntity = await this.repository.findById(parseInt(sourceId, 10));
    const defaultTemplateId = (sourceEntity as any)?.default_workflow_template_id || null;

    const projectId = source.project_id;
    let created = 0;
    let skipped = 0;

    for (const item of items) {
      const existing = await this.taskRepository.findByExternalIdAndProject(item.externalId, projectId);
      if (existing) {
        await this.taskRepository.update(existing.id, {
          project_id: projectId,
          title: item.title,
          description: item.description ?? '',
          source: source.type,
        });
        skipped++;
      } else {
        const newTask = await this.taskRepository.create({
          external_id: item.externalId,
          title: item.title,
          description: item.description ?? '',
          project_id: projectId,
          status: 'TODO',
          priority: 'MEDIUM',
          source: source.type,
          external_url: item.external_url ?? '',
        });
        created++;
        if (defaultTemplateId) {
          await this.taskRepository.update(newTask.id, {
            auto_execute: 1,
            auto_execute_template_id: defaultTemplateId,
          } as any);
        }
      }
    }

    await sessionRepo.update(sessionId, {
      status: 'COMPLETED',
      completed_at: new Date().toISOString(),
    });

    return { created, skipped, total: items.length };
  }

  async importIssues(sourceId: string, selectedItems: ImportedTask[], projectId: number | string, iterationId: number | null = null) {
    const numericProjectId = typeof projectId === 'string' ? parseInt(projectId, 10) : projectId;
    const source = await this.getById(sourceId);
    if (!source) {
      throw new NotFoundError('未找到任务源', 'Task source not found', { sourceId });
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
