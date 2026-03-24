import api from './index.js'

// Git API - named exports

// ==================== Worktree Management ====================

/**
 * List all worktrees for a project
 */
export const listWorktrees = (projectId) =>
  api.get('/git/worktrees', { params: { projectId } })

/**
 * Get worktree status for a specific task
 */
export const getWorktreeStatus = (projectId, taskId) =>
  api.get(`/git/worktrees/${taskId}`, { params: { projectId } })

/**
 * Prune stale worktree references
 */
export const pruneWorktrees = (projectId) =>
  api.post('/git/worktrees/prune', null, { params: { projectId } })

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
 * Create a new branch
 */
export const createBranch = (projectId, name, startPoint = null) =>
  api.post('/git/branches', null, {
    params: { projectId, name, startPoint }
  })

/**
 * Delete a branch
 */
export const deleteBranch = (projectId, branchName, force = false) =>
  api.delete(`/git/branches/${branchName}`, {
    params: { projectId, force }
  })

/**
 * Merge a branch
 */
export const mergeBranch = (projectId, source, target) =>
  api.post(`/git/branches/${source}/merge/${target}`, null, {
    params: { projectId }
  })

// ==================== Remote Operations ====================

/**
 * List remote repositories
 */
export const listRemotes = (projectId) =>
  api.get('/git/remotes', { params: { projectId } })

/**
 * Add a remote repository
 */
export const addRemote = (projectId, name, url) =>
  api.post('/git/remotes', null, {
    params: { projectId, name, url }
  })

/**
 * Remove a remote repository
 */
export const removeRemote = (projectId, name) =>
  api.delete(`/git/remotes/${name}`, { params: { projectId } })

/**
 * Push changes to remote
 */
export const push = (projectId, taskId, { remote = 'origin', setUpstream = false } = {}) =>
  api.post(`/git/worktrees/${taskId}/push`, { remote, setUpstream }, { params: { projectId } })

/**
 * Pull changes from remote
 */
export const pull = (projectId, taskId, { remote = 'origin' } = {}) =>
  api.post(`/git/worktrees/${taskId}/pull`, { remote }, { params: { projectId } })

// ==================== Status Query ====================

/**
 * Get detailed Git status
 */
export const getStatus = (projectId, taskId) =>
  api.get(`/git/worktrees/${taskId}/status`, { params: { projectId } })

/**
 * Get uncommitted diff for a worktree
 */
export const getDiff = (projectId, taskId) =>
  api.get(`/git/worktrees/${taskId}/diff`, {
    params: { projectId }
  })

/**
 * Get commit history
 */
export const getLog = (projectId, taskId, limit = 10) =>
  api.get(`/git/worktrees/${taskId}/log`, {
    params: { projectId, limit }
  })

// Legacy diff endpoint
export const getDiffLegacy = (projectId, source, target) =>
  api.get('/git/diff', { params: { projectId, source, target } })
