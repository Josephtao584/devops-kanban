import { BaseRepository } from './base.js';
import type { TaskEntity } from '../types/entities.ts';
import { safeJsonParse } from '../utils/safeJson.js';
import { withRetry } from '../db/retry.js';

interface TaskStatusCounts {
  REQUIREMENTS: number;
  TODO: number;
  IN_PROGRESS: number;
  DONE: number;
  BLOCKED: number;
  CANCELLED: number;
}

class TaskRepository extends BaseRepository<TaskEntity> {
  constructor() {
    super('tasks');
  }

  protected override parseRow(row: Record<string, unknown>): TaskEntity {
    return {
      ...row,
      labels: row.labels == null ? undefined : safeJsonParse<unknown>(row.labels, undefined, 'tasks.labels'),
      depends_on: safeJsonParse(row.depends_on, [] as unknown[], 'tasks.depends_on'),
    } as TaskEntity;
  }

  protected override serializeRow(entity: Partial<TaskEntity>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...entity };
    if (entity.labels !== undefined) {
      result.labels = JSON.stringify(entity.labels);
    }
    if (entity.depends_on !== undefined) {
      result.depends_on = JSON.stringify(entity.depends_on);
    }
    return result;
  }

  async findByProject(projectId: number): Promise<TaskEntity[]> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM tasks WHERE project_id = ?',
      args: [projectId],
    });
    return result.rows.map(row => this.parseRow(row as Record<string, unknown>));
  }

  async findByProjectAndStatus(projectId: number, status: string): Promise<TaskEntity[]> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM tasks WHERE project_id = ? AND status = ?',
      args: [projectId, status],
    });
    return result.rows.map(row => this.parseRow(row as Record<string, unknown>));
  }

  async countByProject(projectId: number): Promise<TaskStatusCounts> {
    const result = await this.client.execute({
      sql: `SELECT status, COUNT(*) as count FROM tasks WHERE project_id = ? GROUP BY status`,
      args: [projectId],
    });

    const counts: TaskStatusCounts = {
      REQUIREMENTS: 0,
      TODO: 0,
      IN_PROGRESS: 0,
      DONE: 0,
      BLOCKED: 0,
      CANCELLED: 0,
    };

    for (const row of result.rows) {
      const status = row.status as keyof TaskStatusCounts;
      if (status in counts) {
        counts[status] = Number(row.count);
      }
    }

    return counts;
  }

  async deleteByProject(projectId: number): Promise<number> {
    const result = await this.client.execute({
      sql: 'DELETE FROM tasks WHERE project_id = ?',
      args: [projectId],
    });
    return result.rowsAffected;
  }

  async findByStatus(status: string): Promise<TaskEntity[]> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM tasks WHERE status = ?',
      args: [status],
    });
    return result.rows.map(row => this.parseRow(row as Record<string, unknown>));
  }

  async groupByStatus(projectId: number): Promise<Record<keyof TaskStatusCounts, TaskEntity[]>> {
    const tasks = await this.findByProject(projectId);
    const grouped: Record<keyof TaskStatusCounts, TaskEntity[]> = {
      REQUIREMENTS: [],
      TODO: [],
      IN_PROGRESS: [],
      DONE: [],
      BLOCKED: [],
      CANCELLED: [],
    };

    for (const task of tasks) {
      const status = task.status as keyof TaskStatusCounts;
      if (status in grouped) {
        grouped[status].push(task);
      }
    }

    return grouped;
  }

  async findByIteration(iterationId: number): Promise<TaskEntity[]> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM tasks WHERE iteration_id = ?',
      args: [iterationId],
    });
    return result.rows.map(row => this.parseRow(row as Record<string, unknown>));
  }

  async clearIteration(iterationId: number): Promise<number> {
    const now = new Date().toISOString();
    const result = await this.client.execute({
      sql: 'UPDATE tasks SET iteration_id = NULL, updated_at = ? WHERE iteration_id = ?',
      args: [now, iterationId],
    });
    return result.rowsAffected;
  }

  async deleteByIteration(iterationId: number): Promise<number> {
    const result = await this.client.execute({
      sql: 'DELETE FROM tasks WHERE iteration_id = ?',
      args: [iterationId],
    });
    return result.rowsAffected;
  }

  async findByProjectAndIteration(projectId: number, iterationId: number | null | undefined): Promise<TaskEntity[]> {
    if (iterationId === null || iterationId === undefined) {
      const result = await this.client.execute({
        sql: 'SELECT * FROM tasks WHERE project_id = ? AND iteration_id IS NULL',
        args: [projectId],
      });
      return result.rows.map(row => this.parseRow(row as Record<string, unknown>));
    }
    const result = await this.client.execute({
      sql: 'SELECT * FROM tasks WHERE project_id = ? AND iteration_id = ?',
      args: [projectId, iterationId],
    });
    return result.rows.map(row => this.parseRow(row as Record<string, unknown>));
  }

  async findByExternalId(externalId: string): Promise<TaskEntity | null> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM tasks WHERE external_id = ?',
      args: [externalId],
    });
    if (result.rows.length === 0) return null;
    return this.parseRow(result.rows[0] as Record<string, unknown>);
  }

  async findByExternalIdAndProject(externalId: string, projectId: number): Promise<TaskEntity | null> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM tasks WHERE external_id = ? AND project_id = ?',
      args: [externalId, projectId],
    });
    if (result.rows.length === 0) return null;
    return this.parseRow(result.rows[0] as Record<string, unknown>);
  }

  async findDependents(taskId: number): Promise<TaskEntity[]> {
    const result = await this.client.execute({
      sql: `SELECT * FROM tasks WHERE depends_on LIKE ?`,
      args: [`%${taskId}%`],
    });
    return result.rows
      .map(row => this.parseRow(row as Record<string, unknown>))
      .filter(task => (task.depends_on ?? []).includes(taskId));
  }

  async findChildren(parentTaskId: number): Promise<TaskEntity[]> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM tasks WHERE parent_task_id = ?',
      args: [parentTaskId],
    });
    return result.rows.map(row => this.parseRow(row as Record<string, unknown>));
  }

  async batchUpdateDependsOn(updates: Array<{ id: number; depends_on: number[] }>): Promise<void> {
    if (updates.length === 0) return;
    return withRetry(async () => {
      const txn = await this.client.transaction('write');
      let committed = false;
      try {
        const now = new Date().toISOString();
        for (const u of updates) {
          await txn.execute({
            sql: 'UPDATE tasks SET depends_on = ?, updated_at = ? WHERE id = ?',
            args: [JSON.stringify(u.depends_on), now, u.id],
          });
        }
        await txn.commit();
        committed = true;
      } catch (error) {
        if (!committed) {
          try { await txn.rollback(); } catch { /* ignore */ }
        }
        throw error;
      } finally {
        try { txn.close(); } catch { /* ignore */ }
      }
    });
  }
}

export { TaskRepository };
export type { TaskStatusCounts };
export const taskRepository = new TaskRepository();