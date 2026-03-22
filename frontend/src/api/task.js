import api from './index.js'

// Task API - named exports only
// Note: Backend expects 'project_id' (snake_case), not 'projectId' (camelCase)
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
export const updateTaskAutoTransition = (id, autoTransitionEnabled) => api.put(`/tasks/${id}`, { autoTransitionEnabled })
export const deleteTask = (id) => api.delete(`/tasks/${id}`)
export const startTask = (id) => api.post(`/tasks/${id}/start`)

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
