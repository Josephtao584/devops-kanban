import api from './index'

export const getWorkflowTemplate = () => api.get('/workflow-template')
export const updateWorkflowTemplate = (data) => api.put('/workflow-template', data)
