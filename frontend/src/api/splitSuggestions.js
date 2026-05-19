import api from './index.js'

export const splitSuggestionsApi = {
  listByTask: (taskId) => api.get(`/tasks/${taskId}/split-suggestions`),
  update: (id, suggestions) => api.patch(`/split-suggestions/${id}`, { suggestions }),
  confirm: (id) => api.post(`/split-suggestions/${id}/confirm`),
  dismiss: (id) => api.post(`/split-suggestions/${id}/dismiss`),
  previewPath: (id, title, workDir) => api.post(`/split-suggestions/${id}/preview-path`, { title, work_dir: workDir }),
}
