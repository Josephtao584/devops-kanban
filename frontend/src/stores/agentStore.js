import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as agentApi from '../api/agent'

export const useAgentStore = defineStore('agent', () => {
  // State
  const agents = ref([])
  const currentAgent = ref(null)
  const loading = ref(false)
  const error = ref(null)

  // Getters
  const enabledAgents = computed(() => agents.value.filter(a => a.enabled))
  const agentsByType = computed(() => {
    const grouped = {}
    agents.value.forEach(agent => {
      const type = agent.type || 'OTHER'
      if (!grouped[type]) {
        grouped[type] = []
      }
      grouped[type].push(agent)
    })
    return grouped
  })

  // Actions
  async function fetchAgents() {
    loading.value = true
    error.value = null
    try {
      const response = await agentApi.getAgents()
      if (response.success) {
        agents.value = response.data
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchAgent(id) {
    loading.value = true
    error.value = null
    try {
      const response = await agentApi.getAgent(id)
      if (response.success) {
        currentAgent.value = response.data
        return response.data
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createAgent(agentData) {
    loading.value = true
    error.value = null
    try {
      const response = await agentApi.createAgent(agentData)
      if (response.success) {
        agents.value.push(response.data)
        return response.data
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateAgent(id, agentData) {
    loading.value = true
    error.value = null
    try {
      const response = await agentApi.updateAgent(id, agentData)
      if (response.success) {
        const index = agents.value.findIndex(a => a.id === id)
        if (index !== -1) {
          agents.value[index] = response.data
        }
        if (currentAgent.value?.id === id) {
          currentAgent.value = response.data
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

  async function deleteAgent(id) {
    loading.value = true
    error.value = null
    try {
      const response = await agentApi.deleteAgent(id)
      if (response.success) {
        agents.value = agents.value.filter(a => a.id !== id)
        if (currentAgent.value?.id === id) {
          currentAgent.value = null
        }
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function toggleAgentEnabled(id) {
    const agent = agents.value.find(a => a.id === id)
    if (agent) {
      return updateAgent(id, { ...agent, enabled: !agent.enabled })
    }
  }

  function setCurrentAgent(agent) {
    currentAgent.value = agent
  }

  function clearAgents() {
    agents.value = []
    currentAgent.value = null
  }

  function clearError() {
    error.value = null
  }

  return {
    // State
    agents,
    currentAgent,
    loading,
    error,
    // Getters
    enabledAgents,
    agentsByType,
    // Actions
    fetchAgents,
    fetchAgent,
    createAgent,
    updateAgent,
    deleteAgent,
    toggleAgentEnabled,
    setCurrentAgent,
    clearAgents,
    clearError
  }
})
