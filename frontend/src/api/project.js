import api from './index.js'
import { createCrudApi } from './createCrudApi.js'

// Project API - named exports only
const crud = createCrudApi('/projects')
export const getProjects = () => crud.list()
export const getProject = (id) => crud.get(id)
export const createProject = (data) => crud.create(data)
export const updateProject = (id, data) => crud.update(id, data)
export const deleteProject = (id) => crud.delete(id)

// Read-only file browsing for a project's local_path. Used by the workspace
// knowledge-repo card / dialog. The path is split on `/` so each segment
// gets percent-encoded individually (encodeURIComponent would otherwise
// escape the separators and break Fastify's wildcard matching).
export const getProjectFileTree = (id) => api.get(`/projects/${id}/files`)
export const getProjectFileContent = (id, path) => {
  const encoded = String(path)
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/')
  return api.get(`/projects/${id}/files/${encoded}`)
}
