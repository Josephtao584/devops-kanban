import api from './index.js'
import { createCrudApi } from './createCrudApi.js'

// Project API - named exports only
const crud = createCrudApi('/projects')
export const getProjects = () => crud.list()
export const getProject = (id) => crud.get(id)
export const createProject = (data) => crud.create(data)
export const updateProject = (id, data) => crud.update(id, data)
export const deleteProject = (id) => crud.delete(id)
