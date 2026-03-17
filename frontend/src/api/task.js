import api from './index.js'

// Task API - named exports only
// Note: Backend expects 'project_id' (snake_case), not 'projectId' (camelCase)
export const getTasks = (projectId) => api.get('/tasks', { params: { project_id: projectId } })
export const getTask = (id) => api.get(`/tasks/${id}`)
export const createTask = (data) => api.post('/tasks', data)
export const updateTask = (id, data) => api.put(`/tasks/${id}`, data)
export const updateTaskStatus = (id, status) => api.patch(`/tasks/${id}/status`, { status })
export const deleteTask = (id) => api.delete(`/tasks/${id}`)
