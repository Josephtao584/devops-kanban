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

// ==================== File Editing ====================

/**
 * Get file tree for a task's worktree
 */
export const getFileTree = (projectId, taskId) =>
  api.get(`/git/worktrees/${taskId}/files`, { params: { projectId } })

/**
 * Read file content from a task's worktree
 * @param {Object} [options] - Optional parameters
 * @param {string} [options.version] - 'head' to read the committed version
 */
export const readFileContent = (projectId, taskId, filePath, options = {}) =>
  api.get(`/git/worktrees/${taskId}/files/${encodeURIComponent(filePath)}`, {
    params: {
      projectId,
      ...(options.version ? { version: options.version } : {}),
    },
  })

/**
 * Write file content to a task's worktree
 */
export const writeFileContent = (projectId, taskId, filePath, content) =>
  api.put(`/git/worktrees/${taskId}/files/${encodeURIComponent(filePath)}`, { content }, { params: { projectId } })
