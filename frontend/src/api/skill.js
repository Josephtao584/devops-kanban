import api from './index.js'

export const skillApi = {
  list: () => api.get('/skills'),
  get: (id) => api.get(`/skills/${id}`),
  create: (data) => api.post('/skills', data),
  update: (id, data) => api.put(`/skills/${id}`, data),
  delete: (id) => api.delete(`/skills/${id}`),
  listFiles: (id) => api.get(`/skills/${id}/files`),
  getFile: (id, filePath) => api.get(`/skills/${id}/files/${filePath}`),
  updateFile: (id, filePath, content) => api.put(`/skills/${id}/files/${filePath}`, { content }),
  uploadZip: (id, zipBase64) => api.post(`/skills/${id}/upload-zip`, { zip: zipBase64 }),
  createFromZip: (zipBase64) => api.post('/skills/from-zip', { zip: zipBase64 })
}