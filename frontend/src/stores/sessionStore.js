import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as sessionApi from '../api/session.js'
import { useApiErrorHandler } from '../composables/useApiErrorHandler.js'

export const useSessionStore = defineStore('session', () => {
  const loading = ref(false)
  const error = ref(null)
  const apiError = useApiErrorHandler({ showMessage: false, defaultMessage: '操作失败' })

  async function getSession(id) {
    loading.value = true
    try {
      const response = await sessionApi.getSession(id)
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '获取会话失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function continueSession(id, input) {
    loading.value = true
    try {
      const response = await sessionApi.continueSession(id, input)
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '继续会话失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  return { loading, error, getSession, continueSession }
})
