import { ProjectRepository } from '../repositories/projectRepository.js';
import { TaskRepository } from '../repositories/taskRepository.js';
import { IterationRepository } from '../repositories/iterationRepository.js';
import { TaskSourceRepository } from '../repositories/taskSourceRepository.js';

import type { CreateProjectInput, UpdateProjectInput } from '../types/dto/projects.js';
import type { ProjectCreateRecord, ProjectUpdateRecord } from '../types/persistence/projects.js';

class ProjectService {
  projectRepo: ProjectRepository;
  taskRepo: TaskRepository;
  iterationRepo: IterationRepository;
  taskSourceRepo: TaskSourceRepository;

  constructor() {
    this.projectRepo = new ProjectRepository();
    this.taskRepo = new TaskRepository();
    this.iterationRepo = new IterationRepository();
    this.taskSourceRepo = new TaskSourceRepository();
  }

  async getAll() {
    return await this.projectRepo.findAll();
  }

  async getById(projectId: number) {
    return await this.projectRepo.findById(projectId);
  }

  async getWithStats(projectId: number) {
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      return null;
    }

    const counts = await this.taskRepo.countByProject(projectId);

    return {
      ...project,
      task_count: Object.values(counts).reduce((a, b) => a + b, 0),
      todo_count: counts.TODO || 0,
      in_progress_count: counts.IN_PROGRESS || 0,
      done_count: counts.DONE || 0,
    };
  }

  async create(projectData: CreateProjectInput) {
    return await this.projectRepo.create({
      name: projectData.name,
      description: projectData.description,
      git_url: projectData.git_url,
      local_path: projectData.local_path,
    });
  }

  async update(projectId: number, projectData: UpdateProjectInput) {
    const updateData: Record<string, unknown> = {};
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
    await this.iterationRepo.deleteByProject(projectId);
    await this.taskSourceRepo.deleteByProject(projectId);
    return await this.projectRepo.delete(projectId);
  }

  async exists(projectId: number) {
    return await this.projectRepo.exists(projectId);
  }
}

export { ProjectService };
