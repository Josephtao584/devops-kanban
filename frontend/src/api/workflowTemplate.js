import api from './index'

export const getWorkflowTemplates = () => api.get('/workflow-template')
export const getWorkflowTemplateById = (templateId) => api.get(`/workflow-template/${templateId}`)
export const getWorkflowTemplate = () => api.get('/workflow-template/workflow-v1')
export const createWorkflowTemplate = (data) => api.post('/workflow-template', data)
export const updateWorkflowTemplate = (data) => api.put('/workflow-template', data)
export const deleteWorkflowTemplate = (templateId) => api.delete(`/workflow-template/${templateId}`)

export const reorderWorkflowTemplates = async (templates) => {
  const updates = templates
    .filter(t => !t.isDraft && typeof t.id === 'number')
    .map((template, index) => ({ id: template.id, order: index }))
  return api.put('/workflow-template/reorder', { updates })
}
