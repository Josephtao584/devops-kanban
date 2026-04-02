import { BaseRepository } from './base.js';
import type { TaskEntity } from '../types/entities.ts';

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
      labels: row.labels ? JSON.parse(row.labels as string) : undefined,
    } as TaskEntity;
  }

  protected override serializeRow(entity: Partial<TaskEntity>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...entity };
    if (entity.labels !== undefined) {
      result.labels = JSON.stringify(entity.labels);
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
}

export { TaskRepository };
export type { TaskStatusCounts };