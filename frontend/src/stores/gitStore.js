import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as gitApi from '../api/git.js'
import { useApiErrorHandler } from '../composables/useApiErrorHandler.js'

export const useGitStore = defineStore('git', () => {
  const loading = ref(false)
  const error = ref(null)
  const apiError = useApiErrorHandler({ showMessage: false })

  async function getUncommittedChanges(projectId, taskId) {
    loading.value = true
    try {
      const response = await gitApi.getUncommittedChanges(projectId, taskId)
      if (response?.success) {
        return response
      }
      error.value = response?.message || '加载未提交变更失败'
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '加载未提交变更失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function getDiff(projectId, taskId) {
    loading.value = true
    try {
      const response = await gitApi.getDiff(projectId, taskId)
      if (response?.success) {
        return response
      }
      error.value = response?.message || '加载差异失败'
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '加载差异失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function pushWorktree(projectId, taskId, options) {
    loading.value = true
    try {
      const response = await gitApi.pushWorktree(projectId, taskId, options)
      if (response?.success) {
        return response
      }
      error.value = response?.message || '推送失败'
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '推送失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function mergeWorktreeIntoCurrent(projectId, taskId) {
    loading.value = true
    try {
      const response = await gitApi.mergeWorktreeIntoCurrent(projectId, taskId)
      if (response?.success) {
        return response
      }
      error.value = response?.message || '合入失败'
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '合入失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function getFileTree(projectId, taskId) {
    loading.value = true
    try {
      const response = await gitApi.getFileTree(projectId, taskId)
      if (response?.success) {
        return response
      }
      error.value = response?.message || '加载文件树失败'
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '加载文件树失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function readFileContent(projectId, taskId, filePath, options) {
    loading.value = true
    try {
      const response = await gitApi.readFileContent(projectId, taskId, filePath, options)
      if (response?.success) {
        return response
      }
      error.value = response?.message || '读取文件失败'
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '读取文件失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function writeFileContent(projectId, taskId, filePath, content) {
    loading.value = true
    try {
      const response = await gitApi.writeFileContent(projectId, taskId, filePath, content)
      if (response?.success) {
        return response
      }
      error.value = response?.message || '写入文件失败'
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '写入文件失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function listBranches(projectId) {
    loading.value = true
    try {
      const response = await gitApi.listBranches(projectId)
      if (response?.success) {
        return response
      }
      error.value = response?.message || '加载分支列表失败'
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '加载分支列表失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function mergeBranch(projectId, source, target) {
    loading.value = true
    try {
      const response = await gitApi.mergeBranch(projectId, source, target)
      if (response?.success) {
        return response
      }
      error.value = response?.message || '合并分支失败'
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '合并分支失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function commit(projectId, taskId, data) {
    loading.value = true
    try {
      const response = await gitApi.commit(projectId, taskId, data)
      if (response?.success) {
        return response
      }
      error.value = response?.message || '提交失败'
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '提交失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function stageFiles(projectId, taskId, files) {
    loading.value = true
    try {
      const response = await gitApi.stageFiles(projectId, taskId, files)
      if (response?.success) {
        return response
      }
      error.value = response?.message || '暂存文件失败'
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '暂存文件失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    getUncommittedChanges,
    getDiff,
    pushWorktree,
    mergeWorktreeIntoCurrent,
    getFileTree,
    readFileContent,
    writeFileContent,
    commit,
    stageFiles,
    listBranches,
    mergeBranch
  }
})
