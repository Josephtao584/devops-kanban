import api from './index.js'

// Iteration API
export const getIterations = (projectId) => api.get('/iterations', { params: { project_id: projectId } })
export const getIteration = (id) => api.get(`/iterations/${id}`)
export const getIterationWithStats = (id) => api.get(`/iterations/${id}`)
export const getIterationTasks = (id) => api.get(`/iterations/${id}/tasks`)
export const createIteration = (data) => api.post('/iterations', data)
export const updateIteration = (id, data) => api.put(`/iterations/${id}`, data)
export const updateIterationStatus = (id, status) => api.patch(`/iterations/${id}/status`, { status })
export const deleteIteration = (id) => api.delete(`/iterations/${id}`)
