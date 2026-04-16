import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useCrudStore } from '../composables/useCrudStore'
import { useApiErrorHandler } from '../composables/useApiErrorHandler'
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
  const apiError = useApiErrorHandler({ showMessage: false, defaultMessage: 'Task source request failed' })

  const unwrap = (response, fallbackMessage) => {
    try {
      return apiError.unwrapResponse(response, fallbackMessage)
    } catch (e) {
      error.value = e.message
      throw e
    }
  }
  const currentProjectId = ref(null)
  const syncing = ref(false)
  const testing = ref(false)

  // Preview state
  const previewItems = ref([])
  const showPreviewDialog = ref(false)
  const previewLoading = ref(false)
  const currentTaskSource = ref(null)
  const syncPreviewTasks = ref([])
  const selectedSyncTasks = ref(new Set())
  const syncError = ref(null)
  const scheduleStatuses = ref({})

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
      crud.items.value = unwrap(response, 'Failed to fetch task sources') || []
      return response
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

    const items = Object.entries(types).map(([key, metadata]) => ({
      key: metadata?.key || key,
      ...(metadata || {})
    }))

    // Put CloudDevOps types first (CLOUDDEVOPS_* and INTERNAL_API which is CloudDevOps Story)
    const cloudDevOpsKeys = new Set(['CLOUDDEVOPS_BUG', 'CLOUDDEVOPS_RR', 'INTERNAL_API'])
    items.sort((a, b) => {
      const aPriority = cloudDevOpsKeys.has(a.key) ? 0 : 1
      const bPriority = cloudDevOpsKeys.has(b.key) ? 0 : 1
      return aPriority - bPriority
    })

    return items
  }

  async function loadAvailableTypes() {
    error.value = null
    try {
      const response = await taskSourceApi.getAvailableTaskSourceTypes()
      availableTypes.value = normalizeAvailableTypes(unwrap(response, 'Failed to fetch task source types'))
      return availableTypes.value
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  async function createTaskSource(data) {
    error.value = null
    try {
      const response = await taskSourceApi.createTaskSource(data)
      unwrap(response, 'Failed to create task source')
      if (currentProjectId.value) {
        await fetchTaskSources(currentProjectId.value)
      }
      return response
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  async function updateTaskSource(id, data) {
    error.value = null
    try {
      const response = await taskSourceApi.updateTaskSource(id, data)
      unwrap(response, 'Failed to update task source')
      if (currentProjectId.value) {
        await fetchTaskSources(currentProjectId.value)
      }
      return response
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  async function deleteTaskSource(id) {
    error.value = null
    try {
      const response = await taskSourceApi.deleteTaskSource(id)
      unwrap(response, 'Failed to delete task source')
      if (currentProjectId.value) {
        await fetchTaskSources(currentProjectId.value)
      }
      return response
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
      unwrap(response, 'Failed to sync task source')
      return response
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
      unwrap(response, 'Failed to test task source')
      return response
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      testing.value = false
    }
  }

  async function fetchPreviewItems(sourceId, params = {}) {
    previewLoading.value = true
    error.value = null
    currentTaskSource.value = sourceId
    try {
      const response = await taskSourceApi.previewSync(sourceId, params)
      return unwrap(response, 'Failed to preview sync') || []
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      previewLoading.value = false
    }
  }

  function setSyncPreviewTasks(tasks) {
    syncPreviewTasks.value = tasks
    previewItems.value = tasks
    selectedSyncTasks.value = new Set(
      tasks.filter(task => !task.imported).map(task => task.external_id)
    )
    syncError.value = null
    showPreviewDialog.value = tasks.length > 0
  }

  async function previewSync(sourceId, params = {}) {
    const items = await fetchPreviewItems(sourceId, params)
    previewItems.value = items
    showPreviewDialog.value = items.length > 0
    return items
  }

  async function openSyncPreviewForSource(source) {
    closePreviewDialog()
    const items = await fetchPreviewItems(source.id)
    const tasks = items.map(item => ({
      ...item,
      sourceId: source.id,
      sourceName: source.name
    }))
    setSyncPreviewTasks(tasks)
    return tasks
  }

  async function openSyncPreviewForProject(projectId) {
    // Don't closePreviewDialog here — caller may have already opened it
    await fetchTaskSources(projectId)

    const results = await Promise.allSettled(
      crud.items.value.map(async (source) => {
        const items = await fetchPreviewItems(source.id)
        return items.map(item => ({
          ...item,
          sourceId: source.id,
          sourceName: source.name
        }))
      })
    )

    const previewTasks = []
    for (const result of results) {
      if (result.status === 'fulfilled') {
        previewTasks.push(...result.value)
      } else {
        console.error('Failed to preview source:', result.reason)
      }
    }

    setSyncPreviewTasks(previewTasks)
    return previewTasks
  }

  function toggleSyncTask(task) {
    const next = new Set(selectedSyncTasks.value)
    if (next.has(task.external_id)) {
      next.delete(task.external_id)
    } else {
      next.add(task.external_id)
    }
    selectedSyncTasks.value = next
  }

  function selectAllSyncTasks() {
    selectedSyncTasks.value = new Set(
      syncPreviewTasks.value
        .filter(task => !task.imported)
        .map(task => task.external_id)
    )
  }

  function deselectAllSyncTasks() {
    selectedSyncTasks.value = new Set()
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
      return unwrap(response, 'Failed to import issues')
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      crud.loading.value = false
    }
  }

  async function importSelectedPreviewTasks(projectId, iterationId = null) {
    const tasksToImport = syncPreviewTasks.value.filter(task =>
      selectedSyncTasks.value.has(task.external_id) && !task.imported
    )

    let totalImported = 0
    const tasksBySource = {}

    for (const task of tasksToImport) {
      if (!tasksBySource[task.sourceId]) {
        tasksBySource[task.sourceId] = []
      }
      tasksBySource[task.sourceId].push(task)
    }

    for (const [sourceId, items] of Object.entries(tasksBySource)) {
      const result = await importSelectedIssues(
        Number(sourceId),
        items,
        projectId,
        iterationId
      )
      totalImported += result?.created || 0
    }

    closePreviewDialog()
    return totalImported
  }

  function closePreviewDialog() {
    showPreviewDialog.value = false
    previewItems.value = []
    syncPreviewTasks.value = []
    selectedSyncTasks.value = new Set()
    syncError.value = null
    currentTaskSource.value = null
  }

  function clearTaskSources() {
    crud.clearItems()
    currentProjectId.value = null
  }

  function clearError() {
    error.value = null
  }

  async function fetchScheduleStatus(sourceId) {
    try {
      const response = await taskSourceApi.getTaskSourceScheduleStatus(sourceId)
      const data = unwrap(response, 'Failed to fetch schedule status')
      scheduleStatuses.value[sourceId] = data
      return data
    } catch (e) {
      error.value = e.message
      return null
    }
  }

  async function fetchAllScheduleStatuses() {
    const promises = crud.items.value
      .filter(source => source.sync_schedule)
      .map(source => fetchScheduleStatus(source.id).catch(() => null))
    await Promise.all(promises)
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
    syncPreviewTasks,
    selectedSyncTasks,
    syncError,
    fetchTaskSources,
    loadAvailableTypes,
    createTaskSource,
    updateTaskSource,
    deleteTaskSource,
    syncTaskSource,
    testTaskSource,
    previewSync,
    openSyncPreviewForSource,
    openSyncPreviewForProject,
    toggleSyncTask,
    selectAllSyncTasks,
    deselectAllSyncTasks,
    importSelectedIssues,
    importSelectedPreviewTasks,
    closePreviewDialog,
    fetchTaskSource: crud.fetchById,
    clearTaskSources,
    clearError,
    scheduleStatuses,
    fetchScheduleStatus,
    fetchAllScheduleStatuses
  }
})
