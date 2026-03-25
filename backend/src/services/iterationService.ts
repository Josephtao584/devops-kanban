import { IterationRepository } from '../repositories/iterationRepository.js';
import { ProjectRepository } from '../repositories/projectRepository.js';
import type { CreateIterationInput, UpdateIterationInput } from '../types/dto/iterations.js';

class IterationService {
  iterationRepo: IterationRepository;
  projectRepo: ProjectRepository;

  constructor() {
    this.iterationRepo = new IterationRepository();
    this.projectRepo = new ProjectRepository();
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
    if (!iterationData.name?.trim()) {
      const error: any = new Error('迭代名称不能为空');
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
      goal: iterationData.goal,
      status: iterationData.status || 'PLANNED',
      start_date: iterationData.start_date,
      end_date: iterationData.end_date,
    });
  }

  async update(iterationId: number, iterationData: UpdateIterationInput) {
    return await this.iterationRepo.update(iterationId, iterationData);
  }

  async delete(iterationId: number) {
    return await this.iterationRepo.delete(iterationId);
  }

  async exists(iterationId: number) {
    return await this.iterationRepo.exists(iterationId);
  }
}

export { IterationService };
