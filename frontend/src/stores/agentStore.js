import { defineStore } from 'pinia'
import { useCrudStore } from '../composables/useCrudStore'
import * as agentApi from '../api/agent'

export const useAgentStore = defineStore('agent', () => {
  const crud = useCrudStore({
    api: agentApi,
    apiMethods: {
      getAll: 'getAgents',
      create: 'createAgent',
      update: 'updateAgent',
      delete: 'deleteAgent'
    }
  })

  async function toggleAgentEnabled(id) {
    const agent = crud.items.value.find(a => a.id === id)
    if (agent) {
      const skills = Array.isArray(agent.skills) ? agent.skills : JSON.parse(agent.skills || '[]')
      return crud.update(id, { ...agent, enabled: !agent.enabled, skills })
    }
  }

  return {
    // State
    agents: crud.items,
    currentAgent: crud.currentItem,
    loading: crud.loading,
    error: crud.error,
    // Actions
    fetchAgents: crud.fetchAll,
    createAgent: crud.create,
    updateAgent: crud.update,
    deleteAgent: crud.deleteItem,
    toggleAgentEnabled,
    clearError: crud.clearError
  }
})
