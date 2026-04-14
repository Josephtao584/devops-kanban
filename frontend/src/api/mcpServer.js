import api from './index.js'

export const mcpServerApi = {
  list: () => api.get('/mcp-servers'),
  get: (id) => api.get(`/mcp-servers/${id}`),
  create: (data) => api.post('/mcp-servers', data),
  update: (id, data) => api.put(`/mcp-servers/${id}`, data),
  delete: (id) => api.delete(`/mcp-servers/${id}`),
  validate: (data) => api.post('/mcp-servers/validate', data),
  // Export single MCP server — returns raw JSON for download
  exportMcpServer: (id) =>
    api.get(`/mcp-servers/export/${id}`, { responseType: 'json' }),
  // Batch export — returns raw JSON for download
  exportMcpServers: (serverIds) =>
    api.post('/mcp-servers/export', { serverIds }, { responseType: 'json' }),
  // Import preview — send parsed JSON from uploaded file
  previewImportMcpServers: (exportData) =>
    api.post('/mcp-servers/import', exportData),
  // Confirm import with strategy and name mappings
  confirmImportMcpServers: (data) =>
    api.post('/mcp-servers/import/confirm', data),
}
