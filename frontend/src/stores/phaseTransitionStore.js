import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as phaseTransitionApi from '../api/phaseTransition'

export const usePhaseTransitionStore = defineStore('phaseTransition', () => {
  // State
  const rules = ref([])
  const currentRule = ref(null)
  const loading = ref(false)
  const initializing = ref(false)
  const error = ref(null)

  // Getters
  const rulesByFromPhase = computed(() => {
    const grouped = {}
    rules.value.forEach(rule => {
      const phase = rule.fromPhase || 'UNKNOWN'
      if (!grouped[phase]) {
        grouped[phase] = []
      }
      grouped[phase].push(rule)
    })
    return grouped
  })

  const rulesByToPhase = computed(() => {
    const grouped = {}
    rules.value.forEach(rule => {
      const phase = rule.toPhase || 'UNKNOWN'
      if (!grouped[phase]) {
        grouped[phase] = []
      }
      grouped[phase].push(rule)
    })
    return grouped
  })

  const enabledRules = computed(() =>
    rules.value.filter(r => r.enabled)
  )

  const autoTransitionRules = computed(() =>
    rules.value.filter(r => r.enabled && r.autoTransition)
  )

  const sortedRules = computed(() =>
    [...rules.value].sort((a, b) => b.priority - a.priority)
  )

  // Actions
  async function fetchRules() {
    loading.value = true
    error.value = null
    try {
      const response = await phaseTransitionApi.getRules()
      if (response.success) {
        // Handle both direct array and wrapped response
        rules.value = Array.isArray(response.data)
          ? response.data
          : (response.data?.rules || [])
        return rules.value
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchRule(id) {
    loading.value = true
    error.value = null
    try {
      const response = await phaseTransitionApi.getRule(id)
      if (response.success) {
        currentRule.value = response.data
        return response.data
      } else {
        error.value = response.message
        return null
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createRule(data) {
    loading.value = true
    error.value = null
    try {
      const response = await phaseTransitionApi.createRule(data)
      if (response.success) {
        rules.value.push(response.data)
        currentRule.value = response.data
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

  async function updateRule(id, data) {
    loading.value = true
    error.value = null
    try {
      const response = await phaseTransitionApi.updateRule(id, data)
      if (response.success) {
        const index = rules.value.findIndex(r => r.id === id)
        if (index !== -1) {
          rules.value[index] = response.data
        }
        if (currentRule.value?.id === id) {
          currentRule.value = response.data
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

  async function deleteRule(id) {
    loading.value = true
    error.value = null
    try {
      const response = await phaseTransitionApi.deleteRule(id)
      if (response.success) {
        rules.value = rules.value.filter(r => r.id !== id)
        if (currentRule.value?.id === id) {
          currentRule.value = null
        }
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function initializeDefaultRules() {
    initializing.value = true
    error.value = null
    try {
      const response = await phaseTransitionApi.initializeDefaultRules()
      if (response.success) {
        await fetchRules()
        return true
      } else {
        error.value = response.message
        return false
      }
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      initializing.value = false
    }
  }

  async function triggerTransition(taskId) {
    loading.value = true
    error.value = null
    try {
      const response = await phaseTransitionApi.triggerTransition(taskId)
      if (response.success) {
        return response.data
      } else {
        error.value = response.message
        return null
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  function setCurrentRule(rule) {
    currentRule.value = rule
  }

  function clearRules() {
    rules.value = []
    currentRule.value = null
  }

  function clearError() {
    error.value = null
  }

  // Utility to parse keywords JSON
  function parseKeywords(keywordsJson) {
    if (!keywordsJson) return []
    try {
      return JSON.parse(keywordsJson)
    } catch {
      return []
    }
  }

  // Utility to convert keywords array to JSON string
  function keywordsToJson(keywords) {
    if (!keywords || keywords.length === 0) return '[]'
    return JSON.stringify(keywords)
  }

  return {
    // State
    rules,
    currentRule,
    loading,
    initializing,
    error,
    // Getters
    rulesByFromPhase,
    rulesByToPhase,
    enabledRules,
    autoTransitionRules,
    sortedRules,
    // Actions
    fetchRules,
    fetchRule,
    createRule,
    updateRule,
    deleteRule,
    initializeDefaultRules,
    triggerTransition,
    setCurrentRule,
    clearRules,
    clearError,
    // Utilities
    parseKeywords,
    keywordsToJson
  }
})
