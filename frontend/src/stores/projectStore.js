import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useCrudStore } from '../composables/useCrudStore'
import * as projectApi from '../api/project'

export const useProjectStore = defineStore('project', () => {
  const crud = useCrudStore({
    api: projectApi,
    apiMethods: {
      getAll: 'getProjects',
      getById: 'getProject',
      create: 'createProject',
      update: 'updateProject',
      delete: 'deleteProject'
    }
  })

  // Custom getters
  const projectList = computed(() => crud.items.value)
  const currentProjectId = computed(() => crud.currentItem.value?.id)

  function setCurrentProject(project) {
    crud.setCurrentItem(project)
  }

  return {
    // State
    projects: crud.items,
    currentProject: crud.currentItem,
    loading: crud.loading,
    error: crud.error,
    // Getters
    projectList,
    currentProjectId,
    // Actions
    fetchProjects: crud.fetchAll,
    fetchProject: crud.fetchById,
    createProject: crud.create,
    updateProject: crud.update,
    deleteProject: crud.deleteItem,
    setCurrentProject,
    clearError: crud.clearError
  }
})
