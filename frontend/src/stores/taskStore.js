import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as taskApi from '../api/task'

export const useTaskStore = defineStore('task', () => {
  // State
  const tasks = ref([])
  const currentTask = ref(null)
  const loading = ref(false)
  const error = ref(null)

  // Getters
  const tasksByStatus = computed(() => {
    const grouped = {
      TODO: [],
      IN_PROGRESS: [],
      DONE: [],
      BLOCKED: []
    }
    tasks.value.forEach(task => {
      const status = task.status || 'TODO'
      if (grouped[status]) {
        grouped[status].push(task)
      }
    })
    return grouped
  })

  const tasksByPriority = computed(() => {
    return [...tasks.value].sort((a, b) => {
      const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
      return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2)
    })
  })

  // Actions
  async function fetchTasks(projectId) {
    loading.value = true
    error.value = null
    try {
      const response = await taskApi.getTasks(projectId)
      if (response.success) {
        tasks.value = response.data
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchTask(id) {
    loading.value = true
    error.value = null
    try {
      const response = await taskApi.getTask(id)
      if (response.success) {
        currentTask.value = response.data
        // Also update the task in the tasks array if it exists
        const index = tasks.value.findIndex(t => t.id === id)
        if (index !== -1) {
          tasks.value[index] = response.data
        }
        return response.data
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createTask(taskData) {
    loading.value = true
    error.value = null
    try {
      const response = await taskApi.createTask(taskData)
      if (response.success) {
        tasks.value.push(response.data)
        return response.data
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateTask(id, taskData) {
    loading.value = true
    error.value = null
    try {
      const response = await taskApi.updateTask(id, taskData)
      if (response.success) {
        const index = tasks.value.findIndex(t => t.id === id)
        if (index !== -1) {
          tasks.value[index] = response.data
        }
        if (currentTask.value?.id === id) {
          currentTask.value = response.data
        }
        return response.data
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateTaskStatus(id, status) {
    loading.value = true
    error.value = null
    try {
      const response = await taskApi.updateTaskStatus(id, status)
      if (response.success) {
        const index = tasks.value.findIndex(t => t.id === id)
        if (index !== -1) {
          tasks.value[index] = response.data
        }
        if (currentTask.value?.id === id) {
          currentTask.value = response.data
        }
        return response.data
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteTask(id) {
    loading.value = true
    error.value = null
    try {
      const response = await taskApi.deleteTask(id)
      if (response.success) {
        tasks.value = tasks.value.filter(t => t.id !== id)
        if (currentTask.value?.id === id) {
          currentTask.value = null
        }
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  function setCurrentTask(task) {
    currentTask.value = task
  }

  function clearTasks() {
    tasks.value = []
    currentTask.value = null
  }

  function clearError() {
    error.value = null
  }

  return {
    // State
    tasks,
    currentTask,
    loading,
    error,
    // Getters
    tasksByStatus,
    tasksByPriority,
    // Actions
    fetchTasks,
    fetchTask,
    createTask,
    updateTask,
    updateTaskStatus,
    deleteTask,
    setCurrentTask,
    clearTasks,
    clearError
  }
})
