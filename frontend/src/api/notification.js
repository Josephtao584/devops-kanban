import api from './index'

export const getNotificationConfig = () => api.get('/notifications/config')

export const saveNotificationConfig = (data) => api.put('/notifications/config', data)

export const sendNotification = (content) => api.post('/notifications/send', { content })
