/**
 * Git Routes - Branch management and Git operations
 */
import { execSync } from 'child_process';
import path from 'path';
import { ProjectRepository } from '../repositories/projectRepository.js';
import { isGitRepository } from '../utils/git.js';
import fs from 'fs';

const projectRepo = new ProjectRepository();

/**
 * Get repository path for a project
 */
async function getRepoPath(projectId) {
  const project = await projectRepo.findById(projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  // Priority: local_path > git_url (cloned to temp)
  if (project.local_path && fs.existsSync(project.local_path)) {
    if (!isGitRepository(project.local_path)) {
      throw new Error(`local_path is not a valid git repository: ${project.local_path}`);
    }
    return project.local_path;
  }

  if (project.git_url) {
    const cloneDir = path.join('/tmp/claude-repos', String(project.id));
    if (fs.existsSync(cloneDir) && isGitRepository(cloneDir)) {
      return cloneDir;
    }
    throw new Error('Repository has not been cloned yet. Please create a worktree first.');
  }

  throw new Error('Project has neither local_path nor git_url');
}

export async function gitRoutes(fastify, options) {
  /**
   * List all branches for a project
   */
  fastify.get('/branches', async (request, reply) => {
    const { projectId } = request.query;

    if (!projectId) {
      reply.code(400);
      return { success: false, message: 'projectId is required' };
    }

    try {
      const repoPath = await getRepoPath(parseInt(projectId));

      // Get local branches
      const localBranchesOutput = execSync('git branch', {
        cwd: repoPath,
        encoding: 'utf-8'
      });

      // Get current branch
      const currentBranchName = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: repoPath,
        encoding: 'utf-8'
      }).trim();

      // Get remote branches
      let remoteBranches = [];
      try {
        const remoteOutput = execSync('git branch -r', {
          cwd: repoPath,
          encoding: 'utf-8'
        });
        remoteBranches = remoteOutput
          .split('\n')
          .map(b => b.trim())
          .filter(b => b && !b.includes('HEAD'));
      } catch (e) {
        // No remote branches
      }

      // Get ahead/behind count for each local branch
      const localBranches = localBranchesOutput
        .split('\n')
        .map(b => b.trim().replace(/^\*/, '').replace(/^\+/, '').trim())
        .filter(b => b);

      const branches = localBranches.map(branchName => {
        const fullName = branchName;
        const isCurrent = branchName === currentBranchName;

        // Try to get ahead/behind count
        let aheadCount = 0;
        let behindCount = 0;
        try {
          const trackingBranch = execSync(`git rev-parse --abbrev-ref ${branchName}@{upstream}`, {
            cwd: repoPath,
            encoding: 'utf-8'
          }).trim();

          if (trackingBranch) {
            const aheadBehind = execSync(`git rev-list --left-right --count ${branchName}...${trackingBranch}`, {
              cwd: repoPath,
              encoding: 'utf-8'
            }).trim().split(/\s+/);

            behindCount = parseInt(aheadBehind[0]) || 0;
            aheadCount = parseInt(aheadBehind[1]) || 0;
          }
        } catch (e) {
          // No tracking branch or other error
        }

        return {
          name: branchName,
          fullName: fullName,
          isCurrent: isCurrent,
          isRemote: false,
          aheadCount,
          behindCount
        };
      });

      // Add remote branches
      remoteBranches.forEach(branchName => {
        branches.push({
          name: branchName.replace('origin/', ''),
          fullName: branchName,
          isCurrent: false,
          isRemote: true,
          aheadCount: 0,
          behindCount: 0
        });
      });

      return {
        success: true,
        data: branches
      };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        message: error.message,
        error: error.message
      };
    }
  });

  /**
   * Create a new branch
   */
  fastify.post('/branches', async (request, reply) => {
    const { projectId, name, startPoint } = request.query;

    if (!projectId || !name) {
      reply.code(400);
      return { success: false, message: 'projectId and name are required' };
    }

    try {
      const repoPath = await getRepoPath(parseInt(projectId));

      const cmd = startPoint
        ? `git branch ${name} ${startPoint}`
        : `git branch ${name}`;

      execSync(cmd, {
        cwd: repoPath,
        encoding: 'utf-8'
      });

      return {
        success: true,
        message: `Branch ${name} created successfully`
      };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        message: error.message,
        error: error.message
      };
    }
  });

  /**
   * Delete a branch
   */
  fastify.delete('/branches/:branchName', async (request, reply) => {
    const { projectId, force } = request.query;
    const { branchName } = request.params;

    if (!projectId) {
      reply.code(400);
      return { success: false, message: 'projectId is required' };
    }

    try {
      const repoPath = await getRepoPath(parseInt(projectId));
      const flag = force === 'true' ? '-D' : '-d';

      execSync(`git branch ${flag} ${branchName}`, {
        cwd: repoPath,
        encoding: 'utf-8'
      });

      return {
        success: true,
        message: `Branch ${branchName} deleted successfully`
      };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        message: error.message,
        error: error.message
      };
    }
  });
}

export default gitRoutes;