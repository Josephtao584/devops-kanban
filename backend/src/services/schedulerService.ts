import cron, { type ScheduledTask } from 'node-cron';
import { TaskSourceService } from './taskSourceService.js';
import { TaskService } from './taskService.js';
import { TaskRepository } from '../repositories/taskRepository.js';
import { TaskSourceRepository } from '../repositories/taskSourceRepository.js';
import { WorkflowRunRepository } from '../repositories/workflowRunRepository.js';
import { SettingsService } from './settingsService.js';

interface SyncResult {
  totalFetched: number;
  newlyCreated: number;
  tasksTagged: number;
  errors: string[];
}

interface DispatchResult {
  eligibleTasks: number;
  dispatched: number;
  skipped: number;
  errors: string[];
}

interface JobStatus {
  sourceId: number;
  running: boolean;
}

const PRIORITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

class SchedulerService {
  private syncJobs: Map<number, ScheduledTask> = new Map();
  private dispatchJob: ScheduledTask | null = null;
  private syncingSources: Set<number> = new Set();
  private dispatching = false;
  private taskSourceService: TaskSourceService;
  private taskService: TaskService;
  private taskRepository: TaskRepository;
  private sourceRepository: TaskSourceRepository;
  private workflowRunRepository: WorkflowRunRepository;
  private settingsService: SettingsService;

  constructor(deps?: {
    taskSourceService?: TaskSourceService;
    taskService?: TaskService;
    taskRepository?: TaskRepository;
    sourceRepository?: TaskSourceRepository;
    workflowRunRepository?: WorkflowRunRepository;
    settingsService?: SettingsService;
  }) {
    this.taskSourceService = deps?.taskSourceService || new TaskSourceService();
    this.taskService = deps?.taskService || new TaskService();
    this.taskRepository = deps?.taskRepository || new TaskRepository();
    this.sourceRepository = deps?.sourceRepository || new TaskSourceRepository();
    this.workflowRunRepository = deps?.workflowRunRepository || new WorkflowRunRepository();
    this.settingsService = deps?.settingsService || new SettingsService();
  }

  async initialize(): Promise<void> {
    const sources = await this.sourceRepository.findAll();
    for (const source of sources) {
      if (source.enabled && source.sync_schedule) {
        this.registerSyncJob(source.id, source.sync_schedule);
      }
    }
    console.log(`[Scheduler] Initialized ${this.syncJobs.size} sync job(s)`);

    // Register global workflow dispatch job
    const dispatchCron = await this.settingsService.getWorkflowDispatchCron();
    this.registerDispatchJob(dispatchCron);
  }

  // --- Sync Jobs (per-task-source) ---

  registerSyncJob(sourceId: number, cronExpression: string): boolean {
    if (!cron.validate(cronExpression)) {
      console.warn(`[Scheduler] Invalid cron for source ${sourceId}: ${cronExpression}`);
      return false;
    }
    this.unregisterSyncJob(sourceId);
    const task = cron.schedule(cronExpression, () => {
      this.executeSync(sourceId);
    });
    this.syncJobs.set(sourceId, task);
    console.log(`[Scheduler] Registered sync job for source ${sourceId}: ${cronExpression}`);
    return true;
  }

  /** @deprecated Use registerSyncJob instead */
  registerJob(sourceId: number, cronExpression: string): boolean {
    return this.registerSyncJob(sourceId, cronExpression);
  }

  unregisterSyncJob(sourceId: number): void {
    const existing = this.syncJobs.get(sourceId);
    if (existing) {
      existing.stop();
      this.syncJobs.delete(sourceId);
      console.log(`[Scheduler] Unregistered sync job for source ${sourceId}`);
    }
  }

  /** @deprecated Use unregisterSyncJob instead */
  unregisterJob(sourceId: number): void {
    this.unregisterSyncJob(sourceId);
  }

  async reloadSource(sourceId: number): Promise<void> {
    const numericId = typeof sourceId === 'string' ? parseInt(sourceId, 10) : sourceId;
    const source = await this.sourceRepository.findById(numericId);
    this.unregisterSyncJob(numericId);
    if (source && source.enabled && source.sync_schedule) {
      this.registerSyncJob(numericId, source.sync_schedule);
    }
  }

  async reloadAll(): Promise<void> {
    this.shutdown();
    await this.initialize();
  }

  shutdown(): void {
    for (const [sourceId, task] of this.syncJobs) {
      task.stop();
      console.log(`[Scheduler] Stopped sync job for source ${sourceId}`);
    }
    this.syncJobs.clear();
    if (this.dispatchJob) {
      this.dispatchJob.stop();
      this.dispatchJob = null;
    }
    console.log('[Scheduler] All jobs stopped');
  }

  getStatus(): JobStatus[] {
    return Array.from(this.syncJobs.keys()).map((sourceId) => ({
      sourceId,
      running: true,
    }));
  }

  getJobStatus(sourceId: number): JobStatus | null {
    if (this.syncJobs.has(sourceId)) {
      return { sourceId, running: true };
    }
    return null;
  }

  // --- Dispatch Job (global) ---

  registerDispatchJob(cronExpression: string): boolean {
    if (!cron.validate(cronExpression)) {
      console.warn(`[Scheduler] Invalid dispatch cron: ${cronExpression}`);
      return false;
    }
    if (this.dispatchJob) {
      this.dispatchJob.stop();
    }
    this.dispatchJob = cron.schedule(cronExpression, () => {
      this.dispatchWorkflows();
    });
    console.log(`[Scheduler] Registered dispatch job: ${cronExpression}`);
    return true;
  }

