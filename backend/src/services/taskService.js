/**
 * Task Service
 */
import { TaskRepository } from '../repositories/taskRepository.js';
import { ProjectRepository } from '../repositories/projectRepository.js';
import { WorkflowService } from './WorkflowService.js';
import { createWorktree, cleanupWorktree, getWorktreePath, isGitRepository, sanitizeName } from '../utils/git.js';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

class TaskService {
  constructor({ taskRepo, projectRepo, repoRootResolver } = {}) {
    this.taskRepo = taskRepo || new TaskRepository();
    this.projectRepo = projectRepo || new ProjectRepository();
    this.repoRootResolver = repoRootResolver || (() => process.cwd());
  }

  /**
   * Get all tasks
   * @returns {Promise<Array>} All tasks
   */
  async getAll() {
    return await this.taskRepo.findAll();
  }

  /**
   * Get task by ID
   * @param {number} taskId - Task ID
   * @returns {Promise<object|null>} Task or null
   */
  async getById(taskId) {
    return await this.taskRepo.findById(taskId);
  }

  /**
   * Get all tasks for a project
   * @param {number} projectId - Project ID
   * @returns {Promise<Array>} Tasks
   */
  async getByProject(projectId) {
    return await this.taskRepo.findByProject(projectId);
  }

  /**
   * Get tasks for a project and iteration
   * @param {number} projectId - Project ID
   * @param {number|null} iterationId - Iteration ID (null for unassigned)
   * @returns {Promise<Array>} Tasks
   */
  async getByProjectAndIteration(projectId, iterationId) {
    return await this.taskRepo.findByProjectAndIteration(projectId, iterationId);
  }

  /**
   * Get tasks for a project grouped by status
   * @param {number} projectId - Project ID
   * @returns {Promise<object>} Tasks grouped by status
   */
  async getByProjectGrouped(projectId) {
    return await this.taskRepo.groupByStatus(projectId);
  }

  /**
   * Create a new task
   * @param {object} taskData - Task data
   * @returns {Promise<object>} Created task
   */
  async create(taskData) {
    // Validate required fields
    if (!taskData.title || !taskData.title.trim()) {
      const error = new Error('任务标题不能为空');
      error.statusCode = 400;
      throw error;
    }

    if (!taskData.project_id) {
      const error = new Error('项目 ID 不能为空');
      error.statusCode = 400;
      throw error;
    }

    // Verify project exists
    const projectExists = await this.projectRepo.exists(taskData.project_id);
    if (!projectExists) {
      const error = new Error('项目不存在');
      error.statusCode = 400;
      throw error;
    }

    // Set default values
    if (!taskData.status) {
      taskData.status = 'TODO';
    }
    if (!taskData.priority) {
      taskData.priority = 'MEDIUM';
    }

    return await this.taskRepo.create(taskData);
  }

  /**
   * Update a task
   * @param {number} taskId - Task ID
   * @param {object} taskData - Task data to update
   * @returns {Promise<object|null>} Updated task or null
   */
  async update(taskId, taskData) {
    return await this.taskRepo.update(taskId, taskData);
  }

  /**
   * Update task status
   * @param {number} taskId - Task ID
   * @param {string} status - New status
   * @returns {Promise<object|null>} Updated task or null
   */
  async updateStatus(taskId, status) {
    return await this.taskRepo.update(taskId, { status });
  }

  /**
   * Start a task: set status to IN_PROGRESS and launch workflow
   * @param {number} taskId - Task ID
   * @returns {Promise<object>} Updated task with workflow_run_id
   */
  async startTask(taskId) {
    const task = await this.taskRepo.findById(taskId);
    if (!task) {
      const error = new Error('Task not found');
      error.statusCode = 404;
      throw error;
    }

    if (task.status !== 'TODO') {
      const error = new Error('只有待处理的任务可以启动');
      error.statusCode = 400;
      throw error;
    }

    // 1. Update task status to IN_PROGRESS
    await this.taskRepo.update(taskId, { status: 'IN_PROGRESS' });

    // 2. Create and start workflow
    const workflowService = new WorkflowService();
    await workflowService.startWorkflow(taskId);

    // 3. Return updated task
    return await this.taskRepo.findById(taskId);
  }


  /**
   * Check if task exists
   * @param {number} taskId - Task ID
   * @returns {Promise<boolean>} True if exists
   */
  async exists(taskId) {
    return await this.taskRepo.findById(taskId) !== null;
  }

