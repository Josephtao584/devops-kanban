import { IterationRepository } from '../repositories/iterationRepository.js';
import { ProjectRepository } from '../repositories/projectRepository.js';
import { TaskRepository } from '../repositories/taskRepository.js';

import type { CreateIterationInput, UpdateIterationInput } from '../types/dto/iterations.js';
import type { IterationCreateRecord, IterationUpdateRecord } from '../types/persistence/iterations.js';

class IterationService {
  iterationRepo: IterationRepository;
  projectRepo: ProjectRepository;
  taskRepo: TaskRepository;

  constructor(options: { storagePath?: string } = {}) {
    this.iterationRepo = new IterationRepository(options.storagePath);
    this.projectRepo = new ProjectRepository(options.storagePath);
    this.taskRepo = new TaskRepository(options.storagePath);
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
      error.statusCode = 400;
      throw error;
    }

    const createData: IterationCreateRecord = {
      project_id: iterationData.project_id,
      status: iterationData.status || 'PLANNED',
    };
    if (iterationData.name !== undefined) {
      createData.name = iterationData.name;
    }
    if (iterationData.description !== undefined) {
      createData.description = iterationData.description;
    }
    if (iterationData.goal !== undefined) {
      createData.goal = iterationData.goal;
    }
    if (iterationData.start_date !== undefined) {
      createData.start_date = iterationData.start_date;
    }
    if (iterationData.end_date !== undefined) {
      createData.end_date = iterationData.end_date;
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
