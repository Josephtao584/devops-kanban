import api from './index.js'
import { createCrudApi } from './createCrudApi.js'

const crud = createCrudApi('/teams')
export const getTeams = () => crud.list()
export const getTeam = (id) => crud.get(id)
export const createTeam = (data) => crud.create(data)
export const updateTeam = (id, data) => crud.update(id, data)
export const deleteTeam = (id) => crud.delete(id)

export const addProjectToTeam = (teamId, data) => api.post(`/teams/${teamId}/projects`, data)
export const removeProjectFromTeam = (teamId, projectId) => api.delete(`/teams/${teamId}/projects/${projectId}`)
export const getTeamTasksGrouped = (teamId) => api.get(`/teams/${teamId}/tasks/grouped`)
