import { BaseRepository } from './base.js';
import { withRetry } from '../db/retry.js';
import type { Client } from '@libsql/client';
import type { WorkflowRunEntity, WorkflowStepEntity } from '../types/entities.ts';
import { logger } from '../utils/logger.js';
import { safeJsonParse } from '../utils/safeJson.js';

type UpdateWorkflowStepRecord = Partial<Omit<WorkflowStepEntity, 'step_id' | 'name'>>;

class WorkflowRunRepository extends BaseRepository<WorkflowRunEntity> {
  private mutationQueue: Promise<unknown> = Promise.resolve();

  constructor(client?: Client) {
    super('workflow_runs');
    if (client) {
      // Override the default singleton client (used in tests).
      this.client = client;
    }
  }

  private async serializeMutation<T>(operation: () => Promise<T>): Promise<T> {
    try {
      const next = this.mutationQueue.then(operation, operation);
      this.mutationQueue = next.then(() => undefined, () => undefined);
      return await next;
    } catch (error) {
      // 重置队列以防止卡死
      this.mutationQueue = Promise.resolve();
      logger.error('WorkflowRunRepository', `Mutation queue error, resetting: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  protected override parseRow(row: Record<string, unknown>): WorkflowRunEntity {
    return this.mapRowToEntity(row);
  }

  private mapRowToEntity(row: Record<string, unknown>): WorkflowRunEntity {
    return {
      ...row,
      steps: safeJsonParse(row.steps, [] as unknown[], 'workflow_runs.steps'),
      context: safeJsonParse(row.context, {} as Record<string, unknown>, 'workflow_runs.context'),
      parent_run_id: row.parent_run_id == null ? null : Number(row.parent_run_id),
      iteration: Number(row.iteration ?? 1),
      looped_from_step_id: row.looped_from_step_id ? String(row.looped_from_step_id) : null,
      loop_failure_context: safeJsonParse(row.loop_failure_context, null, 'workflow_runs.loop_failure_context'),
      loop_trigger_error: row.loop_trigger_error == null ? null : String(row.loop_trigger_error),
    } as WorkflowRunEntity;
  }

  /**
   * 为 steps 附加 agent_id（从 sessions 表获取）
   */
  private async enrichStepsWithAgentId(steps: WorkflowStepEntity[]): Promise<WorkflowStepEntity[]> {
    const sessionIds = [...new Set(steps.filter(s => s.session_id).map(s => s.session_id!))];
    if (sessionIds.length === 0) return steps;

    const sessionResult = await this.client.execute({
      sql: 'SELECT id, agent_id FROM sessions WHERE id IN (' + sessionIds.map(() => '?').join(',') + ')',
      args: sessionIds,
    });

    const agentIdBySessionId = new Map(
      sessionResult.rows.map(r => [r.id as number, ((r as Record<string, unknown>).agent_id ?? null) as number | null])
    );

    return steps.map(step => {
      if (step.session_id && agentIdBySessionId.has(step.session_id)) {
        return { ...step, agent_id: agentIdBySessionId.get(step.session_id)! };
      }
      return step;
    });
  }

  override async findById(entityId: number): Promise<WorkflowRunEntity | null> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM workflow_runs WHERE id = ?',
      args: [entityId],
    });
    if (result.rows.length === 0) return null;
    const run = this.parseRow(result.rows[0] as Record<string, unknown>);
    run.steps = await this.enrichStepsWithAgentId(run.steps);
    return run;
  }

  protected override serializeRow(entity: Partial<WorkflowRunEntity>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...entity };
    if (entity.steps !== undefined) {
      result.steps = JSON.stringify(entity.steps);
    }
    if (entity.context !== undefined) {
      result.context = JSON.stringify(entity.context);
    }
    if (entity.loop_failure_context !== undefined) {
      result.loop_failure_context = entity.loop_failure_context === null
        ? null
        : JSON.stringify(entity.loop_failure_context);
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

  async deleteByTaskId(taskId: number): Promise<void> {
    await withRetry(() => this.client.execute({
      sql: 'DELETE FROM workflow_runs WHERE task_id = ?',
      args: [taskId],
    }));
  }

  async countRunningByTaskIds(taskIds: number[]): Promise<number> {
    if (taskIds.length === 0) return 0;
    const placeholders = taskIds.map(() => '?').join(',');
    const result = await this.client.execute({
      sql: `SELECT COUNT(*) as count FROM workflow_runs WHERE task_id IN (${placeholders}) AND status IN ('RUNNING', 'PENDING', 'SUSPENDED')`,
      args: taskIds,
    });
    return Number(result.rows[0]?.count || 0);
  }

  async countActive(): Promise<number> {
    const result = await this.client.execute(
      "SELECT COUNT(*) as count FROM workflow_runs WHERE status IN ('RUNNING', 'PENDING', 'SUSPENDED')"
    );
    return Number(result.rows[0]?.count || 0);
  }

  async findAllByTaskId(taskId: number): Promise<WorkflowRunEntity[]> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM workflow_runs WHERE task_id = ?',
      args: [taskId],
    });
    return result.rows.map(row => this.parseRow(row as Record<string, unknown>));
  }

  async findAllByTaskIdOrdered(taskId: number): Promise<WorkflowRunEntity[]> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM workflow_runs WHERE task_id = ? ORDER BY iteration ASC, id ASC',
      args: [taskId],
    });
    const runs = result.rows.map(row => this.mapRowToEntity(row as Record<string, unknown>));
    for (const run of runs) {
      run.steps = await this.enrichStepsWithAgentId(run.steps);
    }
    return runs;
  }

  async findInFlightChild(parentRunId: number): Promise<WorkflowRunEntity | null> {
    const result = await this.client.execute({
      sql: `SELECT * FROM workflow_runs
            WHERE parent_run_id = ? AND status IN ('PENDING', 'RUNNING', 'SUSPENDED')
            ORDER BY id DESC LIMIT 1`,
      args: [parentRunId],
    });
    return result.rows.length > 0
      ? this.mapRowToEntity(result.rows[0] as Record<string, unknown>)
      : null;
  }

  /**
   * Atomically check for active runs and create a new one if none exist.
   * Uses the serialization queue to prevent race conditions where two
   * concurrent calls both see no active run and both create one.
   */
  async createIfNoActiveRun(payload: {
    task_id: number;
    workflow_instance_id: string;
    mastra_run_id?: string | null;
    status: string;
    current_step: string | null;
    steps: unknown;
    worktree_path: string;
    branch: string;
    context: Record<string, unknown>;
    parent_run_id?: number | null;
    iteration?: number;
    looped_from_step_id?: string | null;
    loop_failure_context?: { failed_step_id: string; error: string; summary: string | null } | null;
  }): Promise<{ created: WorkflowRunEntity; existing: null } | { created: null; existing: WorkflowRunEntity }> {
    return this.serializeMutation(async () => {
      // For loop runs, check in-flight children of the same parent first,
      // inside the mutation queue, so two concurrent loop attempts cannot
      // both pass a soft pre-check and race past each other. The task_id
      // check below also catches this (since loop children share the
      // parent's task_id), but checking parent_run_id lets the caller emit
      // a loop-specific error message instead of a generic one.
      if (payload.parent_run_id != null) {
        const childResult = await this.client.execute({
          sql: `SELECT * FROM workflow_runs
                WHERE parent_run_id = ? AND status IN ('PENDING', 'RUNNING', 'SUSPENDED')
                ORDER BY id DESC LIMIT 1`,
          args: [payload.parent_run_id],
        });
        if (childResult.rows.length > 0) {
          const existing = this.parseRow(childResult.rows[0] as Record<string, unknown>);
          return { created: null, existing };
        }
      }

      const activeResult = await this.client.execute({
        sql: "SELECT * FROM workflow_runs WHERE task_id = ? AND status IN ('RUNNING', 'PENDING', 'SUSPENDED') ORDER BY created_at DESC, id DESC LIMIT 1",
        args: [payload.task_id],
      });

      if (activeResult.rows.length > 0) {
        const existing = this.parseRow(activeResult.rows[0] as Record<string, unknown>);
        return { created: null, existing };
      }

      const now = new Date().toISOString();
      const serializedSteps = JSON.stringify(payload.steps);
      const serializedContext = JSON.stringify(payload.context);
      const serializedLoopContext = payload.loop_failure_context
        ? JSON.stringify(payload.loop_failure_context)
        : null;

      const insertResult = await this.client.execute({
        sql: `INSERT INTO workflow_runs (
                task_id, workflow_instance_id, mastra_run_id, status, current_step, steps,
                worktree_path, branch, context,
                parent_run_id, iteration, looped_from_step_id, loop_failure_context, loop_trigger_error,
                created_at, updated_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          payload.task_id,
          payload.workflow_instance_id,
          payload.mastra_run_id ?? null,
          payload.status,
          payload.current_step ?? null,
          serializedSteps,
          payload.worktree_path,
          payload.branch,
          serializedContext,
          payload.parent_run_id ?? null,
          payload.iteration ?? 1,
          payload.looped_from_step_id ?? null,
          serializedLoopContext,
          null,
          now,
          now,
        ],
      });

      const created = await this.findById(Number(insertResult.lastInsertRowid));
      if (!created) {
        throw new Error(`Failed to fetch created workflow run with id ${insertResult.lastInsertRowid}`);
      }
      return { created, existing: null };
    });
  }

  override async update(
    runId: number,
    entityData: {
      status?: string;
      current_step?: string | null;
      context?: Record<string, unknown>;
      mastra_run_id?: string;
      parent_run_id?: number | null;
      iteration?: number;
      looped_from_step_id?: string | null;
      loop_failure_context?:
        | { failed_step_id: string; error: string; summary: string | null }
        | null;
      loop_trigger_error?: string | null;
    },
  ): Promise<WorkflowRunEntity | null> {
    return this.serializeMutation(async () => {
      return super.update(runId, entityData);
    });
  }

  async updateStep(runId: number, stepId: string, stepUpdate: UpdateWorkflowStepRecord): Promise<WorkflowRunEntity | null> {
    return this.serializeMutation(async () => {
      const txn = await this.client.transaction('write');
      let committed = false;
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
        committed = true;
        return { ...run, steps, updated_at: now };
      } catch (error) {
        if (!committed) {
          try {
            await txn.rollback();
          } catch {
            // rollback may fail if the txn is already closed/aborted
          }
        }
        throw error;
      } finally {
        try {
          txn.close();
        } catch {
          // close may throw if already closed
        }
      }
    });
  }
}

export { WorkflowRunRepository };
export const sharedWorkflowRunRepo = new WorkflowRunRepository();
export type { UpdateWorkflowStepRecord };