  /**
   * Get or clone repository for a project
   * @param {object} project - Project object
   * @returns {Promise<string>} Repository path
   */
  async getOrCloneRepo(project) {
    // Priority: local_path > git_url
    if (project.local_path && fs.existsSync(project.local_path)) {
      if (!isGitRepository(project.local_path)) {
        throw new Error(`local_path is not a valid git repository: ${project.local_path}`);
      }
      return project.local_path;
    }

    // Clone git_url to temp directory
    if (project.git_url) {
      const cloneDir = path.join('/tmp/claude-repos', String(project.id));
      if (!fs.existsSync(cloneDir) || !isGitRepository(cloneDir)) {
        // Remove invalid directory if exists
        if (fs.existsSync(cloneDir)) {
          fs.rmSync(cloneDir, { recursive: true, force: true });
        }
        fs.mkdirSync(cloneDir, { recursive: true });
        console.log(`Cloning ${project.git_url} to ${cloneDir}...`);
        try {
          execSync(`git clone ${project.git_url} .`, {
            cwd: cloneDir,
            encoding: 'utf-8',
            stdio: 'pipe'
          });
        } catch (error) {
          throw new Error(`Failed to clone repository: ${error.message}`);
        }
      }
      if (!isGitRepository(cloneDir)) {
        throw new Error(`Failed to clone valid git repository to: ${cloneDir}`);
      }
      return cloneDir;
    }

    throw new Error('Project has neither local_path nor git_url');
  }

  /**
   * Create a worktree for a task
   * @param {number} taskId - Task ID
   * @returns {Promise<object>} Worktree info
   */
  async createWorktree(taskId) {
    const task = await this.taskRepo.findById(taskId);
    if (!task) {
      const error = new Error('Task not found');
      error.statusCode = 404;
      throw error;
    }

    const project = await this.projectRepo.findById(task.project_id);
    if (!project) {
      const error = new Error('Project not found');
      error.statusCode = 404;
      throw error;
    }

    if (!project.git_url && !project.local_path) {
      const error = new Error('Project has no git repository configured');
      error.statusCode = 400;
      throw error;
    }

    try {
      // Get or clone the repository
      const repoPath = await this.getOrCloneRepo(project);

      // Create worktree
      const worktreePath = createWorktree(taskId, task.title, project.name, repoPath);

      // Update task with worktree info
      const safeProjectName = sanitizeName(project.name);
      const branchName = `task/${safeProjectName}/${taskId}`;
      await this.taskRepo.update(taskId, {
        worktree_path: worktreePath,
        worktree_branch: branchName,
        worktree_status: 'created'
      });

      return {
        worktree_path: worktreePath,
        worktree_branch: branchName,
        worktree_status: 'created'
      };
    } catch (error) {
      // Update task with error status
      await this.taskRepo.update(taskId, {
        worktree_status: 'error'
      });
      throw error;
    }
  }

  /**
   * Delete a worktree for a task
   * @param {number} taskId - Task ID
   * @returns {Promise<object>} Result
   */
  async deleteWorktree(taskId) {
    const task = await this.taskRepo.findById(taskId);
    if (!task) {
      const error = new Error('Task not found');
      error.statusCode = 404;
      throw error;
    }

    if (!task.worktree_path) {
      return { success: true, message: 'No worktree to delete' };
    }

    try {
      // Get repo path for cleanup
      const project = await this.projectRepo.findById(task.project_id);
      const repoPath = project?.local_path || (project?.git_url ? path.join('/tmp/claude-repos', String(project.id)) : process.cwd());

      // Determine branch name - use stored branch or generate new format
      let branchName = task.worktree_branch;
      if (!branchName && project) {
        const safeProjectName = sanitizeName(project.name);
        branchName = `task/${safeProjectName}/${taskId}`;
      }
      cleanupWorktree(task.worktree_path, repoPath, branchName);

      // Update task
      await this.taskRepo.update(taskId, {
        worktree_path: null,
        worktree_branch: null,
        worktree_status: 'none'
      });

      return { success: true, message: 'Worktree deleted' };
    } catch (error) {
      // Still clear the fields even if cleanup fails
      await this.taskRepo.update(taskId, {
        worktree_path: null,
        worktree_branch: null,
        worktree_status: 'none'
      });
      throw error;
    }
  }

  /**
   * Get worktree status for a task
   * @param {number} taskId - Task ID
   * @returns {Promise<object>} Worktree status
   */
  async getWorktreeStatus(taskId) {
    const task = await this.taskRepo.findById(taskId);
    if (!task) {
      const error = new Error('Task not found');
      error.statusCode = 404;
      throw error;
    }

    const worktreePath = task.worktree_path;
    let exists = false;

    if (worktreePath && fs.existsSync(worktreePath)) {
      exists = true;
    }

    return {
      worktree_path: worktreePath || null,
      worktree_branch: task.worktree_branch || null,
      worktree_status: exists ? 'created' : (task.worktree_status || 'none')
    };
  }
}

export { TaskService };
