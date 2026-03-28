import api from './index.js'

export const skillApi = {
  list: () => api.get('/skills'),
  get: (id) => api.get(`/skills/${id}`),
  create: (data) => api.post('/skills', data),
  update: (id, data) => api.put(`/skills/${id}`, data),
  delete: (id) => api.delete(`/skills/${id}`)
}