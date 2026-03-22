import { BaseRepository } from './base.js';
import type { BaseEntity } from './base.js';
import type { ProjectCreateRecord, ProjectUpdateRecord } from '../types/persistence/projects.js';
import type { ProjectEntity } from '../types/entities.ts';
import { TaskRepository } from './taskRepository.js';

interface StoredProjectEntity extends ProjectEntity, BaseEntity {}

interface ProjectStats extends StoredProjectEntity {
  task_count: number;
  todo_count: number;
  in_progress_count: number;
  done_count: number;
}

class ProjectRepository extends BaseRepository<StoredProjectEntity, ProjectCreateRecord, ProjectUpdateRecord> {
  constructor() {
    super('projects.json');
  }

  async findByIdWithStats(projectId: number): Promise<ProjectStats | null> {
    const project = await this.findById(projectId);
    if (!project) {
      return null;
    }

    const taskRepo = new TaskRepository();
    const counts = await taskRepo.countByProject(projectId);

    return {
      ...project,
      task_count: Object.values(counts).reduce((a, b) => a + b, 0),
      todo_count: counts.TODO || 0,
      in_progress_count: counts.IN_PROGRESS || 0,
      done_count: counts.DONE || 0,
    };
  }

  async exists(projectId: number): Promise<boolean> {
    const project = await this.findById(projectId);
    return project !== null;
  }
}

export { ProjectRepository };
