import api from './index.js'

const executionApi = {
  start: (taskId, agentId) => api.post('/executions', { taskId, agentId }),
  getById: (id) => api.get(`/executions/${id}`),
  getByTask: (taskId) => api.get('/executions', { params: { taskId } }),
  stop: (id) => api.post(`/executions/${id}/stop`),
  getOutputStream: (id) => new EventSource(`/api/executions/${id}/output`)
}

export const startExecution = (taskId, agentId) => api.post('/executions', { taskId, agentId })
export const getExecution = (id) => api.get(`/executions/${id}`)
export const getExecutionsByTask = (taskId) => api.get('/executions', { params: { taskId } })
export const stopExecution = (id) => api.post(`/executions/${id}/stop`)
export const getExecutionOutputStream = (id) => new EventSource(`/api/executions/${id}/output`)

export default executionApi
