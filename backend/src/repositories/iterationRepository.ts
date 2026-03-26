import { BaseRepository } from './base.js';
import type { BaseEntity } from './base.js';
import type { IterationCreateRecord, IterationUpdateRecord } from '../types/persistence/iterations.js';
import { TaskRepository, type TaskStatusCounts } from './taskRepository.js';

interface IterationEntity extends BaseEntity {
  project_id: number;
  name?: string;
  description?: string;
  goal?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
}

interface IterationWithStats extends IterationEntity {
  task_count: number;
  done_count: number;
  todo_count: number;
  in_progress_count: number;
  blocked_count: number;
  cancelled_count: number;
  progress: number;
}

class IterationRepository extends BaseRepository<IterationEntity, IterationCreateRecord, IterationUpdateRecord> {
  storagePath?: string;

  constructor(storagePath?: string) {
    super('iterations.json', storagePath ? { storagePath } : undefined);
    this.storagePath = storagePath;
  }

  async findByProject(projectId: number): Promise<IterationEntity[]> {
    const data = await this._loadAll();
    return data.filter((item) => item.project_id === projectId);
  }

  async findByIdWithStats(iterationId: number): Promise<IterationWithStats | null> {
    const iteration = await this.findById(iterationId);
    if (!iteration) {
      return null;
    }

    const taskRepo = new TaskRepository(this.storagePath);
    const tasks = await taskRepo.findByProject(iteration.project_id);
    const iterationTasks = tasks.filter((task) => task.iteration_id === iterationId);

    const counts: TaskStatusCounts = {
      REQUIREMENTS: 0,
      TODO: 0,
      IN_PROGRESS: 0,
      DONE: 0,
      BLOCKED: 0,
      CANCELLED: 0,
    };

    for (const task of iterationTasks) {
      const status = task.status as keyof TaskStatusCounts;
      if (status in counts) {
        counts[status]++;
      }
    }

    const total = iterationTasks.length;
    const done = counts.DONE || 0;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;

    return {
      ...iteration,
      task_count: total,
      done_count: done,
      todo_count: counts.TODO || 0,
      in_progress_count: counts.IN_PROGRESS || 0,
      blocked_count: counts.BLOCKED || 0,
      cancelled_count: counts.CANCELLED || 0,
      progress,
    };
  }

  async findTasks(iterationId: number) {
    const taskRepo = new TaskRepository(this.storagePath);
    const allTasks = await taskRepo.findAll();
    return allTasks.filter((task) => task.iteration_id === iterationId);
  }

  async exists(iterationId: number): Promise<boolean> {
    const iteration = await this.findById(iterationId);
    return iteration !== null;
  }

  async deleteByProject(projectId: number): Promise<number> {
    const data = await this._loadAll();
    const initialLength = data.length;
    const filtered = data.filter((item) => item.project_id !== projectId);
    await this._saveAll(filtered);
    return initialLength - filtered.length;
  }
}

export { IterationRepository };
export type { IterationEntity, IterationWithStats };
