import api from './index.js'

// Execution API - named exports only
export const startExecution = (taskId, agentId) => api.post('/executions', { taskId, agentId })
export const getExecution = (id) => api.get(`/executions/${id}`)
export const getExecutionsByTask = (taskId) => api.get('/executions', { params: { taskId } })
export const stopExecution = (id) => api.post(`/executions/${id}/stop`)
export const getExecutionOutputStream = (id) => new EventSource(`/api/executions/${id}/output`)
