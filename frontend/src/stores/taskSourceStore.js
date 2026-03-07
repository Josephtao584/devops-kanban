import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as taskSourceApi from '../api/taskSource'

export const useTaskSourceStore = defineStore('taskSource', () => {
  // State
  const taskSources = ref([])
  const currentTaskSource = ref(null)
  const loading = ref(false)
  const syncing = ref(null) // ID of currently syncing source
  const testing = ref(null) // ID of currently testing connection
  const error = ref(null)

  // Getters
  const enabledSources = computed(() =>
    taskSources.value.filter(s => s.enabled)
  )

  const sourcesByType = computed(() => {
    const grouped = {}
    taskSources.value.forEach(source => {
      const type = source.type || 'OTHER'
      if (!grouped[type]) {
        grouped[type] = []
      }
      grouped[type].push(source)
    })
    return grouped
  })

  const githubSources = computed(() =>
    taskSources.value.filter(s => s.type === 'GITHUB')
  )

  // Actions
  async function fetchTaskSources(projectId) {
    loading.value = true
    error.value = null
    try {
      const response = await taskSourceApi.getTaskSources(projectId)
      if (response.success) {
        taskSources.value = response.data || []
        return taskSources.value
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchTaskSource(id) {
    loading.value = true
    error.value = null
    try {
      const response = await taskSourceApi.getTaskSource(id)
      if (response.success) {
        currentTaskSource.value = response.data
        return response.data
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createTaskSource(data) {
    loading.value = true
    error.value = null
    try {
      const response = await taskSourceApi.createTaskSource(data)
      if (response.success) {
        taskSources.value.push(response.data)
        return response.data
      } else {
        error.value = response.message
        throw new Error(response.message)
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateTaskSource(id, data) {
    loading.value = true
    error.value = null
    try {
      const response = await taskSourceApi.updateTaskSource(id, data)
      if (response.success) {
        const index = taskSources.value.findIndex(s => s.id === id)
        if (index !== -1) {
          taskSources.value[index] = response.data
        }
        if (currentTaskSource.value?.id === id) {
          currentTaskSource.value = response.data
        }
        return response.data
      } else {
        error.value = response.message
        throw new Error(response.message)
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function syncTaskSource(id) {
    syncing.value = id
    error.value = null
    try {
      const response = await taskSourceApi.syncTaskSource(id)
      if (response.success) {
        // Refresh the source to get updated lastSyncAt
        await fetchTaskSource(id)
        return true
      } else {
        error.value = response.message
        return false
      }
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      syncing.value = null
    }
  }

  async function testConnection(id) {
    testing.value = id
    error.value = null
    try {
      const response = await taskSourceApi.testTaskSourceConnection(id)
      if (response.success) {
        return response.data || true
      } else {
        error.value = response.message
        return false
      }
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      testing.value = null
    }
  }

  async function deleteTaskSource(id) {
    loading.value = true
    error.value = null
    try {
      const response = await taskSourceApi.deleteTaskSource(id)
      if (response.success) {
        taskSources.value = taskSources.value.filter(s => s.id !== id)
        if (currentTaskSource.value?.id === id) {
          currentTaskSource.value = null
        }
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  function setCurrentTaskSource(source) {
    currentTaskSource.value = source
  }

  function clearTaskSources() {
    taskSources.value = []
    currentTaskSource.value = null
  }

  function clearError() {
    error.value = null
  }

  return {
    // State
    taskSources,
    currentTaskSource,
    loading,
    syncing,
    testing,
    error,
    // Getters
    enabledSources,
    sourcesByType,
    githubSources,
    // Actions
    fetchTaskSources,
    fetchTaskSource,
    createTaskSource,
    updateTaskSource,
    syncTaskSource,
    testConnection,
    deleteTaskSource,
    setCurrentTaskSource,
    clearTaskSources,
    clearError
  }
})
