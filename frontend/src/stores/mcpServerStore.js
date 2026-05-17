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

  const validateMcpServer = async (data) => {
    const response = await mcpServerApi.validate(data)
    return response
  }

  const exportMcpServers = async (serverIds) => {
    const response = await mcpServerApi.exportMcpServers(serverIds)
    return response
  }

  const previewImportMcpServers = async (data) => {
    const response = await mcpServerApi.previewImportMcpServers(data)
    return response
  }

  const confirmImportMcpServers = async (data) => {
    const response = await mcpServerApi.confirmImportMcpServers(data)
    return response
  }

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
    clearError: crud.clearError,
    validateMcpServer,
    exportMcpServers,
    previewImportMcpServers,
    confirmImportMcpServers
  }
})
