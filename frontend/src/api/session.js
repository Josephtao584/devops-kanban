import api from './index.js'

const sessionApi = {
  // Create a new session
  create: (taskId, agentId) => api.post('/sessions', { taskId, agentId }),

  // Get session by ID
  getById: (id) => api.get(`/sessions/${id}`),

  // Get sessions by task ID
  getByTask: (taskId, activeOnly = false) =>
    api.get('/sessions', { params: { taskId, activeOnly } }),

  // Get active session for a task
  getActiveByTask: (taskId) => api.get(`/sessions/task/${taskId}/active`),

  // Get session history for a task (with output)
  getHistory: (taskId, includeOutput = true) =>
    api.get(`/sessions/task/${taskId}/history`, { params: { includeOutput } }),

  // Start a session
  start: (id) => api.post(`/sessions/${id}/start`),

  // Stop a session
  stop: (id) => api.post(`/sessions/${id}/stop`),

  // Send input to a session
  sendInput: (id, input) => api.post(`/sessions/${id}/input`, { input }),

  // Get session output
  getOutput: (id) => api.get(`/sessions/${id}/output`),

  // Delete a session
  delete: (id) => api.delete(`/sessions/${id}`)
}

export const createSession = (taskId, agentId) => sessionApi.create(taskId, agentId)
export const getSession = (id) => sessionApi.getById(id)
export const getSessionsByTask = (taskId, activeOnly = false) => sessionApi.getByTask(taskId, activeOnly)
export const getActiveSessionByTask = (taskId) => sessionApi.getActiveByTask(taskId)
export const getSessionHistory = (taskId, includeOutput = true) => sessionApi.getHistory(taskId, includeOutput)
export const startSession = (id) => sessionApi.start(id)
export const stopSession = (id) => sessionApi.stop(id)
export const sendSessionInput = (id, input) => sessionApi.sendInput(id, input)
export const getSessionOutput = (id) => sessionApi.getOutput(id)
export const deleteSession = (id) => sessionApi.delete(id)

export default sessionApi
