import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as workflowApi from '../api/workflow.js'
import { useApiErrorHandler } from '../composables/useApiErrorHandler.js'

export const useWorkflowStore = defineStore('workflow', () => {
  const loading = ref(false)
  const error = ref(null)
  const apiError = useApiErrorHandler({ showMessage: false, defaultMessage: '操作失败' })

  async function retryWorkflow(runId, retryNote) {
    loading.value = true
    try {
      const response = await workflowApi.retryWorkflow(runId, retryNote)
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '重试失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function getWorkflowRun(runId) {
    loading.value = true
    try {
      return await workflowApi.getWorkflowRun(runId)
    } catch (err) {
      error.value = apiError.handleError(err, '加载失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function getWorkflowRunsByTask(taskId) {
    loading.value = true
    try {
      return await workflowApi.getWorkflowRunsByTask(taskId)
    } catch (err) {
      error.value = apiError.handleError(err, '加载失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function cancelWorkflow(runId) {
    loading.value = true
    try {
      return await workflowApi.cancelWorkflow(runId)
    } catch (err) {
      error.value = apiError.handleError(err, '取消失败')
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

  async function loopWorkflow(runId, data) {
    loading.value = true
    try {
      const res = await workflowApi.loopWorkflow(runId, data)
      if (!res.success) {
        throw new Error(res.message || '回退失败')
      }
      return res.data
    } catch (err) {
      error.value = apiError.handleError(err, '回退失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  return { loading, error, retryWorkflow, resumeWorkflow, loopWorkflow, getWorkflowRun, getWorkflowRunsByTask, cancelWorkflow }
})
