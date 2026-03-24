import api from './index'

export const getWorkflowTemplates = () => api.get('/workflow-template')
export const getWorkflowTemplateById = (templateId) => api.get(`/workflow-template/${templateId}`)
export const getWorkflowTemplate = () => api.get('/workflow-template/dev-workflow-v1')
export const updateWorkflowTemplate = (data) => api.put('/workflow-template', data)
