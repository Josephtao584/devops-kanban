import { IterationRepository } from '../repositories/iterationRepository.js';
import { ProjectRepository } from '../repositories/projectRepository.js';
import { TaskRepository, type TaskStatusCounts } from '../repositories/taskRepository.js';
import type { IterationEntity } from '../types/entities.ts';
import type { CreateIterationInput, UpdateIterationInput } from '../types/dto/iterations.js';

interface IterationWithStats extends IterationEntity {
  task_count: number;
  done_count: number;
  todo_count: number;
  in_progress_count: number;
  blocked_count: number;
  cancelled_count: number;
  progress: number;
}

class IterationService {
  iterationRepo: IterationRepository;
  projectRepo: ProjectRepository;
  taskRepo: TaskRepository;

  constructor() {
    this.iterationRepo = new IterationRepository();
    this.projectRepo = new ProjectRepository();
    this.taskRepo = new TaskRepository();
  }

  async getByProject(projectId: number) {
    return await this.iterationRepo.findByProject(projectId);
  }

  async getByIdWithStats(iterationId: number): Promise<IterationWithStats | null> {
    const iteration = await this.iterationRepo.findById(iterationId);
    if (!iteration) {
      return null;
    }

    const tasks = await this.taskRepo.findByProject(iteration.project_id);
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

  async getById(iterationId: number) {
    return await this.iterationRepo.findById(iterationId);
  }

  async getTasks(iterationId: number) {
    const allTasks = await this.taskRepo.findAll();
    return allTasks.filter((task) => task.iteration_id === iterationId);
  }

  async create(iterationData: CreateIterationInput) {
    if (!iterationData.name?.trim()) {
      const error: any = new Error('迭代名称不能为空');
      error.statusCode = 400;
      throw error;
    }

    if (!iterationData.project_id) {
      const error: any = new Error('项目 ID 不能为空');
      error.statusCode = 400;
      throw error;
    }

    const projectExists = await this.projectRepo.exists(iterationData.project_id);
    if (!projectExists) {
      const error: any = new Error('项目不存在');
      error.statusCode = 404;
      throw error;
    }

    return await this.iterationRepo.create({
      project_id: iterationData.project_id,
      name: iterationData.name,
      description: iterationData.description,
      goal: iterationData.goal,
      status: iterationData.status || 'PLANNED',
      start_date: iterationData.start_date,
      end_date: iterationData.end_date,
    });
  }

  async update(iterationId: number, iterationData: UpdateIterationInput) {
    const updateData: Record<string, unknown> = {};
    if (iterationData.project_id !== undefined) {
      updateData.project_id = iterationData.project_id;
    }
    if (iterationData.name !== undefined) {
      updateData.name = iterationData.name;
    }
    if (iterationData.description !== undefined) {
      updateData.description = iterationData.description;
    }
    if (iterationData.goal !== undefined) {
      updateData.goal = iterationData.goal;
    }
    if (iterationData.start_date !== undefined) {
      updateData.start_date = iterationData.start_date;
    }
    if (iterationData.end_date !== undefined) {
      updateData.end_date = iterationData.end_date;
    }
    if (iterationData.status !== undefined) {
      updateData.status = iterationData.status;
    }
    return await this.iterationRepo.update(iterationId, updateData);
  }

  async updateStatus(iterationId: number, status: string) {
    return await this.iterationRepo.update(iterationId, { status });
  }

  async delete(iterationId: number, deleteTasks: boolean = false) {
    const iterationExists = await this.iterationRepo.exists(iterationId);
    if (!iterationExists) {
      return false;
    }

    if (deleteTasks) {
      await this.taskRepo.deleteByIteration(iterationId);
    } else {
      await this.taskRepo.clearIteration(iterationId);
    }

    return await this.iterationRepo.delete(iterationId);
  }

  async exists(iterationId: number) {
    return await this.iterationRepo.exists(iterationId);
  }
}

export { IterationService };
