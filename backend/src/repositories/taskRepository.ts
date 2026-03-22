import { BaseRepository } from './base.js';
import type { BaseEntity } from './base.js';
import type { TaskEntity } from '../types/entities.ts';

interface StoredTaskEntity extends TaskEntity, BaseEntity {}

interface TaskStatusCounts {
  REQUIREMENTS: number;
  TODO: number;
  IN_PROGRESS: number;
  DONE: number;
  BLOCKED: number;
  CANCELLED: number;
}

class TaskRepository extends BaseRepository<StoredTaskEntity, Omit<TaskEntity, 'id'>, Partial<TaskEntity>> {
  constructor() {
    super('tasks.json');
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