  async triggerDispatchNow(): Promise<DispatchResult> {
    return this.dispatchWorkflows();
  }

  // --- Sync Execution ---

  async executeSync(sourceId: number): Promise<SyncResult> {
    const result: SyncResult = {
      totalFetched: 0,
      newlyCreated: 0,
      tasksTagged: 0,
      errors: [],
    };

    if (this.syncingSources.has(sourceId)) {
      console.warn(`[Scheduler] Source ${sourceId} already syncing, skipping`);
      return result;
    }
    this.syncingSources.add(sourceId);

    try {
      const source = await this.sourceRepository.findById(sourceId);
      if (!source || !source.enabled) {
        console.log(`[Scheduler] Source ${sourceId} not found or disabled`);
        return result;
      }

      const defaultTemplateId = source.default_workflow_template_id || null;

      // Snapshot existing external_ids
      const projectTasks = await this.taskRepository.findByProject(source.project_id);
      const existingExternalIds = new Set(
        projectTasks
          .filter((t) => t.source === source.type)
          .map((t) => t.external_id)
          .filter((id): id is string => id != null)
      );

      // Sync tasks
      const syncedTasks = await this.taskSourceService.sync(String(sourceId));
      result.totalFetched = syncedTasks.length;

      // Identify newly created tasks
      const newTasks = syncedTasks.filter(
        (task) => task.external_id && !existingExternalIds.has(task.external_id)
      );
      result.newlyCreated = newTasks.length;

      // Tag new tasks with default workflow template
      if (newTasks.length > 0 && defaultTemplateId) {
        console.log(`[Scheduler] Source ${sourceId}: ${newTasks.length} new tasks, tagging with default template '${defaultTemplateId}'`);

        for (const task of newTasks) {
          try {
            await this.taskRepository.update(task.id, {
              auto_execute: 1,
              auto_execute_template_id: defaultTemplateId,
            } as any);
            result.tasksTagged++;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            result.errors.push(`Task ${task.id}: ${message}`);
            console.warn(`[Scheduler] Failed to tag task ${task.id}: ${message}`);
          }
        }
      } else {
        console.log(`[Scheduler] Source ${sourceId}: ${syncedTasks.length} fetched, ${newTasks.length} new, template: ${defaultTemplateId || 'none'}`);
      }

      // Update last_scheduled_sync_at
      await this.sourceRepository.update(sourceId, {
        last_scheduled_sync_at: new Date().toISOString(),
      } as any);

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Sync failed: ${message}`);
      console.error(`[Scheduler] Error syncing source ${sourceId}:`, message);
    } finally {
      this.syncingSources.delete(sourceId);
    }

    return result;
  }

  // --- Workflow Dispatch ---

  async getActiveWorkflowCount(): Promise<number> {
    const all = await this.workflowRunRepository.findAll();
    return all.filter(
      (r) => r.status === 'RUNNING' || r.status === 'PENDING' || r.status === 'SUSPENDED'
    ).length;
  }

  async dispatchWorkflows(): Promise<DispatchResult> {
    const result: DispatchResult = {
      eligibleTasks: 0,
      dispatched: 0,
      skipped: 0,
      errors: [],
    };

    if (this.dispatching) {
      console.warn('[Scheduler] Dispatch already in progress, skipping');
      return result;
    }
    this.dispatching = true;

    try {
      const maxTasks = await this.settingsService.getMaxTasksPerExecution();
      const maxConcurrent = await this.settingsService.getMaxConcurrentWorkflows();

      // Find all TODO tasks with auto_execute=1 and a template_id
      const allTasks = await this.taskRepository.findByStatus('TODO');
      const activeRuns = await this.workflowRunRepository.findAll();
      const activeTaskIds = new Set(
        activeRuns
          .filter((r) => r.status === 'RUNNING' || r.status === 'PENDING' || r.status === 'SUSPENDED')
          .map((r) => r.task_id)
      );

      const eligible = allTasks.filter(
        (t) => t.auto_execute === 1 && t.auto_execute_template_id && !activeTaskIds.has(t.id)
      );

      // Sort: priority DESC (lower number = higher priority), created_at ASC
      eligible.sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority] ?? 3;
        const pb = PRIORITY_ORDER[b.priority] ?? 3;
        if (pa !== pb) return pa - pb;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      result.eligibleTasks = eligible.length;

      // Take top N
      const batch = eligible.slice(0, maxTasks);

      // Use local counter to avoid race condition with async startTask
      const dbActiveCount = await this.getActiveWorkflowCount();
      let localDispatched = dbActiveCount;

      for (const task of batch) {
        if (localDispatched >= maxConcurrent) {
          result.skipped++;
          continue;
        }

        try {
          await this.taskService.startTask(task.id, {
            workflow_template_id: task.auto_execute_template_id!,
          });
          localDispatched++;
          result.dispatched++;
          console.log(`[Scheduler] Dispatched task ${task.id} with template ${task.auto_execute_template_id}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`Task ${task.id}: ${message}`);
          result.skipped++;
        }
      }

      console.log(`[Scheduler] Dispatch complete: ${result.dispatched} dispatched, ${result.skipped} skipped, ${result.eligibleTasks} eligible`);

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Dispatch failed: ${message}`);
      console.error('[Scheduler] Dispatch error:', message);
    } finally {
      this.dispatching = false;
    }

    return result;
  }
}

export { SchedulerService };
export type { SyncResult, DispatchResult, JobStatus };
