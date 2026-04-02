import { defineStore } from 'pinia'
import { useCrudStore } from '../composables/useCrudStore'
import { mcpServerApi } from '../api/mcpServer'

export const useMcpServerStore = defineStore('mcpServer', () => {
  const crud = useCrudStore({
    api: mcpServerApi,
    apiMethods: {
      getAll: 'list',
      getById: 'get',
      create: 'create',
      update: 'update',
      delete: 'delete'
    }
  })

  return {
    mcpServers: crud.items,
    currentMcpServer: crud.currentItem,
    loading: crud.loading,
    error: crud.error,
    fetchMcpServers: crud.fetchAll,
    fetchMcpServer: crud.fetchById,
    createMcpServer: crud.create,
    updateMcpServer: crud.update,
    deleteMcpServer: crud.deleteItem,
    setCurrentMcpServer: crud.setCurrentItem,
    clearMcpServers: crud.clearItems,
    clearError: crud.clearError
  }
})
