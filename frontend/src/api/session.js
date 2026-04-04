import api from './index.js'

// Session API - named exports only

// Get session by ID
export const getSession = (id) => api.get(`/sessions/${id}`)

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
  getSession,
  continueSession,
  getSessionEvents
}
