import api from './index'

export const getSettings = () => api.get('/settings')

export const updateSettings = (data) => api.put('/settings', data)

export const getSchedulerStatus = () => api.get('/settings/scheduler/status')

export const triggerDispatch = () => api.post('/settings/scheduler/trigger')
