import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as taskWorktreeApi from '../api/taskWorktree.js'
import { useApiErrorHandler } from '../composables/useApiErrorHandler.js'

export const useTaskWorktreeStore = defineStore('taskWorktree', () => {
  const loading = ref(false)
  const error = ref(null)
  const apiError = useApiErrorHandler({ showMessage: false })

  async function createTaskWorktree(taskId) {
    loading.value = true
    try {
      const response = await taskWorktreeApi.createTaskWorktree(taskId)
      if (response?.success) {
        return response
      }
      error.value = response?.message || '创建 worktree 失败'
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '创建 worktree 失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteTaskWorktree(taskId) {
    loading.value = true
    try {
      const response = await taskWorktreeApi.deleteTaskWorktree(taskId)
      if (response?.success) {
        return response
      }
      error.value = response?.message || '删除 worktree 失败'
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '删除 worktree 失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    createTaskWorktree,
    deleteTaskWorktree
  }
})
