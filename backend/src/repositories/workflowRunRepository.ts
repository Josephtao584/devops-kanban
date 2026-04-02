import { BaseRepository } from './base.js';
import type { WorkflowRunEntity, WorkflowStepEntity } from '../types/entities.ts';

type UpdateWorkflowStepRecord = Partial<Omit<WorkflowStepEntity, 'step_id' | 'name'>>;

class WorkflowRunRepository extends BaseRepository<WorkflowRunEntity> {
  private mutationQueue: Promise<unknown> = Promise.resolve();

  constructor() {
    super('workflow_runs');
  }

  private async serializeMutation<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.mutationQueue.then(operation, operation);
    this.mutationQueue = next.then(() => undefined, () => undefined);
    return next;
  }

  protected override parseRow(row: Record<string, unknown>): WorkflowRunEntity {
    return {
      ...row,
      steps: row.steps ? JSON.parse(row.steps as string) : [],
      context: row.context ? JSON.parse(row.context as string) : {},
    } as WorkflowRunEntity;
  }

  protected override serializeRow(entity: Partial<WorkflowRunEntity>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...entity };
    if (entity.steps !== undefined) {
      result.steps = JSON.stringify(entity.steps);
    }
    if (entity.context !== undefined) {
      result.context = JSON.stringify(entity.context);
    }
    return result;
  }

  async findLatestByTaskId(taskId: number): Promise<WorkflowRunEntity | null> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM workflow_runs WHERE task_id = ? ORDER BY created_at DESC, id DESC LIMIT 1',
      args: [taskId],
    });
    if (result.rows.length === 0) return null;
    return this.parseRow(result.rows[0] as Record<string, unknown>);
  }

  async findByTaskId(taskId: number): Promise<WorkflowRunEntity | null> {
    return await this.findLatestByTaskId(taskId);
  }

  async deleteByTaskId(taskId: number): Promise<void> {
    await this.client.execute({
      sql: 'DELETE FROM workflow_runs WHERE task_id = ?',
      args: [taskId],
    });
  }

  async findAllByTaskId(taskId: number): Promise<WorkflowRunEntity[]> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM workflow_runs WHERE task_id = ?',
      args: [taskId],
    });
    return result.rows.map(row => this.parseRow(row as Record<string, unknown>));
  }

  async updateStep(runId: number, stepId: string, stepUpdate: UpdateWorkflowStepRecord): Promise<WorkflowRunEntity | null> {
    return this.serializeMutation(async () => {
      const txn = await this.client.transaction('write');
      try {
        const runResult = await txn.execute({
          sql: 'SELECT * FROM workflow_runs WHERE id = ?',
          args: [runId],
        });
        if (runResult.rows.length === 0) return null;

        const run = this.parseRow(runResult.rows[0] as Record<string, unknown>);
        const steps = [...run.steps] as WorkflowStepEntity[];
        const stepIndex = steps.findIndex(s => s.step_id === stepId);
        if (stepIndex === -1) return null;

        steps[stepIndex] = { ...steps[stepIndex], ...stepUpdate } as WorkflowStepEntity;
        const now = new Date().toISOString();

        await txn.execute({
          sql: 'UPDATE workflow_runs SET steps = ?, updated_at = ? WHERE id = ?',
          args: [JSON.stringify(steps), now, runId],
        });

        await txn.commit();
        return { ...run, steps, updated_at: now };
      } catch (error) {
        await txn.rollback();
        throw error;
      } finally {
        txn.close();
      }
    });
  }
}

export { WorkflowRunRepository };
export type { UpdateWorkflowStepRecord };