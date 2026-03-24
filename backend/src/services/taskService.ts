import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

import { TaskRepository } from '../repositories/taskRepository.js';
import { ProjectRepository } from '../repositories/projectRepository.js';
import { WorkflowService } from './workflow/workflowService.js';
import { createWorktree, cleanupWorktree, isGitRepository, sanitizeName } from '../utils/git.js';

import type { ProjectEntity } from '../types/entities.ts';
import type { CreateTaskInput, StartTaskInput, UpdateTaskInput } from '../types/dto/tasks.js';
import type { TaskCreateRecord, TaskUpdateRecord } from '../types/persistence/tasks.js';

interface WorktreeResult {
  worktree_path: string;
  worktree_branch: string;
  worktree_status: string;
}

class TaskService {
  taskRepo: TaskRepository;
  projectRepo: ProjectRepository;
  workflowService: Pick<WorkflowService, 'startWorkflow'>;
  repoRootResolver: () => string;

  constructor({ taskRepo, projectRepo, workflowService, repoRootResolver }: {
    taskRepo?: TaskRepository;
    projectRepo?: ProjectRepository;
    workflowService?: Pick<WorkflowService, 'startWorkflow'>;
    repoRootResolver?: () => string;
  } = {}) {
    this.taskRepo = taskRepo || new TaskRepository();
    this.projectRepo = projectRepo || new ProjectRepository();
    this.workflowService = workflowService || new WorkflowService();
    this.repoRootResolver = repoRootResolver || (() => process.cwd());
  }

  async getAll() {
    return await this.taskRepo.findAll();
  }

  async getById(taskId: number) {
    return await this.taskRepo.findById(taskId);
  }

  async getByProject(projectId: number) {
    return await this.taskRepo.findByProject(projectId);
  }

  async getByProjectAndIteration(projectId: number, iterationId: number | null) {
    return await this.taskRepo.findByProjectAndIteration(projectId, iterationId);
  }

  async getByProjectGrouped(projectId: number) {
    return await this.taskRepo.groupByStatus(projectId);
  }

  async create(taskData: CreateTaskInput) {
    if (!taskData.title || !taskData.title.trim()) {
      const error = new Error('任务标题不能为空') as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }

    if (!taskData.project_id) {
      const error = new Error('项目 ID 不能为空') as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }

    const projectExists = await this.projectRepo.exists(taskData.project_id);
    if (!projectExists) {
      const error = new Error('项目不存在') as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }

    if (!taskData.status) {
      taskData.status = 'TODO';
    }
    if (!taskData.priority) {
      taskData.priority = 'MEDIUM';
    }

    const createData: TaskCreateRecord = {
      title: taskData.title,
      project_id: taskData.project_id,
      status: taskData.status,
      priority: taskData.priority,
    };
    if (taskData.description !== undefined) {
      createData.description = taskData.description;
    }
    if (taskData.assignee !== undefined) {
      createData.assignee = taskData.assignee;
    }
    if (taskData.due_date !== undefined) {
      createData.due_date = taskData.due_date;
    }
    if (taskData.order !== undefined) {
      createData.order = taskData.order;
    }
    if (taskData.external_id !== undefined) {
      createData.external_id = taskData.external_id;
    }
    if (taskData.workflow_run_id !== undefined) {
      createData.workflow_run_id = taskData.workflow_run_id;
    }
    if (taskData.worktree_path !== undefined) {
      createData.worktree_path = taskData.worktree_path;
    }
    if (taskData.worktree_branch !== undefined) {
      createData.worktree_branch = taskData.worktree_branch;
    }
    if (taskData.worktree_status !== undefined) {
      createData.worktree_status = taskData.worktree_status;
    }
    if (taskData.iteration_id !== undefined) {
      createData.iteration_id = taskData.iteration_id;
    }

    return await this.taskRepo.create(createData);
  }

  async update(taskId: number, taskData: UpdateTaskInput) {
    const updateData: TaskUpdateRecord = {};
    if (taskData.title !== undefined) {
      updateData.title = taskData.title;
    }
    if (taskData.description !== undefined) {
      updateData.description = taskData.description;
    }
    if (taskData.project_id !== undefined) {
      updateData.project_id = taskData.project_id;
    }
    if (taskData.status !== undefined) {
      updateData.status = taskData.status;
    }
    if (taskData.priority !== undefined) {
      updateData.priority = taskData.priority;
    }
    if (taskData.assignee !== undefined) {
      updateData.assignee = taskData.assignee;
    }
    if (taskData.due_date !== undefined) {
      updateData.due_date = taskData.due_date;
    }
    if (taskData.order !== undefined) {
      updateData.order = taskData.order;
    }
    if (taskData.external_id !== undefined) {
      updateData.external_id = taskData.external_id;
    }
    if (taskData.workflow_run_id !== undefined) {
      updateData.workflow_run_id = taskData.workflow_run_id;
    }
    if (taskData.worktree_path !== undefined) {
      updateData.worktree_path = taskData.worktree_path;
    }
    if (taskData.worktree_branch !== undefined) {
      updateData.worktree_branch = taskData.worktree_branch;
    }
    if (taskData.worktree_status !== undefined) {
      updateData.worktree_status = taskData.worktree_status;
    }
    if (taskData.iteration_id !== undefined) {
      updateData.iteration_id = taskData.iteration_id;
    }
    return await this.taskRepo.update(taskId, updateData);
  }

