import api from './index.js'

export const getWorkflowRun = (runId) => api.get(`/workflows/runs/${runId}`)
export const getWorkflowRunsByTask = (taskId) => api.get('/workflows/runs', { params: { task_id: taskId } })
export const getWorkflowRunSteps = (runId) => api.get(`/workflows/runs/${runId}/steps`)
export const cancelWorkflow = (runId) => api.post(`/workflows/runs/${runId}/cancel`)
export const retryWorkflow = (runId) => api.post(`/workflows/runs/${runId}/retry`)
