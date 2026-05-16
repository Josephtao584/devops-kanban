import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as agentChatApi from '../api/agentChat.js'
import { useApiErrorHandler } from '../composables/useApiErrorHandler.js'

export const useAgentChatStore = defineStore('agentChat', () => {
  const loading = ref(false)
  const error = ref(null)
  const apiError = useApiErrorHandler({ showMessage: false, defaultMessage: '操作失败' })

  async function createChatSession(agentId) {
    loading.value = true
    try {
      const response = await agentChatApi.createChatSession(agentId)
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '创建聊天会话失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteChatSession(agentId, chatId) {
    loading.value = true
    try {
      const response = await agentChatApi.deleteChatSession(agentId, chatId)
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '删除聊天会话失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function getLatestChatSession(agentId) {
    loading.value = true
    try {
      const response = await agentChatApi.getLatestChatSession(agentId)
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '获取聊天会话失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  // streamChatMessage is not a promise-based API call, it returns an AbortController
  // We expose it directly for components to use
  function streamChatMessage(...args) {
    return agentChatApi.streamChatMessage(...args)
  }

  return { loading, error, createChatSession, deleteChatSession, getLatestChatSession, streamChatMessage }
})
