import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useCrudStore } from '../composables/useCrudStore'
import * as requirementApi from '../api/requirement'

export const useRequirementStore = defineStore('requirement', () => {
  const crud = useCrudStore({
    api: requirementApi,
    apiMethods: {
      getAll: 'getRequirements',
      getById: 'getRequirement',
      create: 'createRequirement',
      update: 'updateRequirement',
      delete: 'deleteRequirement'
    },
    // getRequirements requires projectId parameter
    fetchAllParams: () => null  // Will be overridden in custom fetchRequirements
  })

  // Custom fetchRequirements with projectId parameter
  async function fetchRequirements(projectId) {
    crud.loading.value = true
    crud.error.value = null
    try {
      const response = await requirementApi.getRequirements(projectId)
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

  return {
    // State
    requirements: crud.items,
    currentRequirement: crud.currentItem,
    loading: crud.loading,
    error: crud.error,
    // Actions
    fetchRequirements,
    fetchRequirement: crud.fetchById,
    createRequirement: crud.create,
    updateRequirement: crud.update,
    deleteRequirement: crud.deleteItem,
    setCurrentRequirement: crud.setCurrentItem,
    clearRequirements: crud.clearItems,
    clearError: crud.clearError
  }
})
