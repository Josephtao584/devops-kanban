import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useCrudStore } from '../composables/useCrudStore'
import * as agentApi from '../api/agent'

export const useAgentStore = defineStore('agent', () => {
  const crud = useCrudStore({
    api: agentApi,
    apiMethods: {
      getAll: 'getAgents',
      getById: 'getAgent',
      create: 'createAgent',
      update: 'updateAgent',
      delete: 'deleteAgent'
    }
  })

  // Custom getters
  const enabledAgents = computed(() => crud.items.value.filter(a => a.enabled))
  const agentsByType = computed(() => {
    const grouped = {}
    crud.items.value.forEach(agent => {
      const executorType = agent.executorType || 'OTHER'
      if (!grouped[executorType]) {
        grouped[executorType] = []
      }
      grouped[executorType].push(agent)
    })
    return grouped
  })

  function setCurrentAgent(agent) {
    crud.setCurrentItem(agent)
  }

  async function toggleAgentEnabled(id) {
    const agent = crud.items.value.find(a => a.id === id)
    if (agent) {
      return crud.update(id, { ...agent, enabled: !agent.enabled })
    }
  }

  return {
    // State
    agents: crud.items,
    currentAgent: crud.currentItem,
    loading: crud.loading,
    error: crud.error,
    // Getters
    enabledAgents,
    agentsByType,
    // Actions
    fetchAgents: crud.fetchAll,
    fetchAgent: crud.fetchById,
    createAgent: crud.create,
    updateAgent: crud.update,
    deleteAgent: crud.deleteItem,
    toggleAgentEnabled,
    setCurrentAgent,
    clearAgents: crud.clearItems,
    clearError: crud.clearError
  }
})
