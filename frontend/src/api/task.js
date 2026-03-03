import api from './index.js'

const taskApi = {
  getAll: (projectId) => api.get('/tasks', { params: { projectId } }),
  getByProject: (projectId) => api.get('/tasks', { params: { projectId } }),
  getById: (id) => api.get(`/tasks/${id}`),
  create: (data) => api.post('/tasks', data),
  update: (id, data) => api.put(`/tasks/${id}`, data),
  updateStatus: (id, status) => api.patch(`/tasks/${id}/status`, { status }),
  delete: (id) => api.delete(`/tasks/${id}`)
}

export const getTasks = (projectId) => api.get('/tasks', { params: { projectId } })
export const getByProject = (projectId) => api.get('/tasks', { params: { projectId } })
export const getTask = (id) => api.get(`/tasks/${id}`)
export const createTask = (data) => api.post('/tasks', data)
export const updateTask = (id, data) => api.put(`/tasks/${id}`, data)
export const updateTaskStatus = (id, status) => api.patch(`/tasks/${id}/status`, { status })
export const deleteTask = (id) => api.delete(`/tasks/${id}`)

export default taskApi
