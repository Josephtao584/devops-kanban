import api from './index.js'

// Task API - named exports only
// Note: Backend expects 'project_id' (snake_case), not 'projectId' (camelCase)
// Accepts either a bare projectId (number/string) for back-compat or a params object.
const toTaskListParams = (arg) => {
  if (arg === undefined || arg === null) return undefined
  if (typeof arg === 'object') return arg
  return { project_id: arg }
}
export const listTasks = (arg) => api.get('/tasks', { params: toTaskListParams(arg) })
export const getTasks = (projectId) => api.get('/tasks', { params: { project_id: projectId } })
export const getTask = (id) => api.get(`/tasks/${id}`)

const normalizeId = (value) => {
  if (value === null || value === undefined || value === '') {
    return value
  }
  return Number(value)
}

// Convert camelCase to snake_case for backend
const convertTaskData = (data) => ({
  ...data,
  project_id: normalizeId(data.projectId ?? data.project_id),
  iteration_id: normalizeId(data.iterationId ?? data.iteration_id)
})

export const createTask = (data) => api.post('/tasks', convertTaskData(data))
export const updateTask = (id, data) => api.put(`/tasks/${id}`, convertTaskData(data))
export const updateTaskStatus = (id, status) => api.patch(`/tasks/${id}/status`, { status })
export const deleteTask = (id, deleteWorktree = false) =>
  api.delete(`/tasks/${id}`, { params: { deleteWorktree } })
export const startTask = (id, data) => api.post(`/tasks/${id}/start`, data)

/**
 * Reorder tasks - batch update order field
 * @param {Array} tasks - Tasks with updated order
 * @returns {Promise} API response
 */
export const reorderTasks = async (tasks) => {
  const updates = tasks.map((task, index) => ({
    id: task.id,
    order: index
  }))

  return api.put('/tasks/reorder', { updates })
}

export const batchCreateTasks = (payload) => api.post('/tasks/batch-create', payload)
export const getTaskPipeline = (taskId) => api.get(`/tasks/${taskId}/pipeline`)
export const getTaskDependents = (taskId) => api.get(`/tasks/${taskId}/dependents`)
export const regenerateTaskSplit = (taskId, retryNote) => api.post(`/tasks/${taskId}/regenerate-split`, { retryNote })
export const updateTaskDependencies = (rootId, edges) =>
  api.put(`/tasks/${rootId}/dependencies/batch`, { edges })
