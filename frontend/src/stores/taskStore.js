import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useCrudStore } from '../composables/useCrudStore'
import * as taskApi from '../api/task'

export const useTaskStore = defineStore('task', () => {
  const crud = useCrudStore({
    api: taskApi,
    apiMethods: {
      getAll: 'getTasks',
      getById: 'getTask',
      create: 'createTask',
      update: 'updateTask',
      delete: 'deleteTask'
    },
    // getTasks requires projectId parameter
    fetchAllParams: () => null  // Will be overridden in custom fetchTasks
  })

  // Custom getters
  const tasksByStatus = computed(() => {
    const grouped = {
      TODO: [],
      IN_PROGRESS: [],
      DONE: [],
      BLOCKED: []
    }
    crud.items.value.forEach(task => {
      const status = task.status || 'TODO'
      if (grouped[status]) {
        grouped[status].push(task)
      }
    })
    return grouped
  })

  const tasksByPriority = computed(() => {
    return [...crud.items.value].sort((a, b) => {
      const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
      return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2)
    })
  })

  // Custom fetchTasks with projectId parameter
  async function fetchTasks(projectId) {
    crud.loading.value = true
    crud.error.value = null
    try {
      const response = await taskApi.getTasks(projectId)
      if (response.success) {
        crud.items.value = response.data
      }
      return response
    } catch (e) {
      crud.error.value = e.message
      throw e
    } finally {
      crud.loading.value = false
    }
  }

  async function updateTaskStatus(id, status) {
    crud.loading.value = true
    crud.error.value = null
    try {
      const response = await taskApi.updateTaskStatus(id, status)
      if (response.success) {
        const index = crud.items.value.findIndex(t => t.id === id)
        if (index !== -1) {
          crud.items.value[index] = response.data
        }
        if (crud.currentItem.value?.id === id) {
          crud.currentItem.value = response.data
        }
      }
      return response
    } catch (e) {
      crud.error.value = e.message
      throw e
    } finally {
      crud.loading.value = false
    }
  }

  return {
    // State
    tasks: crud.items,
    currentTask: crud.currentItem,
    loading: crud.loading,
    error: crud.error,
    // Getters
    tasksByStatus,
    tasksByPriority,
    // Actions
    fetchTasks,
    fetchTask: crud.fetchById,
    createTask: crud.create,
    updateTask: crud.update,
    updateTaskStatus,
    deleteTask: crud.deleteItem,
    setCurrentTask: crud.setCurrentItem,
    clearTasks: crud.clearItems,
    clearError: crud.clearError
  }
})
