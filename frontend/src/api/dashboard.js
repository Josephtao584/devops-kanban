import api from './index.js'

export const getOverview = (params = {}) => {
  const query = {}
  if (params.teamId    != null) query.teamId    = params.teamId
  if (params.projectId != null) query.projectId = params.projectId
  return api.get('/dashboard/overview', { params: query })
}

export const getAgentDetail = (agentId, params = {}) => {
  const query = {}
  if (params.teamId    != null) query.teamId    = params.teamId
  if (params.projectId != null) query.projectId = params.projectId
  return api.get(`/dashboard/agents/${agentId}`, { params: query })
}

export const getProjectDetail = (projectId) => api.get(`/dashboard/projects/${projectId}`)
export const getTeamDetail    = (teamId)    => api.get(`/dashboard/teams/${teamId}`)
