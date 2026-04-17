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
  const syncSessionId = ref(null)
  const syncPanelVisible = ref(false)
  const syncHistory = ref([])
  const syncHistoryLoading = ref(false)
  const syncHistoryPagination = ref({ page: 1, pageSize: 10, total: 0 })

  // AI preview state
  const aiPreviewDialog = ref(false)
  const aiPreviewStep = ref('prompt')
  const aiPreviewPrompt = ref('')
  const aiPreviewFiles = ref([])
  const aiPreviewResults = ref([])
  const aiPreviewSessionId = ref(null)
  const aiPreviewSelected = ref(new Set())
  const aiPreviewLoading = ref(false)
  const aiPreviewSourceId = ref(null)
  const aiPreviewProcessing = ref(false)
  const aiPreviewError = ref(null)
  const aiPreviewAllFallback = ref(false)
  let aiPreviewPoller = null
  let aiPreviewTimeout = null

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
      const data = unwrap(response, 'Failed to sync task source')
      if (data?.sessionId) {
        syncSessionId.value = data.sessionId
        syncPanelVisible.value = true
      }
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

  function closeSyncPanel() {
    syncPanelVisible.value = false
    syncSessionId.value = null
  }

  async function fetchSyncHistory(sourceId, page) {
    syncHistoryLoading.value = true
    error.value = null
    const currentPage = page ?? syncHistoryPagination.value.page
    syncHistoryPagination.value.page = currentPage
    try {
      const response = await taskSourceApi.getSyncHistory(sourceId, {
        page: currentPage,
        pageSize: syncHistoryPagination.value.pageSize,
      })
      const data = unwrap(response, 'Failed to fetch sync history')
      syncHistory.value = data?.history || []
      syncHistoryPagination.value.total = data?.total || 0
      return syncHistory.value
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      syncHistoryLoading.value = false
    }
  }

  function viewSyncAnalysis(sessionId) {
    syncSessionId.value = sessionId
    syncPanelVisible.value = true
  }

  async function openAiPreview(sourceId) {
    aiPreviewSourceId.value = sourceId
    aiPreviewStep.value = 'prompt'
    aiPreviewLoading.value = true
    try {
      const response = await taskSourceApi.previewPrompt(sourceId)
      const data = unwrap(response, 'Failed to preview prompt')
      if (data.fileCount === 0) {
        return false
      }
      aiPreviewPrompt.value = data.prompt
      aiPreviewFiles.value = data.files
      aiPreviewDialog.value = true
      return true
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      aiPreviewLoading.value = false
    }
  }

  async function startAiPreview() {
    aiPreviewStep.value = 'results'
    aiPreviewLoading.value = true
    aiPreviewProcessing.value = true
    aiPreviewError.value = null
    aiPreviewSelected.value = new Set()
    try {
      const response = await taskSourceApi.previewResults(aiPreviewSourceId.value, { prompt: aiPreviewPrompt.value })
      const data = unwrap(response, 'Failed to start AI preview')
      aiPreviewSessionId.value = data.sessionId

      // Close loading, start background polling
      aiPreviewLoading.value = false

      // 15-minute timeout
      aiPreviewTimeout = setTimeout(() => {
        stopAiPreviewPolling()
        aiPreviewProcessing.value = false
        aiPreviewError.value = 'AI 分析超时（15分钟）'
        aiPreviewStep.value = 'results'
        aiPreviewDialog.value = true
      }, 900000) // 15 minutes

      // Start background polling (every 5 seconds, max 15 minutes)
      stopAiPreviewPolling()
      aiPreviewPoller = setInterval(() => pollAiPreviewSession(), 5000)
    } catch (e) {
      aiPreviewProcessing.value = false
      aiPreviewError.value = e.message
      aiPreviewStep.value = 'results'
      aiPreviewDialog.value = true
      throw e
    }
  }

  async function pollAiPreviewSession() {
    try {
      const api = (await import('../api/index.js')).default
      const sessionResp = await api.get(`/sessions/${aiPreviewSessionId.value}`)
      const session = sessionResp.data?.data || sessionResp.data
      if (!session) return

      if (session.status === 'PENDING_REVIEW' || session.status === 'COMPLETED') {
        if (aiPreviewTimeout) {
          clearTimeout(aiPreviewTimeout)
          aiPreviewTimeout = null
        }
        stopAiPreviewPolling()
        aiPreviewProcessing.value = false
        const results = session.metadata?.aiResults || []
        aiPreviewResults.value = results.map(r => ({ ...r, selected: true }))
        aiPreviewSelected.value = new Set(results.map(r => r.externalId))
        aiPreviewAllFallback = session.metadata?.allFallback || false
        aiPreviewStep.value = 'results'
        aiPreviewDialog.value = true
      }
      if (session.status === 'FAILED') {
        if (aiPreviewTimeout) {
          clearTimeout(aiPreviewTimeout)
          aiPreviewTimeout = null
        }
        stopAiPreviewPolling()
        aiPreviewProcessing.value = false
        const errorMsg = session.metadata?.error || 'AI 分析失败，请检查 Agent 配置'
        aiPreviewError.value = errorMsg
        aiPreviewStep.value = 'results'
        aiPreviewDialog.value = true
      }
    } catch {
      // Network error — keep polling, next attempt may succeed
    }
  }

  function stopAiPreviewPolling() {
    if (aiPreviewPoller) {
      clearInterval(aiPreviewPoller)
      aiPreviewPoller = null
    }
    if (aiPreviewTimeout) {
      clearTimeout(aiPreviewTimeout)
      aiPreviewTimeout = null
    }
  }

  function cleanupAiPreview() {
    stopAiPreviewPolling()
    closeAiPreviewDialog()
  }

  async function confirmAiPreviewImport() {
    aiPreviewLoading.value = true
    try {
      const items = aiPreviewResults.value
        .filter(r => aiPreviewSelected.value.has(r.externalId))
        .map(r => ({ externalId: r.externalId, title: r.title, description: r.description, external_url: r.external_url, scenarioTag: r.scenarioTag || null, recommendedWorkflowTemplateId: r.recommendedWorkflowTemplateId || null }))
      const response = await taskSourceApi.confirmSync(aiPreviewSourceId.value, {
        sessionId: aiPreviewSessionId.value,
        items,
      })
      const data = unwrap(response, 'Failed to confirm sync')
      cleanupAiPreview()
      return data
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      aiPreviewLoading.value = false
    }
  }

  function closeAiPreviewDialog() {
    aiPreviewDialog.value = false
    aiPreviewStep.value = 'prompt'
    aiPreviewPrompt.value = ''
    aiPreviewFiles.value = []
    // Keep aiPreviewResults, aiPreviewSessionId, aiPreviewSelected for when polling completes in background
    aiPreviewLoading.value = false
  }

  function toggleAiPreviewItem(externalId) {
    const next = new Set(aiPreviewSelected.value)
    if (next.has(externalId)) {
      next.delete(externalId)
    } else {
      next.add(externalId)
    }
    aiPreviewSelected.value = next
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
    fetchAllScheduleStatuses,
    syncSessionId,
    syncPanelVisible,
    closeSyncPanel,
    syncHistory,
    syncHistoryLoading,
    syncHistoryPagination,
    fetchSyncHistory,
    viewSyncAnalysis,
    aiPreviewDialog,
    aiPreviewStep,
    aiPreviewPrompt,
    aiPreviewFiles,
    aiPreviewResults,
    aiPreviewSessionId,
    aiPreviewSelected,
    aiPreviewLoading,
    aiPreviewProcessing,
    aiPreviewError,
    aiPreviewAllFallback,
    openAiPreview,
    startAiPreview,
    confirmAiPreviewImport,
    closeAiPreviewDialog,
    toggleAiPreviewItem,
    stopAiPreviewPolling,
    cleanupAiPreview
  }
})
