import { BaseRepository } from './base.js';
import type { BaseEntity } from './base.js';
import type { WorkflowRunEntity, WorkflowStepEntity } from '../types/entities.ts';

type CreateWorkflowRunRecord = Omit<WorkflowRunEntity, 'id'>;
type UpdateWorkflowRunRecord = Partial<Omit<WorkflowRunEntity, 'id'>>;
type UpdateWorkflowStepRecord = Partial<Omit<WorkflowStepEntity, 'step_id' | 'name'>>;

interface StoredWorkflowRunEntity extends WorkflowRunEntity, BaseEntity {}

class WorkflowRunRepository extends BaseRepository<StoredWorkflowRunEntity, CreateWorkflowRunRecord, UpdateWorkflowRunRecord> {
  private mutationQueue: Promise<void>;

  constructor({ storagePath }: { storagePath?: string } = {}) {
    super('workflow_runs.json', storagePath ? { storagePath } : {});
    this.mutationQueue = Promise.resolve();
  }

  private async _serializeMutation<T>(mutation: () => Promise<T>): Promise<T> {
    const pendingMutation = this.mutationQueue.then(mutation, mutation);
    this.mutationQueue = pendingMutation.then(() => undefined, () => undefined);
    return await pendingMutation;
  }

  private _shouldPreserveCancelledRun(run: StoredWorkflowRunEntity, runUpdate: UpdateWorkflowRunRecord) {
    return run.status === 'CANCELLED'
      && runUpdate.status !== undefined
      && runUpdate.status !== 'CANCELLED';
  }

  private _shouldPreserveCancelledStep(
    run: StoredWorkflowRunEntity,
    step: WorkflowStepEntity,
    stepUpdate: UpdateWorkflowStepRecord,
  ) {
    return (run.status === 'CANCELLED' || step.status === 'CANCELLED')
      && stepUpdate.status !== undefined
      && stepUpdate.status !== 'CANCELLED';
  }

  async findLatestByTaskId(taskId: number): Promise<StoredWorkflowRunEntity | null> {
    const data = await this._loadAll();
    const taskRuns = data.filter((item) => item.task_id === taskId);

    taskRuns.sort((a, b) => {
      const createdAtDiff = Date.parse(b.created_at) - Date.parse(a.created_at);
      if (!Number.isNaN(createdAtDiff) && createdAtDiff !== 0) {
        return createdAtDiff;
      }
      return b.id - a.id;
    });

    return taskRuns[0] || null;
  }

  async findByTaskId(taskId: number): Promise<StoredWorkflowRunEntity | null> {
    return await this.findLatestByTaskId(taskId);
  }

  async findAllByTaskId(taskId: number): Promise<StoredWorkflowRunEntity[]> {
    const data = await this._loadAll();
    return data.filter((item) => item.task_id === taskId);
  }

  override async findById(entityId: number): Promise<StoredWorkflowRunEntity | null> {
    await this.mutationQueue;
    return await super.findById(entityId);
  }

  override async create(entityData: CreateWorkflowRunRecord): Promise<StoredWorkflowRunEntity> {
    return await this._serializeMutation(async () => {
      const data = await this._loadAll();
      const newId = this._getNextId(data);
      const now = new Date().toISOString();

      const entity = {
        ...entityData,
        id: newId,
        created_at: now,
        updated_at: now,
      } as StoredWorkflowRunEntity;

      data.push(entity);
      await this._saveAll(data);
      return entity;
    });
  }

  override async update(runId: number, runUpdate: UpdateWorkflowRunRecord): Promise<StoredWorkflowRunEntity | null> {
    return await this._serializeMutation(async () => {
      const data = await this._loadAll();
      const index = data.findIndex((item) => item.id === runId);
      if (index === -1) {
        return null;
      }

      const run = data[index]!;
      if (this._shouldPreserveCancelledRun(run, runUpdate)) {
        return run;
      }

      const definedEntries = Object.entries(runUpdate).filter(([, value]) => value !== undefined);
      const updateData = {
        ...Object.fromEntries(definedEntries),
        updated_at: new Date().toISOString(),
      } as Partial<UpdateWorkflowRunRecord> & Pick<BaseEntity, 'updated_at'>;

      data[index] = { ...run, ...updateData } as StoredWorkflowRunEntity;
      await this._saveAll(data);
      return data[index]!;
    });
  }

  async updateStep(runId: number, stepId: string, stepUpdate: UpdateWorkflowStepRecord): Promise<StoredWorkflowRunEntity | null> {
    return await this._serializeMutation(async () => {
      const data = await this._loadAll();
      const index = data.findIndex((item) => item.id === runId);
      if (index === -1) {
        return null;
      }

      const run = data[index]!;
      const stepIndex = run.steps.findIndex((step) => step.step_id === stepId);
      if (stepIndex === -1) {
        return null;
      }

      const step = run.steps[stepIndex]!;
      if (this._shouldPreserveCancelledStep(run, step, stepUpdate)) {
        return run;
      }

      const definedEntries = Object.entries(stepUpdate).filter(([, value]) => value !== undefined);
      const nextRun = {
        ...run,
        steps: [...run.steps],
        updated_at: new Date().toISOString(),
      } as StoredWorkflowRunEntity;

      nextRun.steps[stepIndex] = {
        ...step,
        ...Object.fromEntries(definedEntries),
      } as WorkflowStepEntity;
      data[index] = nextRun;

      await this._saveAll(data);
      return nextRun;
    });
  }
}

export { WorkflowRunRepository };
export type { StoredWorkflowRunEntity, CreateWorkflowRunRecord, UpdateWorkflowRunRecord, UpdateWorkflowStepRecord };
