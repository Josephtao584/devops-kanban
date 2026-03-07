import api from './index.js'

// TaskSource API - named exports only
export const getTaskSources = (projectId) => api.get('/task-sources', { params: { projectId } })
export const getTaskSource = (id) => api.get(`/task-sources/${id}`)
export const createTaskSource = (data) => api.post('/task-sources', data)
export const updateTaskSource = (id, data) => api.put(`/task-sources/${id}`, data)
export const syncTaskSource = (id) => api.post(`/task-sources/${id}/sync`)
export const testTaskSourceConnection = (id) => api.get(`/task-sources/${id}/test`)
export const deleteTaskSource = (id) => api.delete(`/task-sources/${id}`)
