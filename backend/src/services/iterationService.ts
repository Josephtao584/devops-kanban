import { IterationRepository } from '../repositories/iterationRepository.js';
import { ProjectRepository } from '../repositories/projectRepository.js';
import { TaskRepository } from '../repositories/taskRepository.js';

import type { CreateIterationInput, UpdateIterationInput } from '../types/dto/iterations.js';
import type { IterationCreateRecord, IterationUpdateRecord } from '../types/persistence/iterations.js';

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

  async getByIdWithStats(iterationId: number) {
    return await this.iterationRepo.findByIdWithStats(iterationId);
  }

  async getById(iterationId: number) {
    return await this.iterationRepo.findById(iterationId);
  }

  async getTasks(iterationId: number) {
    return await this.iterationRepo.findTasks(iterationId);
  }

  async create(iterationData: CreateIterationInput) {
    if (!iterationData.name || !iterationData.name.trim()) {
      const error = new Error('迭代名称不能为空') as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }

    if (!iterationData.project_id) {
      const error = new Error('项目 ID 不能为空') as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }

    const projectExists = await this.projectRepo.exists(iterationData.project_id);
    if (!projectExists) {
      const error = new Error('项目不存在') as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }

    if (!iterationData.status) {
      iterationData.status = 'PLANNED';
    }

    const createData: IterationCreateRecord = {
      project_id: iterationData.project_id,
    };
    if (iterationData.name !== undefined) {
      createData.name = iterationData.name;
    }
    if (iterationData.status !== undefined) {
      createData.status = iterationData.status;
    }
    return await this.iterationRepo.create(createData);
  }

  async update(iterationId: number, iterationData: UpdateIterationInput) {
    const updateData: IterationUpdateRecord = {};
    if (iterationData.project_id !== undefined) {
      updateData.project_id = iterationData.project_id;
    }
    if (iterationData.name !== undefined) {
      updateData.name = iterationData.name;
    }
    if (iterationData.status !== undefined) {
      updateData.status = iterationData.status;
    }
    return await this.iterationRepo.update(iterationId, updateData);
  }

  async updateStatus(iterationId: number, status: string) {
    return await this.iterationRepo.update(iterationId, { status });
  }

  async delete(iterationId: number) {
    const exists = await this.iterationRepo.exists(iterationId);
    if (!exists) {
      return false;
    }

    await this.taskRepo.clearIteration(iterationId);
    return await this.iterationRepo.delete(iterationId);
  }

  async exists(iterationId: number) {
    return await this.iterationRepo.exists(iterationId);
  }
}

export { IterationService };
