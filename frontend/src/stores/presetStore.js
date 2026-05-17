import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as presetApi from '../api/presets.js'
import { useApiErrorHandler } from '../composables/useApiErrorHandler.js'

export const usePresetStore = defineStore('preset', () => {
  const loading = ref(false)
  const error = ref(null)
  const presets = ref([])
  const installedNames = ref(new Set())
  const apiError = useApiErrorHandler({ showMessage: false, defaultMessage: '操作失败' })

  async function fetchPresets() {
    loading.value = true
    error.value = ''
    try {
      const response = await presetApi.getPresets()
      if (response?.success) {
        const data = response.data || []
        presets.value = Array.isArray(data) ? data : []
        installedNames.value = new Set(
          presets.value.filter(p => p.installed).map(p => p.name)
        )
        return response
      }
      error.value = response?.message || '加载预设列表失败'
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '加载预设列表失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function importPreset(name, strategy = 'copy') {
    loading.value = true
    try {
      const response = await presetApi.importPreset(name, strategy)
      if (response?.success) {
        installedNames.value.add(name)
        return response
      }
      error.value = response?.message || '安装预设失败'
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '安装预设失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  function isInstalled(name) {
    return installedNames.value.has(name)
  }

  function clearError() {
    error.value = null
  }

  return {
    loading,
    error,
    presets,
    installedNames,
    fetchPresets,
    importPreset,
    isInstalled,
    clearError,
  }
})
