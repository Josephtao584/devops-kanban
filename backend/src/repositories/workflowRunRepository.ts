import { BaseRepository } from './base.js';
import type { BaseEntity } from './base.js';
import type { WorkflowRunEntity, WorkflowStepEntity } from '../types/entities.ts';

type CreateWorkflowRunRecord = Omit<WorkflowRunEntity, 'id'>;
type UpdateWorkflowRunRecord = Partial<Omit<WorkflowRunEntity, 'id'>>;
type UpdateWorkflowStepRecord = Partial<Omit<WorkflowStepEntity, 'step_id' | 'name'>>;

interface StoredWorkflowRunEntity extends WorkflowRunEntity, BaseEntity {}

class WorkflowRunRepository extends BaseRepository<StoredWorkflowRunEntity, CreateWorkflowRunRecord, UpdateWorkflowRunRecord> {
  constructor() {
    super('workflow_runs.json');
  }

  async findByTaskId(taskId: number): Promise<StoredWorkflowRunEntity | null> {
    const data = await this._loadAll();
    return data.find((item) => item.task_id === taskId) || null;
  }

  async findAllByTaskId(taskId: number): Promise<StoredWorkflowRunEntity[]> {
    const data = await this._loadAll();
    return data.filter((item) => item.task_id === taskId);
  }

  async updateStep(runId: number, stepId: string, stepUpdate: UpdateWorkflowStepRecord): Promise<StoredWorkflowRunEntity | null> {
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

    run.steps[stepIndex] = {
      ...run.steps[stepIndex],
      ...stepUpdate,
    } as WorkflowStepEntity;
    run.updated_at = new Date().toISOString();
    data[index] = run;

    await this._saveAll(data);
    return run;
  }
}

export { WorkflowRunRepository };
export type { StoredWorkflowRunEntity, CreateWorkflowRunRecord, UpdateWorkflowRunRecord, UpdateWorkflowStepRecord };
