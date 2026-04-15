import api from './index.js'

export const resolveBundle = (templateIds) =>
  api.post('/bundle/resolve', { templateIds })

export const exportBundle = (data) =>
  api.post('/bundle/export', data, { responseType: 'json' })

export const exportBundleZip = (data) =>
  api.post('/bundle/export-zip', data, { responseType: 'blob', timeout: 60000 })

export const previewImportBundle = (data) =>
  api.post('/bundle/import', data)

export const previewImportBundleZip = (data) =>
  api.post('/bundle/import-zip', data)

export const confirmImportBundle = (data) =>
  api.post('/bundle/import/confirm', data)

export const confirmImportBundleZip = (data) =>
  api.post('/bundle/import-zip/confirm', data, { timeout: 60000 })
