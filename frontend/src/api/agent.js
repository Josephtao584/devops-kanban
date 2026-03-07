import api from './index.js'

// Agent API - named exports only
export const getAgents = (projectId) => api.get('/agents', { params: { projectId } })
export const getAgent = (id) => api.get(`/agents/${id}`)
export const createAgent = (data) => api.post('/agents', data)
export const updateAgent = (id, data) => api.put(`/agents/${id}`, data)
export const deleteAgent = (id) => api.delete(`/agents/${id}`)
