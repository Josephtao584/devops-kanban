import api from './index.js'

// Task Worktree API
export const createTaskWorktree = (taskId) => api.post(`/tasks/${taskId}/worktree`)
export const deleteTaskWorktree = (taskId) => api.delete(`/tasks/${taskId}/worktree`)
export const previewTaskWorktreePath = (taskId, workDir) =>
  api.post(`/tasks/${taskId}/worktree/preview`, { work_dir: workDir || null })
