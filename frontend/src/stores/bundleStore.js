import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as bundleApi from '../api/bundle.js'
import { useApiErrorHandler } from '../composables/useApiErrorHandler.js'

export const useBundleStore = defineStore('bundle', () => {
  const loading = ref(false)
  const error = ref(null)
  const exporting = ref(false)
  const importing = ref(false)
  const apiError = useApiErrorHandler({ showMessage: false, defaultMessage: '操作失败' })

  async function resolveBundle(templateIds) {
    loading.value = true
    try {
      const response = await bundleApi.resolveBundle(templateIds)
      if (response?.success) {
        return response
      }
      error.value = response?.message || '解析依赖失败'
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '解析依赖失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function exportBundleZip(data) {
    exporting.value = true
    try {
      const blob = await bundleApi.exportBundleZip(data)
      return blob
    } catch (err) {
      error.value = apiError.handleError(err, '导出失败')
      throw err
    } finally {
      exporting.value = false
    }
  }

  async function exportBundle(data) {
    exporting.value = true
    try {
      const response = await bundleApi.exportBundle(data)
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '导出失败')
      throw err
    } finally {
      exporting.value = false
    }
  }

  async function previewImportBundle(data) {
    loading.value = true
    try {
      const response = await bundleApi.previewImportBundle(data)
      if (response?.success) {
        return response
      }
      error.value = response?.message || '预览导入失败'
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '预览导入失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function previewImportBundleZip(data) {
    loading.value = true
    try {
      const response = await bundleApi.previewImportBundleZip(data)
      if (response?.success) {
        return response
      }
      error.value = response?.message || '预览导入失败'
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '预览导入失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function confirmImportBundle(data) {
    importing.value = true
    try {
      const response = await bundleApi.confirmImportBundle(data)
      if (response?.success) {
        return response
      }
      error.value = response?.message || '导入失败'
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '导入失败')
      throw err
    } finally {
      importing.value = false
    }
  }

  async function confirmImportBundleZip(data) {
    importing.value = true
    try {
      const response = await bundleApi.confirmImportBundleZip(data)
      if (response?.success) {
        return response
      }
      error.value = response?.message || '导入失败'
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '导入失败')
      throw err
    } finally {
      importing.value = false
    }
  }

  function clearError() {
    error.value = null
  }

  return {
    loading,
    error,
    exporting,
    importing,
    resolveBundle,
    exportBundleZip,
    exportBundle,
    previewImportBundle,
    previewImportBundleZip,
    confirmImportBundle,
    confirmImportBundleZip,
    clearError,
  }
})
