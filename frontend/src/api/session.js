import api from './index.js'

// Session API - named exports only

// Get sessions for a task
export const getSessionsByTask = (taskId, activeOnly = false) => api.get(`/sessions/list/${taskId}`, {
  params: {
    ...(activeOnly ? { active_only: true } : {})
  }
})

// Get active session for a task
export const getActiveSessionByTask = (taskId) => api.get(`/sessions/active/${taskId}`)

// Get session history for a task
export const getSessionHistory = (taskId, includeOutput = true) => api.get(`/sessions/history/${taskId}`, {
  params: {
    ...(includeOutput ? { include_output: true } : {})
  }
})

// Get session by ID
export const getSession = (id) => api.get(`/sessions/${id}`)

// Get session output
export const getSessionOutput = (id) => api.get(`/sessions/${id}/output`)

// Start a session
export const startSession = (id) => api.post(`/sessions/${id}/start`)

// Stop a session
export const stopSession = (id) => api.post(`/sessions/${id}/stop`)

// Delete a session
export const deleteSession = (id) => api.delete(`/sessions/${id}`)

// Send input to a session
export const sendSessionInput = (id, input) => api.post(`/sessions/${id}/input`, { input })

// Continue a stopped session (resume with --resume flag)
export const continueSession = (id, input) => api.post(`/sessions/${id}/continue`, { input })

// Get session events
export const getSessionEvents = (id, { afterSeq = 0, limit } = {}) => api.get(`/sessions/${id}/events`, {
  params: {
    after_seq: afterSeq,
    ...(limit != null ? { limit } : {})
  }
})

export default {
  getSessionsByTask,
  getActiveSessionByTask,
  getSessionHistory,
  getSession,
  getSessionOutput,
  startSession,
  stopSession,
  deleteSession,
  sendSessionInput,
  continueSession,
  getSessionEvents
}
