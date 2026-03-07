import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as promptTemplateApi from '../api/promptTemplate'

export const usePromptTemplateStore = defineStore('promptTemplate', () => {
  // State
  const templates = ref([])
  const currentTemplate = ref(null)
  const loading = ref(false)
  const error = ref(null)

  // Getters
  const templatesByPhase = computed(() => {
    const grouped = {}
    templates.value.forEach(template => {
      const phase = template.phase || 'UNKNOWN'
      if (!grouped[phase]) {
        grouped[phase] = []
      }
      grouped[phase].push(template)
    })
    return grouped
  })

  const defaultTemplates = computed(() =>
    templates.value.filter(t => t.isDefault)
  )

  const customTemplates = computed(() =>
    templates.value.filter(t => !t.isDefault)
  )

  // Actions
  async function fetchTemplates() {
    loading.value = true
    error.value = null
    try {
      const response = await promptTemplateApi.getPromptTemplates()
      if (response.success) {
        templates.value = response.data || []
        return templates.value
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchTemplateByPhase(phase) {
    loading.value = true
    error.value = null
    try {
      const response = await promptTemplateApi.getPromptTemplateByPhase(phase)
      if (response.success) {
        currentTemplate.value = response.data
        return response.data
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateTemplate(id, data) {
    loading.value = true
    error.value = null
    try {
      const response = await promptTemplateApi.updatePromptTemplate(id, data)
      if (response.success) {
        const index = templates.value.findIndex(t => t.id === id)
        if (index !== -1) {
          templates.value[index] = response.data
        }
        if (currentTemplate.value?.id === id) {
          currentTemplate.value = response.data
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

  async function resetTemplate(id) {
    loading.value = true
    error.value = null
    try {
      const response = await promptTemplateApi.resetPromptTemplate(id)
      if (response.success) {
        const index = templates.value.findIndex(t => t.id === id)
        if (index !== -1) {
          templates.value[index] = response.data
        }
        if (currentTemplate.value?.id === id) {
          currentTemplate.value = response.data
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

  function setCurrentTemplate(template) {
    currentTemplate.value = template
  }

  function clearTemplates() {
    templates.value = []
    currentTemplate.value = null
  }

  function clearError() {
    error.value = null
  }

  return {
    // State
    templates,
    currentTemplate,
    loading,
    error,
    // Getters
    templatesByPhase,
    defaultTemplates,
    customTemplates,
    // Actions
    fetchTemplates,
    fetchTemplateByPhase,
    updateTemplate,
    resetTemplate,
    setCurrentTemplate,
    clearTemplates,
    clearError
  }
})
