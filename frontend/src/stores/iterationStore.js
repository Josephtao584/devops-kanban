import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useCrudStore } from '../composables/useCrudStore'
import * as iterationApi from '../api/iteration'

export const useIterationStore = defineStore('iteration', () => {
  const crud = useCrudStore({
    api: iterationApi,
    apiMethods: {
      getAll: 'getIterations',
      getById: 'getIteration',
      create: 'createIteration',
      update: 'updateIteration',
      delete: 'deleteIteration'
    }
  })

  // Custom getters
  const iterationsByProject = computed(() => (projectId) => {
    if (!projectId) return []
    return crud.items.value.filter(item => item.project_id === projectId)
  })

  const iterationsWithStats = computed(() => crud.items.value)

  // Custom action to fetch iterations for a specific project
  async function fetchByProject(projectId) {
    const response = await iterationApi.getIterations(projectId)
    if (response.success) {
      crud.items.value = response.data
    }
    return response
  }

  async function fetchWithStats(id) {
    return await iterationApi.getIterationWithStats(id)
  }

  async function updateStatus(id, status) {
    return await iterationApi.updateIterationStatus(id, status)
  }

  return {
    // State
    iterations: crud.items,
    currentIteration: crud.currentItem,
    loading: crud.loading,
    error: crud.error,
    // Getters
    iterationsWithStats,
    iterationsByProject,
    // Actions
    fetchIterations: crud.fetchAll,
    fetchByProject,
    fetchIteration: crud.fetchById,
    fetchWithStats,
    createIteration: crud.create,
    updateIteration: crud.update,
    deleteIteration: crud.deleteItem,
    updateStatus,
    setCurrentIteration: crud.setCurrentItem,
    clearError: crud.clearError
  }
})
