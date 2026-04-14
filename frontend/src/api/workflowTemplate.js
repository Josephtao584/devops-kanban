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

// Export single template — returns raw JSON for download
export const exportWorkflowTemplate = (templateId) =>
  api.get(`/workflow-template/export/${templateId}`, { responseType: 'json' })

// Batch export — returns raw JSON for download
export const exportWorkflowTemplates = (templateIds) =>
  api.post('/workflow-template/export', { templateIds }, { responseType: 'json' })

// Import preview — send parsed JSON from uploaded file
export const previewImportWorkflowTemplates = (exportData) =>
  api.post('/workflow-template/import', exportData)

// Confirm import with strategy and agent mappings
export const confirmImportWorkflowTemplates = (data) =>
  api.post('/workflow-template/import/confirm', data)

// Preview assembled prompt for a step
export const previewPrompt = (data) =>
  api.post('/workflow-template/preview-prompt', data)
