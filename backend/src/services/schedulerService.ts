import cron, { type ScheduledTask } from 'node-cron';
import { TaskSourceService } from './taskSourceService.js';
import { TaskService } from './taskService.js';
import { TaskRepository } from '../repositories/taskRepository.js';
import { TaskSourceRepository } from '../repositories/taskSourceRepository.js';

interface AutoWorkflowRule {
  label: string;
  template_id: string;
}

interface SyncResult {
  totalFetched: number;
  newlyCreated: number;
  workflowsTriggered: number;
  errors: string[];
}

interface JobStatus {
  sourceId: number;
  running: boolean;
}

class SchedulerService {
  private jobs: Map<number, ScheduledTask> = new Map();
  private syncingSources: Set<number> = new Set();
  private taskSourceService: TaskSourceService;
  private taskService: TaskService;
  private taskRepository: TaskRepository;
  private sourceRepository: TaskSourceRepository;

  constructor() {
    this.taskSourceService = new TaskSourceService();
    this.taskService = new TaskService();
    this.taskRepository = new TaskRepository();
    this.sourceRepository = new TaskSourceRepository();
  }

  async initialize(): Promise<void> {
    const sources = await this.sourceRepository.findAll();
    for (const source of sources) {
      if (source.enabled && source.sync_schedule) {
        this.registerJob(source.id, source.sync_schedule);
      }
    }
    console.log(`[Scheduler] Initialized with ${this.jobs.size} scheduled job(s)`);
  }

  registerJob(sourceId: number, cronExpression: string): boolean {
    if (!cron.validate(cronExpression)) {
      console.warn(`[Scheduler] Invalid cron expression for source ${sourceId}: ${cronExpression}`);
      return false;
    }

    this.unregisterJob(sourceId);

    const task = cron.schedule(cronExpression, () => {
      this.syncAndTriggerWorkflows(sourceId);
    });

    this.jobs.set(sourceId, task);
    console.log(`[Scheduler] Registered job for source ${sourceId}: ${cronExpression}`);
    return true;
  }

  unregisterJob(sourceId: number): void {
    const existing = this.jobs.get(sourceId);
    if (existing) {
      existing.stop();
      this.jobs.delete(sourceId);
      console.log(`[Scheduler] Unregistered job for source ${sourceId}`);
    }
  }

  async reloadSource(sourceId: number): Promise<void> {
    const numericId = typeof sourceId === 'string' ? parseInt(sourceId, 10) : sourceId;
    const source = await this.sourceRepository.findById(numericId);

    this.unregisterJob(numericId);

    if (source && source.enabled && source.sync_schedule) {
      this.registerJob(numericId, source.sync_schedule);
    }
  }

  async reloadAll(): Promise<void> {
    this.shutdown();
    await this.initialize();
  }

  shutdown(): void {
    for (const [sourceId, task] of this.jobs) {
      task.stop();
      console.log(`[Scheduler] Stopped job for source ${sourceId}`);
    }
    this.jobs.clear();
  }

  getStatus(): JobStatus[] {
    return Array.from(this.jobs.keys()).map((sourceId) => ({
      sourceId,
      running: true,
    }));
  }

  getJobStatus(sourceId: number): JobStatus | null {
    if (this.jobs.has(sourceId)) {
      return { sourceId, running: true };
    }
    return null;
  }

  matchRule(labels: string[], rules: AutoWorkflowRule[]): AutoWorkflowRule | null {
    for (const label of labels) {
      const matched = rules.find((rule) => rule.label === label);
      if (matched) {
        return matched;
      }
    }
    return null;
  }

  private async syncAndTriggerWorkflows(sourceId: number): Promise<SyncResult> {
    const result: SyncResult = {
      totalFetched: 0,
      newlyCreated: 0,
      workflowsTriggered: 0,
      errors: [],
    };

    if (this.syncingSources.has(sourceId)) {
      console.warn(`[Scheduler] Source ${sourceId} is already syncing, skipping`);
      return result;
    }

    this.syncingSources.add(sourceId);

    try {
      const source = await this.sourceRepository.findById(sourceId);
      if (!source || !source.enabled) {
        console.log(`[Scheduler] Source ${sourceId} not found or disabled, skipping`);
        return result;
      }

      // Parse rules
      let rules: AutoWorkflowRule[] = [];
      if (source.auto_workflow_rules) {
        try {
          rules = JSON.parse(source.auto_workflow_rules);
        } catch {
          console.warn(`[Scheduler] Invalid auto_workflow_rules for source ${sourceId}`);
        }
      }

      // Snapshot existing task external_ids for this source
      const allTasks = await this.taskRepository.findAll();
      const existingExternalIds = new Set(
        allTasks
          .filter((t) => t.source === source.type && t.project_id === source.project_id)
          .map((t) => t.external_id)
          .filter((id): id is string => id != null)
      );

      // Run sync
      const syncedTasks = await this.taskSourceService.sync(String(sourceId));
      result.totalFetched = syncedTasks.length;

      // Identify newly created tasks (external_id not in snapshot)
      const newTasks = syncedTasks.filter(
        (task) => task.external_id && !existingExternalIds.has(task.external_id)
      );
      result.newlyCreated = newTasks.length;

      if (newTasks.length > 0 && rules.length > 0) {
        console.log(`[Scheduler] Source ${sourceId}: ${newTasks.length} new tasks, matching against ${rules.length} rules`);

        for (const task of newTasks) {
          const taskLabels = task.labels || [];
          const matchedRule = this.matchRule(taskLabels, rules);

          if (matchedRule) {
            try {
              await this.taskService.startTask(task.id, {
                workflow_template_id: matchedRule.template_id,
              });
              result.workflowsTriggered++;
              console.log(`[Scheduler] Started workflow '${matchedRule.template_id}' for task ${task.id} (label: ${matchedRule.label})`);
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              result.errors.push(`Task ${task.id}: ${message}`);
              console.warn(`[Scheduler] Failed to start workflow for task ${task.id}: ${message}`);
            }
          }
        }
      } else {
        console.log(`[Scheduler] Source ${sourceId}: ${syncedTasks.length} fetched, ${newTasks.length} new, ${rules.length} rules`);
      }

      // Update last_scheduled_sync_at
      await this.sourceRepository.update(sourceId, {
        last_scheduled_sync_at: new Date().toISOString(),
      } as unknown as Partial<import('../types/entities.js').TaskSourceEntity>);

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Sync failed: ${message}`);
      console.error(`[Scheduler] Error syncing source ${sourceId}:`, message);
    } finally {
      this.syncingSources.delete(sourceId);
    }

    return result;
  }
}

export { SchedulerService };
export type { AutoWorkflowRule, SyncResult, JobStatus };