  async updateStatus(taskId: number, status: string) {
    return await this.taskRepo.update(taskId, { status });
  }

  async startTask(taskId: number, body?: StartTaskInput) {
    const task = await this.taskRepo.findById(taskId);
    if (!task) {
      const error = new Error('Task not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    if (task.status !== 'TODO' && task.status !== 'IN_PROGRESS') {
      const error = new Error('只有待处理或进行中的任务可以启动') as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }

    await this.taskRepo.update(taskId, { status: 'IN_PROGRESS' });

    try {
      await this.workflowService.startWorkflow(taskId, body?.workflow_template_id);
    } catch (error) {
      await this.taskRepo.update(taskId, { status: 'TODO' });
      throw error;
    }

    return await this.taskRepo.findById(taskId);
  }

  async exists(taskId: number) {
    return (await this.taskRepo.findById(taskId)) !== null;
  }

  async delete(taskId: number) {
    return await this.taskRepo.delete(taskId);
  }

  async getOrCloneRepo(project: ProjectEntity) {
    if (project.local_path && fs.existsSync(project.local_path)) {
      if (!isGitRepository(project.local_path)) {
        throw new Error(`local_path is not a valid git repository: ${project.local_path}`);
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
        console.log(`Cloning ${project.git_url} to ${cloneDir}...`);
        try {
          execSync(`git clone ${project.git_url} .`, {
            cwd: cloneDir,
            encoding: 'utf-8',
            stdio: 'pipe',
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(`Failed to clone repository: ${message}`);
        }
      }
      if (!isGitRepository(cloneDir)) {
        throw new Error(`Failed to clone valid git repository to: ${cloneDir}`);
      }
      return cloneDir;
    }

    throw new Error('Project has neither local_path nor git_url');
  }

  async createWorktree(taskId: number): Promise<WorktreeResult> {
    const task = await this.taskRepo.findById(taskId);
    if (!task) {
      const error = new Error('Task not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    const project = await this.projectRepo.findById(task.project_id) as ProjectEntity | null;
    if (!project) {
      const error = new Error('Project not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    if (!project.git_url && !project.local_path) {
      const error = new Error('Project has no git repository configured') as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }

    try {
      const repoPath = await this.getOrCloneRepo(project);
      const worktreePath = createWorktree(taskId, task.title, project.name, repoPath);
      const safeProjectName = sanitizeName(project.name);
      const branchName = `task/${safeProjectName}/${taskId}`;
      await this.taskRepo.update(taskId, {
        worktree_path: worktreePath,
        worktree_branch: branchName,
        worktree_status: 'created',
      });

      return {
        worktree_path: worktreePath,
        worktree_branch: branchName,
        worktree_status: 'created',
      };
    } catch (error) {
      await this.taskRepo.update(taskId, { worktree_status: 'error' });
      throw error;
    }
  }

  async deleteWorktree(taskId: number) {
    const task = await this.taskRepo.findById(taskId);
    if (!task) {
      const error = new Error('Task not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    if (!task.worktree_path) {
      return { success: true, message: 'No worktree to delete' };
    }

    try {
      const project = await this.projectRepo.findById(task.project_id) as ProjectEntity | null;
      const repoPath = project?.local_path || (project?.git_url ? path.join('/tmp/claude-repos', String(project.id)) : process.cwd());

      let branchName = task.worktree_branch;
      if (!branchName && project) {
        const safeProjectName = sanitizeName(project.name);
        branchName = `task/${safeProjectName}/${taskId}`;
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
      const error = new Error('Task not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    const worktreePath = task.worktree_path;
    const exists = Boolean(worktreePath && fs.existsSync(worktreePath));

    return {
      worktree_path: worktreePath || null,
      worktree_branch: task.worktree_branch || null,
      worktree_status: exists ? 'created' : (task.worktree_status || 'none'),
    };
  }
}

export { TaskService };
