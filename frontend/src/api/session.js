import api from './index.js'

// Session API - named exports only

// Create a new session
export const createSession = (taskId, agentId) => api.post('/sessions', { taskId, agentId })

// Get session by ID
export const getSession = (id) => api.get(`/sessions/${id}`)

// Get sessions by task ID
export const getSessionsByTask = (taskId, activeOnly = false) =>
  api.get('/sessions', { params: { taskId, activeOnly } })

// Get active session for a task
export const getActiveSessionByTask = (taskId) => api.get(`/sessions/task/${taskId}/active`)

// Get session history for a task (with output)
export const getSessionHistory = (taskId, includeOutput = true) =>
  api.get(`/sessions/task/${taskId}/history`, { params: { includeOutput } })

// Start a session
export const startSession = (id) => api.post(`/sessions/${id}/start`)

// Stop a session
export const stopSession = (id) => api.post(`/sessions/${id}/stop`)

// Send input to a session
export const sendSessionInput = (id, input) => api.post(`/sessions/${id}/input`, { input })

// Continue a stopped session (resume with --resume flag)
export const continueSession = (id, input) => api.post(`/sessions/${id}/continue`, { input })

// Get session output
export const getSessionOutput = (id) => api.get(`/sessions/${id}/output`)

// Delete a session
export const deleteSession = (id) => api.delete(`/sessions/${id}`)
