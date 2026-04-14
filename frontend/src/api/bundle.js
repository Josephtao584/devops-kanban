import api from './index.js'

export const resolveBundle = (templateIds) =>
  api.post('/bundle/resolve', { templateIds })

export const exportBundle = (data) =>
  api.post('/bundle/export', data, { responseType: 'json' })

export const previewImportBundle = (data) =>
  api.post('/bundle/import', data)

export const confirmImportBundle = (data) =>
  api.post('/bundle/import/confirm', data)
