import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as projectApi from '../api/project'

export const useProjectStore = defineStore('project', () => {
  // State
  const projects = ref([])
  const currentProject = ref(null)
  const loading = ref(false)
  const error = ref(null)

  // Getters
  const projectList = computed(() => projects.value)
  const currentProjectId = computed(() => currentProject.value?.id)

  // Actions
  async function fetchProjects() {
    loading.value = true
    error.value = null
    try {
      const response = await projectApi.getProjects()
      if (response.success) {
        projects.value = response.data
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchProject(id) {
    loading.value = true
    error.value = null
    try {
      const response = await projectApi.getProject(id)
      if (response.success) {
        currentProject.value = response.data
        return response.data
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createProject(projectData) {
    loading.value = true
    error.value = null
    try {
      const response = await projectApi.createProject(projectData)
      if (response.success) {
        projects.value.push(response.data)
        return response.data
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateProject(id, projectData) {
    loading.value = true
    error.value = null
    try {
      const response = await projectApi.updateProject(id, projectData)
      if (response.success) {
        const index = projects.value.findIndex(p => p.id === id)
        if (index !== -1) {
          projects.value[index] = response.data
        }
        if (currentProject.value?.id === id) {
          currentProject.value = response.data
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

  async function deleteProject(id) {
    loading.value = true
    error.value = null
    try {
      const response = await projectApi.deleteProject(id)
      if (response.success) {
        projects.value = projects.value.filter(p => p.id !== id)
        if (currentProject.value?.id === id) {
          currentProject.value = null
        }
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  function setCurrentProject(project) {
    currentProject.value = project
  }

  function clearError() {
    error.value = null
  }

  return {
    // State
    projects,
    currentProject,
    loading,
    error,
    // Getters
    projectList,
    currentProjectId,
    // Actions
    fetchProjects,
    fetchProject,
    createProject,
    updateProject,
    deleteProject,
    setCurrentProject,
    clearError
  }
})
