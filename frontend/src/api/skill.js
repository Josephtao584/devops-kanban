import { createCrudApi } from './createCrudApi.js'
import api from './index.js'

const crud = createCrudApi('/skills')

export const skillApi = {
  ...crud,
  listFiles: (id) => api.get(`/skills/${id}/files`),
  getFile: (id, filePath) => api.get(`/skills/${id}/files/${filePath}`),
  updateFile: (id, filePath, content) => api.put(`/skills/${id}/files/${filePath}`, { content }),
  uploadZip: (id, zipBase64) => api.post(`/skills/${id}/upload-zip`, { zip: zipBase64 }),
  createFromZip: (zipBase64) => api.post('/skills/from-zip', { zip: zipBase64 })
}