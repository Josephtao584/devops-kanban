import api from './index.js'

const normalizeIterationPayload = (data) => ({
  ...data,
  project_id: Number(data.project_id)
})

// Iteration API
export const getIterations = (projectId) => api.get('/iterations', { params: { project_id: projectId } })
export const getIteration = (id) => api.get(`/iterations/${id}`)
export const getIterationWithStats = (id) => api.get(`/iterations/${id}`)
export const getIterationTasks = (id) => api.get(`/iterations/${id}/tasks`)
export const createIteration = (data) => api.post('/iterations', normalizeIterationPayload(data))
export const updateIteration = (id, data) => api.put(`/iterations/${id}`, normalizeIterationPayload(data))
export const updateIterationStatus = (id, status) => api.patch(`/iterations/${id}/status`, { status })
export const deleteIteration = (id, { deleteTasks = false } = {}) => api.delete(`/iterations/${id}`, { params: { delete_tasks: deleteTasks } })
