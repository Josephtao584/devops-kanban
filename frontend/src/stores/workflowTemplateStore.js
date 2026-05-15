import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as workflowTemplateApi from '../api/workflowTemplate.js'
import { useApiErrorHandler } from '../composables/useApiErrorHandler.js'

export const useWorkflowTemplateStore = defineStore('workflowTemplate', () => {
  const loading = ref(false)
  const error = ref(null)
  const apiError = useApiErrorHandler({ showMessage: false, defaultMessage: '操作失败' })

  async function fetchTemplates() {
    loading.value = true
    try {
      const response = await workflowTemplateApi.getWorkflowTemplates()
      if (response?.success) {
        return response
      }
      error.value = response?.message || '加载AgentTeam模板列表失败'
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '加载AgentTeam模板列表失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function getWorkflowTemplateById(id) {
    loading.value = true
    try {
      const response = await workflowTemplateApi.getWorkflowTemplateById(id)
      if (response?.success) {
        return response
      }
      error.value = response?.message || '加载AgentTeam模板失败'
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '加载AgentTeam模板失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function createTemplate(data) {
    loading.value = true
    try {
      const response = await workflowTemplateApi.createWorkflowTemplate(data)
      if (response?.success) {
        return response
      }
      error.value = response?.message || '创建AgentTeam模板失败'
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '创建AgentTeam模板失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateTemplate(data) {
    loading.value = true
    try {
      const response = await workflowTemplateApi.updateWorkflowTemplate(data)
      if (response?.success) {
        return response
      }
      error.value = response?.message || '更新AgentTeam模板失败'
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '更新AgentTeam模板失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteTemplate(templateId) {
    loading.value = true
    try {
      const response = await workflowTemplateApi.deleteWorkflowTemplate(templateId)
      if (response?.success) {
        return response
      }
      error.value = response?.message || '删除AgentTeam模板失败'
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '删除AgentTeam模板失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function reorderTemplates(templates) {
    try {
      const response = await workflowTemplateApi.reorderWorkflowTemplates(templates)
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '重排AgentTeam模板失败')
      throw err
    }
  }

  async function previewPrompt(data) {
    try {
      const response = await workflowTemplateApi.previewPrompt(data)
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '预览提示词失败')
      throw err
    }
  }

  return {
    loading,
    error,
    fetchTemplates,
    getWorkflowTemplateById,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    reorderTemplates,
    previewPrompt
  }
})
