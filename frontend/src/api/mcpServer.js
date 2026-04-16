import { createCrudApi } from './createCrudApi.js'
import api from './index.js'

const crud = createCrudApi('/mcp-servers')

export const mcpServerApi = {
  ...crud,
  validate: (data) => api.post('/mcp-servers/validate', data),
  exportMcpServer: (id) => api.get(`/mcp-servers/export/${id}`, { responseType: 'json' }),
  exportMcpServers: (serverIds) => api.post('/mcp-servers/export', { serverIds }, { responseType: 'json' }),
  previewImportMcpServers: (exportData) => api.post('/mcp-servers/import', exportData),
  confirmImportMcpServers: (data) => api.post('/mcp-servers/import/confirm', data),
}
