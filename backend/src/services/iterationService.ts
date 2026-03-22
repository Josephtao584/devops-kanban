import { IterationRepository } from '../repositories/iterationRepository.js';
import { ProjectRepository } from '../repositories/projectRepository.js';

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

  async create(iterationData: Record<string, unknown> & { name?: string; project_id?: number; status?: string }) {
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

    return await this.iterationRepo.create(iterationData);
  }

  async update(iterationId: number, iterationData: Record<string, unknown>) {
    return await this.iterationRepo.update(iterationId, iterationData);
  }

  async updateStatus(iterationId: number, status: string) {
    return await this.iterationRepo.update(iterationId, { status });
  }

  async delete(iterationId: number) {
    return await this.iterationRepo.delete(iterationId);
  }

  async exists(iterationId: number) {
    return await this.iterationRepo.exists(iterationId);
  }
}

export { IterationService };
