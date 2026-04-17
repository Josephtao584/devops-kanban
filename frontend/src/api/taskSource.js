import api from './index.js'

export const getTaskSources = (projectId) => api.get('/task-sources', { params: { project_id: projectId } })
export const getTaskSource = (id) => api.get(`/task-sources/${id}`)
export const getAvailableTaskSourceTypes = () => api.get('/task-sources/types/available')

export const createTaskSource = (data) => api.post('/task-sources', data)
export const updateTaskSource = (id, data) => api.put(`/task-sources/${id}`, data)
export const deleteTaskSource = (id) => api.delete(`/task-sources/${id}`)

export const syncTaskSource = (id) => api.post(`/task-sources/${id}/sync`)
export const previewSync = (id, params) => api.post(`/task-sources/${id}/sync/preview`, Object.keys(params || {}).length > 0 ? params : null)
export const importIssues = (id, data) => api.post(`/task-sources/${id}/sync/import`, data)
export const testTaskSource = (id) => api.get(`/task-sources/${id}/test`)
export const getTaskSourceScheduleStatus = (id) => api.get(`/task-sources/${id}/schedule-status`)
export const getSyncHistory = (id, params = {}) => api.get(`/task-sources/${id}/sync-history`, { params })
export const previewPrompt = (id) => api.post(`/task-sources/${id}/sync/preview-prompt`)
export const previewResults = (id) => api.post(`/task-sources/${id}/sync/preview-results`)
export const confirmSync = (id, data) => api.post(`/task-sources/${id}/sync/confirm`, data)
