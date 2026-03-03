import api from './index.js'

const getAll = () => {
  return api.get('/projects')
}

const getById = (id) => {
  return api.get(`/projects/${id}`)
}

const create = (data) => {
  return api.post('/projects', data)
}

const update = (id, data) => {
  return api.put(`/projects/${id}`, data)
}

const deleteProject = (id) => {
  return api.delete(`/projects/${id}`)
}

export default {
  getAll,
  getById,
  create,
  update,
  delete: deleteProject
}
