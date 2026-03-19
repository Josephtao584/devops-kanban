import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useCrudStore } from '../composables/useCrudStore'
import * as taskSourceApi from '../api/taskSource'

export const useTaskSourceStore = defineStore('taskSource', () => {
  // Use useCrudStore for basic CRUD operations
  const crud = useCrudStore({
    api: taskSourceApi,
    apiMethods: {
      getAll: 'getTaskSources',
      getById: 'getTaskSource',
      create: 'createTaskSource',
      update: 'updateTaskSource',
      delete: 'deleteTaskSource'
    }
    // Note: fetchAllParams not used - fetchTaskSources handles projectId directly
  })

  // TaskSource-specific state
  const syncing = ref(null)
  const testing = ref(null)
  const error = ref(null)

  // Preview state
  const previewItems = ref([])
  const showPreviewDialog = ref(false)
  const previewLoading = ref(false)
  const currentProjectId = ref(null)

  // Getters
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

  const githubSources = computed(() =>
    crud.items.value.filter(s => s.type === 'GITHUB')
  )

  // TaskSource-specific actions

  /**
   * Fetch task sources for a project
   * @param {String} projectId - Project ID
   */
  async function fetchTaskSources(projectId) {
    currentProjectId.value = projectId
    // Call getTaskSources directly with projectId
    crud.loading.value = true
    error.value = null
    try {
      const response = await taskSourceApi.getTaskSources(projectId)
      if (response && response.success) {
        crud.items.value = response.data || []
        return response
      } else {
        error.value = response?.message || 'Failed to fetch task sources'
        throw new Error(error.value)
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      crud.loading.value = false
    }
  }

  /**
   * Sync a task source
   * @param {String} id - Task source ID
   * @returns {Boolean} True if sync successful
   */
  async function syncTaskSource(id) {
    syncing.value = id
    error.value = null
    try {
      const response = await taskSourceApi.syncTaskSource(id)
      if (response && response.success) {
        // Refresh the source to get updated lastSyncAt
        await crud.fetchById(id)
        return true
      } else {
        error.value = response?.message || 'Failed to sync task source'
        return false
      }
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      syncing.value = null
    }
  }

  /**
   * Preview sync to get items to import
   * @param {String} sourceId - Task source ID
   * @returns {Array} Preview items
   */
  async function previewSync(sourceId) {
    previewLoading.value = true
    error.value = null
    try {
      const response = await taskSourceApi.previewSync(sourceId)
      if (response && response.success) {
        previewItems.value = response.data || []
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

  /**
   * Import selected issues from preview
   * @param {String} sourceId - Task source ID
   * @param {Array} selectedItems - Selected items to import
   * @param {String} projectId - Project ID
   * @returns {Object} Import result
   */
  async function importSelectedIssues(sourceId, selectedItems, projectId) {
    crud.loading.value = true
    error.value = null
    try {
      const response = await taskSourceApi.importIssues(sourceId, {
        items: selectedItems,
        project_id: projectId
      })
      if (response && response.success) {
        previewItems.value = []
        // Refresh the source to get updated lastSyncAt
        await crud.fetchById(sourceId)
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

  /**
   * Close preview dialog
   */
  function closePreviewDialog() {
    showPreviewDialog.value = false
    previewItems.value = []
  }

  /**
   * Test task source connection
   * @param {String} id - Task source ID
   * @returns {Boolean|Object} Connection test result
   */
  async function testConnection(id) {
    testing.value = id
    error.value = null
    try {
      const response = await taskSourceApi.testTaskSourceConnection(id)
      if (response && response.success) {
        return response.data || true
      } else {
        error.value = response?.message || 'Connection test failed'
        return false
      }
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      testing.value = null
    }
  }

  /**
   * Set current task source
   * @param {Object} source - Task source object
   */
  function setCurrentTaskSource(source) {
    crud.setCurrentItem(source)
  }

  /**
   * Clear task sources
   */
  function clearTaskSources() {
    crud.clearItems()
    currentProjectId.value = null
  }

  /**
   * Clear error
   */
  function clearError() {
    error.value = null
  }

  return {
    // State from crud
    taskSources: crud.items,
    currentTaskSource: crud.currentItem,
    loading: crud.loading,
    error,
    // TaskSource-specific state
    syncing,
    testing,
    // Preview state
    previewItems,
    showPreviewDialog,
    previewLoading,
    currentProjectId,
    // Getters
    enabledSources,
    sourcesByType,
    githubSources,
    // Actions from crud
    fetchTaskSources,
    fetchTaskSource: crud.fetchById,
    createTaskSource: crud.create,
    updateTaskSource: crud.update,
    deleteTaskSource: crud.deleteItem,
    // TaskSource-specific actions
    syncTaskSource,
    previewSync,
    importSelectedIssues,
    closePreviewDialog,
    testConnection,
    // Helpers
    setCurrentTaskSource,
    clearTaskSources,
    clearError
  }
})