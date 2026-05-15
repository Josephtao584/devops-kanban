import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as workflowApi from '../api/workflow.js'
import { useApiErrorHandler } from '../composables/useApiErrorHandler.js'

export const useWorkflowStore = defineStore('workflow', () => {
  const loading = ref(false)
  const error = ref(null)
  const apiError = useApiErrorHandler({ showMessage: false, defaultMessage: '操作失败' })

  async function retryWorkflow(runId) {
    loading.value = true
    try {
      const response = await workflowApi.retryWorkflow(runId)
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '重试失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function resumeWorkflow(runId, data) {
    loading.value = true
    try {
      const response = await workflowApi.resumeWorkflow(runId, data)
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '确认失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  return { loading, error, retryWorkflow, resumeWorkflow }
})
