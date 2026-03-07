import api from './index.js'

// Phase Transition API - named exports only
export const getRules = () => api.get('/phase-transitions/rules')
export const getRule = (id) => api.get(`/phase-transitions/rules/${id}`)
export const createRule = (data) => api.post('/phase-transitions/rules', data)
export const updateRule = (id, data) => api.put(`/phase-transitions/rules/${id}`, data)
export const deleteRule = (id) => api.delete(`/phase-transitions/rules/${id}`)
export const initializeDefaultRules = () => api.post('/phase-transitions/rules/initialize')
export const triggerTransition = (taskId) => api.post(`/phase-transitions/tasks/${taskId}/transition`)
