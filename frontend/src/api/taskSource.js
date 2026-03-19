import api from './index.js'

// TaskSource API - named exports only
// Note: Backend expects 'project_id' (snake_case), not 'projectId' (camelCase)
export const getTaskSources = (projectId) => api.get('/task-sources', { params: { project_id: projectId } })
export const getTaskSource = (id) => api.get(`/task-sources/${id}`)
export const createTaskSource = (data) => api.post('/task-sources', data)
export const updateTaskSource = (id, data) => api.put(`/task-sources/${id}`, data)
export const syncTaskSource = (id) => api.post(`/task-sources/${id}/sync`)
export const testTaskSourceConnection = (id) => api.get(`/task-sources/${id}/test`)
export const previewTaskSource = (id) => api.get(`/task-sources/${id}/preview`)
export const deleteTaskSource = (id) => api.delete(`/task-sources/${id}`)