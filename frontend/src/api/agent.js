import api from './index.js'
import { createCrudApi } from './createCrudApi.js'

// Agent API - named exports only (Agents are global, not project-specific)
const crud = createCrudApi('/agents')
export const getAgents = () => crud.list()
export const getAgent = (id) => crud.get(id)
export const createAgent = (data) => crud.create(data)
export const updateAgent = (id, data) => crud.update(id, data)
export const deleteAgent = (id) => crud.delete(id)
