import { ProjectRepository } from '../repositories/projectRepository.js';
import { TaskRepository } from '../repositories/taskRepository.js';

class ProjectService {
  projectRepo: ProjectRepository;
  taskRepo: TaskRepository;

  constructor() {
    this.projectRepo = new ProjectRepository();
    this.taskRepo = new TaskRepository();
  }

  async getAll() {
    return await this.projectRepo.findAll();
  }

  async getById(projectId: number) {
    return await this.projectRepo.findById(projectId);
  }

  async getWithStats(projectId: number) {
    return await this.projectRepo.findByIdWithStats(projectId);
  }

  async create(projectData: Record<string, unknown>) {
    return await this.projectRepo.create(projectData);
  }

  async update(projectId: number, projectData: Record<string, unknown>) {
    return await this.projectRepo.update(projectId, projectData);
  }

  async delete(projectId: number) {
    await this.taskRepo.deleteByProject(projectId);
    return await this.projectRepo.delete(projectId);
  }

  async exists(projectId: number) {
    return await this.projectRepo.exists(projectId);
  }
}

export { ProjectService };
