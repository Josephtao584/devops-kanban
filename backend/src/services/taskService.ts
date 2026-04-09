import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

import { TaskRepository } from '../repositories/taskRepository.js';
import { ProjectRepository } from '../repositories/projectRepository.js';
import { AgentRepository } from '../repositories/agentRepository.js';
import { McpServerRepository } from '../repositories/mcpServerRepository.js';
import { WorkflowService } from './workflow/workflowService.js';
import { createWorktree, cleanupWorktree, isGitRepository, sanitizeName } from '../utils/git.js';
import { ensureMcpJsonInWorktree } from '../utils/mcpSync.js';
import { ValidationError, NotFoundError, BusinessError, InternalError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

import type { TaskEntity, ProjectEntity } from '../types/entities.ts';
import type { CreateTaskInput, StartTaskInput, UpdateTaskInput } from '../types/dto/tasks.js';

interface WorktreeResult {
  worktree_path: string;
  worktree_branch: string;
  worktree_status: string;
}

class TaskService {
  taskRepo: TaskRepository;
  projectRepo: ProjectRepository;
  workflowService: WorkflowService;
  repoRootResolver: () => string;

  constructor({ taskRepo, projectRepo, workflowService, repoRootResolver }: {
    taskRepo?: TaskRepository;
    projectRepo?: ProjectRepository;
    workflowService?: WorkflowService;
    repoRootResolver?: () => string;
  } = {}) {
    this.taskRepo = taskRepo || new TaskRepository();
    this.projectRepo = projectRepo || new ProjectRepository();
    this.workflowService = workflowService || new WorkflowService();
    this.repoRootResolver = repoRootResolver || (() => process.cwd());
  }

  private _computeWorktreeStatus(task: TaskEntity | null): TaskEntity | null {
    if (!task) return task;
    if (task.worktree_path && fs.existsSync(task.worktree_path)) {
      task.worktree_status = 'created';
    } else if (task.worktree_path) {
      task.worktree_status = 'none';
    }
    return task;
  }

  private _computeWorktreeStatuses(tasks: TaskEntity[]): TaskEntity[] {
    for (const task of tasks) {
      this._computeWorktreeStatus(task);
    }
    return tasks;
  }

  async getAll() {
    return this._computeWorktreeStatuses(await this.taskRepo.findAll());
  }

  async getById(taskId: number) {
    return this._computeWorktreeStatus(await this.taskRepo.findById(taskId));
  }

  async getByProject(projectId: number) {
    return this._computeWorktreeStatuses(await this.taskRepo.findByProject(projectId));
  }

  async getByProjectAndIteration(projectId: number, iterationId: number | null) {
    return this._computeWorktreeStatuses(await this.taskRepo.findByProjectAndIteration(projectId, iterationId));
  }

  async getByProjectGrouped(projectId: number) {
    const grouped = await this.taskRepo.groupByStatus(projectId);
    for (const tasks of Object.values(grouped)) {
      this._computeWorktreeStatuses(tasks);
    }
    return grouped;
  }

  async create(taskData: CreateTaskInput) {
    if (!taskData.title || !taskData.title.trim()) {
      throw new ValidationError('任务标题不能为空', 'Task title is required');
    }

    if (!taskData.project_id) {
      throw new ValidationError('项目 ID 不能为空', 'Project ID is required');
    }

    const projectExists = await this.projectRepo.exists(taskData.project_id);
    if (!projectExists) {
      throw new NotFoundError('项目不存在', 'Project not found', { projectId: taskData.project_id });
    }

    const createData: Omit<TaskEntity, 'id' | 'created_at' | 'updated_at'> = {
      title: taskData.title,
      description: taskData.description,
      project_id: taskData.project_id,
      status: taskData.status || 'TODO',
      priority: taskData.priority || 'MEDIUM',
      source: 'manual',
    };

    if (taskData.assignee !== undefined) createData.assignee = taskData.assignee;
    if (taskData.due_date !== undefined) createData.due_date = taskData.due_date;
    if (taskData.order !== undefined) createData.order = taskData.order;
    if (taskData.external_id !== undefined) createData.external_id = taskData.external_id;
    if (taskData.workflow_run_id !== undefined) createData.workflow_run_id = taskData.workflow_run_id;
    if (taskData.worktree_path !== undefined) createData.worktree_path = taskData.worktree_path;
    if (taskData.worktree_branch !== undefined) createData.worktree_branch = taskData.worktree_branch;
    if (taskData.iteration_id !== undefined) createData.iteration_id = taskData.iteration_id;

    return await this.taskRepo.create(createData);
  }

  async update(taskId: number, taskData: UpdateTaskInput) {
    return await this.taskRepo.update(taskId, taskData);
  }

  async updateStatus(taskId: number, status: string) {
    return await this.taskRepo.update(taskId, { status });
  }

  async startTask(taskId: number, body: StartTaskInput) {
    const task = await this.taskRepo.findById(taskId);
    if (!task) {
      throw new NotFoundError('未找到任务', 'Task not found', { taskId });
    }

    if (task.status !== 'TODO' && task.status !== 'IN_PROGRESS') {
      throw new BusinessError('只有待处理或进行中的任务可以启动', 'Only TODO or IN_PROGRESS tasks can be started', { taskId, status: task.status });
    }

    await this.taskRepo.update(taskId, { status: 'IN_PROGRESS' });

    try {
      await this.workflowService.startWorkflow(taskId, {
        workflowTemplateId: body.workflow_template_id,
        workflowTemplateSnapshot: body.workflow_template_snapshot
      });
    } catch (error) {
      await this.taskRepo.update(taskId, { status: 'TODO' });
      throw error;
    }

    return this._computeWorktreeStatus(await this.taskRepo.findById(taskId));
  }

  async exists(taskId: number) {
    return (await this.taskRepo.findById(taskId)) !== null;
  }

  async delete(taskId: number, deleteWorktree: boolean = false) {
    if (deleteWorktree) {
      await this.deleteWorktree(taskId);
    }
    await this.workflowService.deleteByTaskId(taskId);
    return await this.taskRepo.delete(taskId);
  }

  async getOrCloneRepo(project: ProjectEntity) {
    if (project.local_path && fs.existsSync(project.local_path)) {
      if (!isGitRepository(project.local_path)) {
        throw new ValidationError('本地路径不是有效的 Git 仓库', `local_path is not a valid git repository: ${project.local_path}`, { projectId: project.id });
      }
      return project.local_path;
    }

    if (project.git_url) {
      const cloneDir = path.join('/tmp/claude-repos', String(project.id));
      if (!fs.existsSync(cloneDir) || !isGitRepository(cloneDir)) {
        if (fs.existsSync(cloneDir)) {
          fs.rmSync(cloneDir, { recursive: true, force: true });
        }
        fs.mkdirSync(cloneDir, { recursive: true });
        logger.info('TaskService', `Cloning ${project.git_url} to ${cloneDir}...`);
        try {
          execSync(`git clone ${project.git_url} .`, {
            cwd: cloneDir,
            encoding: 'utf-8',
            stdio: 'pipe',
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new InternalError('克隆仓库失败', `Failed to clone repository: ${message}`, { projectId: project.id, gitUrl: project.git_url });
        }
      }
      if (!isGitRepository(cloneDir)) {
        throw new InternalError('克隆仓库失败', `Failed to clone valid git repository to: ${cloneDir}`, { projectId: project.id });
      }
      return cloneDir;
    }

    throw new ValidationError('项目未配置本地路径或 Git URL', 'Project has neither local_path nor git_url', { projectId: project.id });
  }

  async createWorktree(taskId: number): Promise<WorktreeResult> {
    const task = await this.taskRepo.findById(taskId);
    if (!task) {
      throw new NotFoundError('未找到任务', 'Task not found', { taskId });
    }

    const project = await this.projectRepo.findById(task.project_id) as ProjectEntity | null;
    if (!project) {
      throw new NotFoundError('未找到项目', 'Project not found', { projectId: task.project_id });
    }

    if (!project.local_path || !fs.existsSync(project.local_path)) {
      throw new ValidationError('项目未配置本地路径或路径不存在，请先在项目设置中添加有效的 local_path', 'Project local_path is not configured or does not exist', { projectId: project.id });
    }

    try {
      const repoPath = await this.getOrCloneRepo(project);
      const worktreePath = createWorktree(taskId, task.title, repoPath);
      const safeTitle = sanitizeName(task.title).substring(0, 50);
      const branchName = `task/${taskId}-${safeTitle}`;
      await this.taskRepo.update(taskId, {
        worktree_path: worktreePath,
        worktree_branch: branchName,
        worktree_status: 'created',
      });

      // Write initial MCP config to worktree based on all agents' MCP servers
      await this._writeMcpToWorktree(worktreePath);

      return {
        worktree_path: worktreePath,
        worktree_branch: branchName,
        worktree_status: 'created',
      };
    } catch (error) {
      await this.taskRepo.update(taskId, { worktree_path: null });
      throw error;
    }
  }

  private async _writeMcpToWorktree(worktreePath: string): Promise<void> {
    try {
      const agentRepo = new AgentRepository();
      const mcpServerRepo = new McpServerRepository();

      const allAgents = await agentRepo.findAll();
      const allServers = await mcpServerRepo.findAll();
      if (allServers.length === 0) return;

      const serverMap = new Map(allServers.map(s => [s.id, s]));
      const seenNames = new Set<string>();
      const mcpConfigs: { name: string; server_type: string; config: Record<string, unknown> }[] = [];

      for (const agent of allAgents) {
        const mcpServerIds: number[] = Array.isArray(agent.mcpServers) ? agent.mcpServers : [];
        for (const id of mcpServerIds) {
          const server = serverMap.get(id);
          if (server && !seenNames.has(server.name)) {
            seenNames.add(server.name);
            mcpConfigs.push({
              name: server.name,
              server_type: server.server_type,
              config: server.config as Record<string, unknown>,
            });
          }
        }
      }

      if (mcpConfigs.length > 0) {
        await ensureMcpJsonInWorktree(mcpConfigs, worktreePath);
      }
    } catch (err) {
      logger.warn('TaskService', `Failed to write MCP config to worktree: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async deleteWorktree(taskId: number) {
    const task = await this.taskRepo.findById(taskId);
    if (!task) {
      throw new NotFoundError('未找到任务', 'Task not found', { taskId });
    }

    if (!task.worktree_path) {
      return { success: true, message: 'No worktree to delete' };
    }

    try {
      const project = await this.projectRepo.findById(task.project_id) as ProjectEntity | null;
      const repoPath = project?.local_path || (project?.git_url ? path.join('/tmp/claude-repos', String(project.id)) : process.cwd());

      let branchName = task.worktree_branch;
      if (!branchName && task.title) {
        const safeTitle = sanitizeName(task.title).substring(0, 50);
        branchName = `task/${taskId}-${safeTitle}`;
      }

      cleanupWorktree(task.worktree_path, repoPath, branchName || null);

      await this.taskRepo.update(taskId, {
        worktree_path: null,
        worktree_branch: null,
        worktree_status: 'none',
      });

      return { success: true, message: 'Worktree deleted' };
    } catch (error) {
      await this.taskRepo.update(taskId, {
        worktree_path: null,
        worktree_branch: null,
        worktree_status: 'none',
      });
      throw error;
    }
  }

  async getWorktreeStatus(taskId: number) {
    const task = await this.taskRepo.findById(taskId);
    if (!task) {
      throw new NotFoundError('未找到任务', 'Task not found', { taskId });
    }

    const worktreePath = task.worktree_path;
    const exists = Boolean(worktreePath && fs.existsSync(worktreePath));

    return {
      worktree_path: worktreePath || null,
      worktree_branch: task.worktree_branch || null,
      worktree_status: exists ? 'created' : 'none',
    };
  }
}

export { TaskService };
