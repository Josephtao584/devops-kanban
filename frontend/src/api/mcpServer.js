import api from './index.js'

export const mcpServerApi = {
  list: () => api.get('/mcp-servers'),
  get: (id) => api.get(`/mcp-servers/${id}`),
  create: (data) => api.post('/mcp-servers', data),
  update: (id, data) => api.put(`/mcp-servers/${id}`, data),
  delete: (id) => api.delete(`/mcp-servers/${id}`),
  validate: (data) => api.post('/mcp-servers/validate', data),
}
