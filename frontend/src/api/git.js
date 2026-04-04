import api from './index.js'

// Git API - named exports

// ==================== Commit Operations ====================

/**
 * Commit changes in a worktree
 */
export const commit = (projectId, taskId, { message, addAll = true, files = [], authorName, authorEmail }) =>
  api.post(`/git/worktrees/${taskId}/commit`, { message, addAll, files, authorName, authorEmail }, { params: { projectId } })

/**
 * Get uncommitted changes in a worktree
 */
export const getUncommittedChanges = (projectId, taskId) =>
  api.get(`/git/worktrees/${taskId}/changes`, { params: { projectId } })

// ==================== Branch Management ====================

/**
 * List all branches with detailed information
 */
export const listBranches = (projectId) =>
  api.get('/git/branches', { params: { projectId } })

/**
 * Get uncommitted diff for a worktree
 */
export const getDiff = (projectId, taskId) =>
  api.get(`/git/worktrees/${taskId}/diff`, {
    params: { projectId }
  })

/**
 * Merge source branch into target branch
 */
export const mergeBranch = (projectId, source, target) =>
  api.post(`/git/branches/${encodeURIComponent(source)}/merge/${encodeURIComponent(target)}`, null, { params: { projectId } })
