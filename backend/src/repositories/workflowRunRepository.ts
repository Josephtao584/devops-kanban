import { BaseRepository } from './base.js';
import type { WorkflowRunEntity, WorkflowStepEntity } from '../types/entities.ts';

type UpdateWorkflowStepRecord = Partial<Omit<WorkflowStepEntity, 'step_id' | 'name'>>;

class WorkflowRunRepository extends BaseRepository<WorkflowRunEntity> {
  constructor() {
    super('workflow_runs.json');
  }

  async findLatestByTaskId(taskId: number): Promise<WorkflowRunEntity | null> {
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

  async findByTaskId(taskId: number): Promise<WorkflowRunEntity | null> {
    return await this.findLatestByTaskId(taskId);
  }

  async findAllByTaskId(taskId: number): Promise<WorkflowRunEntity[]> {
    const data = await this._loadAll();
    return data.filter((item) => item.task_id === taskId);
  }

  async updateStep(runId: number, stepId: string, stepUpdate: UpdateWorkflowStepRecord): Promise<WorkflowRunEntity | null> {
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
    const definedEntries = Object.entries(stepUpdate).filter(([, value]) => value !== undefined);
    const nextRun = {
      ...run,
      steps: [...run.steps],
      updated_at: new Date().toISOString(),
    } as WorkflowRunEntity;

    nextRun.steps[stepIndex] = {
      ...step,
      ...Object.fromEntries(definedEntries),
    } as WorkflowStepEntity;
    data[index] = nextRun;

    await this._saveAll(data);
    return nextRun;
  }
}

export { WorkflowRunRepository };
export type { UpdateWorkflowStepRecord };