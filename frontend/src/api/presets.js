import api from './index.js'

export function getPresets() {
  return api.get('/presets')
}

export function importPreset(name, strategy = 'copy') {
  return api.post(`/presets/${name}/import`, { strategy })
}
