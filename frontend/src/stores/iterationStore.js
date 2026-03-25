import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useCrudStore } from '../composables/useCrudStore'
import { useApiErrorHandler } from '../composables/useApiErrorHandler'
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

  const apiError = useApiErrorHandler({ showMessage: false, defaultMessage: 'Iteration request failed' })
  const unwrap = (response, fallbackMessage) => {
    try {
      return apiError.unwrapResponse(response, fallbackMessage)
    } catch (e) {
      crud.error.value = e.message
      throw e
    }
  }

  const iterationsByProject = computed(() => (projectId) => {
    if (!projectId) return []
    return crud.items.value.filter(item => item.project_id === projectId)
  })

  const iterationsWithStats = computed(() => crud.items.value)

  async function fetchByProject(projectId) {
    crud.loading.value = true
    crud.error.value = null
    try {
      const response = await iterationApi.getIterations(projectId)
      crud.items.value = unwrap(response, 'Failed to fetch iterations') || []
      return response
    } finally {
      crud.loading.value = false
    }
  }

  async function fetchWithStats(id) {
    const response = await iterationApi.getIterationWithStats(id)
    return unwrap(response, 'Failed to fetch iteration stats')
  }

  async function updateStatus(id, status) {
    crud.loading.value = true
    crud.error.value = null
    try {
      const response = await iterationApi.updateIterationStatus(id, status)
      const updatedIteration = unwrap(response, 'Failed to update iteration status')
      const index = crud.items.value.findIndex(item => item.id === id)
      if (index !== -1) {
        crud.items.value[index] = updatedIteration
      }
      if (crud.currentItem.value?.id === id) {
        crud.currentItem.value = updatedIteration
      }
      return response
    } finally {
      crud.loading.value = false
    }
  }

  async function deleteIteration(id, options = {}) {
    crud.loading.value = true
    crud.error.value = null
    try {
      const response = await iterationApi.deleteIteration(id, options)
      unwrap(response, 'Failed to delete iteration')
      crud.items.value = crud.items.value.filter(item => item.id !== id)
      if (crud.currentItem.value?.id === id) {
        crud.currentItem.value = null
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
    iterations: crud.items,
    currentIteration: crud.currentItem,
    loading: crud.loading,
    error: crud.error,
    iterationsWithStats,
    iterationsByProject,
    fetchIterations: crud.fetchAll,
    fetchByProject,
    fetchIteration: crud.fetchById,
    fetchWithStats,
    createIteration: crud.create,
    updateIteration: crud.update,
    deleteIteration,
    updateStatus,
    setCurrentIteration: crud.setCurrentItem,
    clearError: crud.clearError
  }
})
