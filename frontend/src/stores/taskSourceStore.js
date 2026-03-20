import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useCrudStore } from '../composables/useCrudStore'
import * as taskSourceApi from '../api/taskSource'

export const useTaskSourceStore = defineStore('taskSource', () => {
  const crud = useCrudStore({
    api: taskSourceApi,
    apiMethods: {
      getAll: 'getTaskSources',
      getById: 'getTaskSource'
    }
  })

  const error = ref(null)
  const availableTypes = ref([])
  const currentProjectId = ref(null)
  const syncing = ref(false)
  const testing = ref(false)

  // Preview state
  const previewItems = ref([])
  const showPreviewDialog = ref(false)
  const previewLoading = ref(false)
  const currentTaskSource = ref(null)

  const enabledSources = computed(() =>
    crud.items.value.filter(s => s.enabled)
  )

  const sourcesByType = computed(() => {
    const grouped = {}
    crud.items.value.forEach(source => {
      const type = source.type || 'OTHER'
      if (!grouped[type]) {
        grouped[type] = []
      }
      grouped[type].push(source)
    })
    return grouped
  })

  async function fetchTaskSources(projectId) {
    currentProjectId.value = projectId
    crud.loading.value = true
    error.value = null
    try {
      const response = await taskSourceApi.getTaskSources(projectId)
      if (response && response.success) {
        crud.items.value = response.data || []
        return response
      }

      error.value = response?.message || 'Failed to fetch task sources'
      throw new Error(error.value)
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      crud.loading.value = false
    }
  }

  function normalizeAvailableTypes(types) {
    if (Array.isArray(types)) {
      return types
    }

    if (!types || typeof types !== 'object') {
      return []
    }

    return Object.entries(types).map(([key, metadata]) => ({
      key: metadata?.key || key,
      ...(metadata || {})
    }))
  }

  async function loadAvailableTypes() {
    error.value = null
    try {
      const response = await taskSourceApi.getAvailableTaskSourceTypes()
      if (response && response.success) {
        availableTypes.value = normalizeAvailableTypes(response.data)
        return availableTypes.value
      }

      error.value = response?.message || 'Failed to fetch task source types'
      throw new Error(error.value)
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  async function createTaskSource(data) {
    error.value = null
    try {
      const response = await taskSourceApi.createTaskSource(data)
      if (response && response.success) {
        // Refresh the list
        if (currentProjectId.value) {
          await fetchTaskSources(currentProjectId.value)
        }
        return response
      }

      error.value = response?.message || 'Failed to create task source'
      throw new Error(error.value)
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  async function updateTaskSource(id, data) {
    error.value = null
    try {
      const response = await taskSourceApi.updateTaskSource(id, data)
      if (response && response.success) {
        // Refresh the list
        if (currentProjectId.value) {
          await fetchTaskSources(currentProjectId.value)
        }
        return response
      }

      error.value = response?.message || 'Failed to update task source'
      throw new Error(error.value)
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  async function deleteTaskSource(id) {
    error.value = null
    try {
      const response = await taskSourceApi.deleteTaskSource(id)
      if (response && response.success) {
        // Refresh the list
        if (currentProjectId.value) {
          await fetchTaskSources(currentProjectId.value)
        }
        return response
      }

      error.value = response?.message || 'Failed to delete task source'
      throw new Error(error.value)
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  async function syncTaskSource(id) {
    syncing.value = true
    error.value = null
    try {
      const response = await taskSourceApi.syncTaskSource(id)
      if (response && response.success) {
        return response
      }

      error.value = response?.message || 'Failed to sync task source'
      throw new Error(error.value)
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      syncing.value = false
    }
  }

  async function testTaskSource(id) {
    testing.value = true
    error.value = null
    try {
      const response = await taskSourceApi.testTaskSource(id)
      if (response && response.success) {
        return response
      }

      error.value = response?.message || 'Failed to test task source'
      throw new Error(error.value)
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      testing.value = false
    }
  }

  async function previewSync(sourceId) {
    previewLoading.value = true
    error.value = null
    currentTaskSource.value = sourceId
    try {
      const response = await taskSourceApi.previewSync(sourceId)
      if (response && response.success) {
        previewItems.value = response.data || []
        showPreviewDialog.value = true
        return previewItems.value
      } else {
        error.value = response?.message || 'Failed to preview sync'
        throw new Error(error.value)
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      previewLoading.value = false
    }
  }

  async function importSelectedIssues(sourceId, selectedItems, projectId, iterationId = null) {
    crud.loading.value = true
    error.value = null
    try {
      const response = await taskSourceApi.importIssues(sourceId, {
        items: selectedItems,
        project_id: projectId,
        iteration_id: iterationId
      })
      if (response && response.success) {
        previewItems.value = []
        showPreviewDialog.value = false
        return response.data
      } else {
        error.value = response?.message || 'Failed to import issues'
        throw new Error(error.value)
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      crud.loading.value = false
    }
  }

  function closePreviewDialog() {
    showPreviewDialog.value = false
    previewItems.value = []
  }

  function clearTaskSources() {
    crud.clearItems()
    currentProjectId.value = null
  }

  function clearError() {
    error.value = null
  }

  return {
    taskSources: crud.items,
    currentTaskSource: crud.currentItem,
    loading: crud.loading,
    error,
    currentProjectId,
    availableTypes,
    enabledSources,
    sourcesByType,
    syncing,
    testing,
    previewItems,
    showPreviewDialog,
    previewLoading,
    fetchTaskSources,
    loadAvailableTypes,
    createTaskSource,
    updateTaskSource,
    deleteTaskSource,
    syncTaskSource,
    testTaskSource,
    previewSync,
    importSelectedIssues,
    closePreviewDialog,
    fetchTaskSource: crud.fetchById,
    clearTaskSources,
    clearError
  }
})
