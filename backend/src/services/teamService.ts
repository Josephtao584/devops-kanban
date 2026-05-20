import { TeamRepository } from '../repositories/teamRepository.js';
import { projectRepository } from '../repositories/projectRepository.js';
import { taskRepository } from '../repositories/taskRepository.js';
import { ValidationError, ConflictError, NotFoundError } from '../utils/errors.js';
import type { CreateTeamInput, UpdateTeamInput, AddProjectToTeamInput } from '../types/dto/teams.js';

class TeamService {
  private teamRepo: TeamRepository;

  constructor() {
    this.teamRepo = new TeamRepository();
  }

  async getAll() {
    return await this.teamRepo.findAll();
  }

  async getById(teamId: number) {
    return await this.teamRepo.findById(teamId);
  }

  async getWithProjects(teamId: number) {
    const team = await this.teamRepo.findById(teamId);
    if (!team) return null;
    const projects = await this.teamRepo.findProjectsByTeam(teamId);
    return { ...team, projects };
  }

  async create(input: CreateTeamInput) {
    if (!input.name?.trim()) {
      throw new ValidationError('团队名称不能为空', 'Team name is required');
    }
    if (input.name.length > 200) {
      throw new ValidationError('团队名称不能超过 200 个字符', 'Team name exceeds maximum length of 200 characters');
    }
    if (input.description && input.description.length > 5000) {
      throw new ValidationError('团队描述不能超过 5000 个字符', 'Team description exceeds maximum length of 5000 characters');
    }
    return await this.teamRepo.create({
      name: input.name,
      description: input.description,
    });
  }

  async update(teamId: number, input: UpdateTeamInput) {
    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) {
      if (!input.name.trim()) {
        throw new ValidationError('团队名称不能为空', 'Team name is required');
      }
      if (input.name.length > 200) {
        throw new ValidationError('团队名称不能超过 200 个字符', 'Team name exceeds maximum length of 200 characters');
      }
      updateData.name = input.name;
    }
    if (input.description !== undefined) {
      if (input.description.length > 5000) {
        throw new ValidationError('团队描述不能超过 5000 个字符', 'Team description exceeds maximum length of 5000 characters');
      }
      updateData.description = input.description;
    }
    return await this.teamRepo.update(teamId, updateData);
  }

  async delete(teamId: number) {
    const projects = await this.teamRepo.findProjectsByTeam(teamId);
    for (const project of projects) {
      await projectRepository.update(project.id, { team_id: null, repo_role: null });
    }
    return await this.teamRepo.delete(teamId);
  }

  async addProjectToTeam(teamId: number, input: AddProjectToTeamInput) {
    const team = await this.teamRepo.findById(teamId);
    if (!team) {
      throw new NotFoundError('团队不存在', 'Team not found', { teamId });
    }
    const project = await projectRepository.findById(input.project_id);
    if (!project) {
      throw new NotFoundError('项目不存在', 'Project not found', { projectId: input.project_id });
    }
    if (project.team_id && project.team_id !== teamId) {
      throw new ConflictError('该项目已属于其他团队', 'Project already belongs to another team', { projectId: input.project_id });
    }
    if (input.repo_role === 'knowledge') {
      const existingProjects = await this.teamRepo.findProjectsByTeam(teamId);
      const hasKnowledge = existingProjects.some(p => p.repo_role === 'knowledge' && p.id !== input.project_id);
      if (hasKnowledge) {
        throw new ConflictError('团队只能有一个知识仓库', 'A team can only have one knowledge project', { teamId });
      }
    }
    return await projectRepository.update(input.project_id, {
      team_id: teamId,
      repo_role: input.repo_role,
    });
  }

  async removeProjectFromTeam(teamId: number, projectId: number) {
    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundError('项目不存在', 'Project not found', { projectId });
    }
    if (project.team_id !== teamId) {
      throw new ConflictError('该项目不属于此团队', 'Project does not belong to this team', { projectId, teamId });
    }
    return await projectRepository.update(projectId, { team_id: null, repo_role: null });
  }

  async getTeamTasksGrouped(teamId: number) {
    if (!await this.teamRepo.findById(teamId)) {
      throw new NotFoundError('团队不存在', 'Team not found', { teamId });
    }
    const projects = await this.teamRepo.findProjectsByTeam(teamId);
    const grouped: Record<string, any[]> = {
      REQUIREMENTS: [],
      TODO: [],
      IN_PROGRESS: [],
      DONE: [],
      BLOCKED: [],
      CANCELLED: [],
    };
    for (const project of projects) {
      const tasks = await taskRepository.findAll();
      const projectTasks = tasks.filter(t => t.project_id === project.id);
      for (const task of projectTasks) {
        const status = task.status as string;
        if (grouped[status]) {
          grouped[status].push({ ...task, project_name: project.name });
        }
      }
    }
    return grouped;
  }
}

export { TeamService };
