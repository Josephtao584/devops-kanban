import { ProjectRepository } from '../repositories/projectRepository.js';
import { TaskRepository } from '../repositories/taskRepository.js';

import type { CreateProjectInput, UpdateProjectInput } from '../types/dto/projects.js';
import type { ProjectCreateRecord, ProjectUpdateRecord } from '../types/persistence/projects.js';

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

  async create(projectData: CreateProjectInput) {
    const createData: ProjectCreateRecord = {
      name: projectData.name,
    };
    if (projectData.description !== undefined) {
      createData.description = projectData.description;
    }
    if (projectData.git_url !== undefined) {
      createData.git_url = projectData.git_url;
    }
    if (projectData.local_path !== undefined) {
      createData.local_path = projectData.local_path;
    }
    return await this.projectRepo.create(createData);
  }

  async update(projectId: number, projectData: UpdateProjectInput) {
    const updateData: ProjectUpdateRecord = {};
    if (projectData.name !== undefined) {
      updateData.name = projectData.name;
    }
    if (projectData.description !== undefined) {
      updateData.description = projectData.description;
    }
    if (projectData.git_url !== undefined) {
      updateData.git_url = projectData.git_url;
    }
    if (projectData.local_path !== undefined) {
      updateData.local_path = projectData.local_path;
    }
    return await this.projectRepo.update(projectId, updateData);
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
