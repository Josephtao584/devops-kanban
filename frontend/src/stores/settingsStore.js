import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as settingsApi from '../api/settings.js'
import { useApiErrorHandler } from '../composables/useApiErrorHandler.js'

export const useSettingsStore = defineStore('settings', () => {
  const loading = ref(false)
  const error = ref(null)
  const apiError = useApiErrorHandler({ showMessage: false, defaultMessage: '操作失败' })

  async function getSettings() {
    loading.value = true
    try {
      const response = await settingsApi.getSettings()
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '获取设置失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateSettings(data) {
    loading.value = true
    try {
      const response = await settingsApi.updateSettings(data)
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '更新设置失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function getSchedulerStatus() {
    loading.value = true
    try {
      const response = await settingsApi.getSchedulerStatus()
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '获取调度器状态失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function triggerDispatch() {
    loading.value = true
    try {
      const response = await settingsApi.triggerDispatch()
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '触发调度失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  return { loading, error, getSettings, updateSettings, getSchedulerStatus, triggerDispatch }
})
