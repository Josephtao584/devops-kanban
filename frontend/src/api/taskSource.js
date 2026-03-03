import api from './index.js'

const getByProject = (projectId) => {
  return api.get(`/task-sources`, { params: { projectId } })
}

const create = (data) => {
  return api.post('/task-sources', data)
}

const sync = (id) => {
  return api.post(`/task-sources/${id}/sync`)
}

const testConnection = (id) => {
  return api.get(`/task-sources/${id}/test`)
}

const deleteTaskSource = (id) => {
  return api.delete(`/task-sources/${id}`)
}

export default {
  getByProject,
  create,
  sync,
  testConnection,
  delete: deleteTaskSource
}
