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

  // Custom fetchTasks with projectId parameter
  async function fetchTasks(projectId) {
    crud.loading.value = true
    crud.error.value = null
    try {
      const response = await taskApi.getTasks(projectId)
      crud.items.value = crud.unwrap(response, 'Failed to fetch tasks') || []
      return response
    } finally {
      crud.loading.value = false
    }
  }

  async function updateTaskStatus(id, status) {
    crud.loading.value = true
    crud.error.value = null
    try {
      const response = await taskApi.updateTaskStatus(id, status)
      const updatedTask = crud.unwrap(response, 'Failed to update task status')
      const index = crud.items.value.findIndex(t => t.id === id)
      if (index !== -1) {
        crud.items.value[index] = updatedTask
      }
      if (crud.currentItem.value?.id === id) {
        crud.currentItem.value = updatedTask
      }
      return response
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
