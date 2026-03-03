import api from './index.js'

const getByProject = (projectId) => {
  return api.get(`/agents`, { params: { projectId } })
}

const getById = (id) => {
  return api.get(`/agents/${id}`)
}

const create = (data) => {
  return api.post('/agents', data)
}

const update = (id, data) => {
  return api.put(`/agents/${id}`, data)
}

const deleteAgent = (id) => {
  return api.delete(`/agents/${id}`)
}

export default {
  getByProject,
  getById,
  create,
  update,
  delete: deleteAgent
}
