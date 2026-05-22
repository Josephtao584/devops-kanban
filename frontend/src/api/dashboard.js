import api from './index.js'

function buildQuery(params = {}) {
  const query = {}
  if (params.teamId     != null) query.teamId     = params.teamId
  if (params.projectId  != null) query.projectId  = params.projectId
  if (params.windowDays != null) query.windowDays = params.windowDays
  return query
}

export const getOverview = (params = {}) =>
  api.get('/dashboard/overview', { params: buildQuery(params) })

export const getAgentDetail = (agentId, params = {}) =>
  api.get(`/dashboard/agents/${agentId}`, { params: buildQuery(params) })

export const getProjectDetail = (projectId, params = {}) =>
  api.get(`/dashboard/projects/${projectId}`, { params: buildQuery(params) })

export const getTeamDetail = (teamId, params = {}) =>
  api.get(`/dashboard/teams/${teamId}`, { params: buildQuery(params) })
