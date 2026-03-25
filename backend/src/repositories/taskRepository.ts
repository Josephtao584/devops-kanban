import { BaseRepository } from './base.js';
import type { BaseEntity } from './base.js';
import type { TaskEntity } from '../types/entities.ts';
import type { TaskCreateRecord, TaskUpdateRecord } from '../types/persistence/tasks.js';

interface StoredTaskEntity extends TaskEntity, BaseEntity {}

interface TaskStatusCounts {
  REQUIREMENTS: number;
  TODO: number;
  IN_PROGRESS: number;
  DONE: number;
  BLOCKED: number;
  CANCELLED: number;
}

class TaskRepository extends BaseRepository<StoredTaskEntity, TaskCreateRecord, TaskUpdateRecord> {
  constructor(storagePath?: string) {
    super('tasks.json', storagePath ? { storagePath } : undefined);
  }

  async findByProject(projectId: number): Promise<StoredTaskEntity[]> {
    const data = await this._loadAll();
    return data.filter((item) => item.project_id === projectId);
  }

  async findByProjectAndStatus(projectId: number, status: string): Promise<StoredTaskEntity[]> {
    const data = await this._loadAll();
    return data.filter((item) => item.project_id === projectId && item.status === status);
  }

  async countByProject(projectId: number): Promise<TaskStatusCounts> {
    const tasks = await this.findByProject(projectId);
    const counts: TaskStatusCounts = {
      REQUIREMENTS: 0,
      TODO: 0,
      IN_PROGRESS: 0,
      DONE: 0,
      BLOCKED: 0,
      CANCELLED: 0,
    };

    for (const task of tasks) {
      const status = task.status as keyof TaskStatusCounts;
      if (status in counts) {
        counts[status]++;
      }
    }

    return counts;
  }

  async deleteByProject(projectId: number): Promise<number> {
    const data = await this._loadAll();
    const initialLength = data.length;
    const filtered = data.filter((item) => item.project_id !== projectId);
    await this._saveAll(filtered);
    return initialLength - filtered.length;
  }

  async findByStatus(status: string): Promise<StoredTaskEntity[]> {
    const data = await this._loadAll();
    return data.filter((item) => item.status === status);
  }

  async groupByStatus(projectId: number): Promise<Record<keyof TaskStatusCounts, StoredTaskEntity[]>> {
    const tasks = await this.findByProject(projectId);
    const grouped: Record<keyof TaskStatusCounts, StoredTaskEntity[]> = {
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

  async findByIteration(iterationId: number): Promise<StoredTaskEntity[]> {
    const data = await this._loadAll();
    return data.filter((item) => item.iteration_id === iterationId);
  }

  async clearIteration(iterationId: number): Promise<number> {
    const data = await this._loadAll();
    const now = new Date().toISOString();
    let updatedCount = 0;

    const nextData = data.map((item) => {
      if (item.iteration_id !== iterationId) {
        return item;
      }

      updatedCount += 1;
      return {
        ...item,
        iteration_id: null,
        updated_at: now,
      };
    });

    if (updatedCount > 0) {
      await this._saveAll(nextData);
    }

    return updatedCount;
  }

  async deleteByIteration(iterationId: number): Promise<number> {
    const data = await this._loadAll();
    const filtered = data.filter((item) => item.iteration_id !== iterationId);
    const deletedCount = data.length - filtered.length;

    if (deletedCount > 0) {
      await this._saveAll(filtered);
    }

    return deletedCount;
  }

  async findByProjectAndIteration(projectId: number, iterationId: number | null | undefined): Promise<StoredTaskEntity[]> {
    const tasks = await this.findByProject(projectId);
    if (iterationId === null || iterationId === undefined) {
      return tasks.filter((task) => !task.iteration_id);
    }
    return tasks.filter((task) => task.iteration_id === iterationId);
  }
}

export { TaskRepository };
export type { TaskStatusCounts, StoredTaskEntity };
