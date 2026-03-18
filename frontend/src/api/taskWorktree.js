import api from './index.js'

// Task Worktree API
export const createTaskWorktree = (taskId) => api.post(`/tasks/${taskId}/worktree`)
export const deleteTaskWorktree = (taskId) => api.delete(`/tasks/${taskId}/worktree`)
export const getTaskWorktreeStatus = (taskId) => api.get(`/tasks/${taskId}/worktree`)