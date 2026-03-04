import api from './index.js'

const agentApi = {
  getAll: (projectId) => api.get('/agents', { params: { projectId } }),
  getByProject: (projectId) => api.get('/agents', { params: { projectId } }),
  getById: (id) => api.get(`/agents/${id}`),
  create: (data) => api.post('/agents', data),
  update: (id, data) => api.put(`/agents/${id}`, data),
  delete: (id) => api.delete(`/agents/${id}`)
}

export const getAgents = (projectId) => api.get('/agents', { params: { projectId } })
export const getAgent = (id) => api.get(`/agents/${id}`)
export const createAgent = (data) => api.post('/agents', data)
export const updateAgent = (id, data) => api.put(`/agents/${id}`, data)
export const deleteAgent = (id) => api.delete(`/agents/${id}`)

export default agentApi
