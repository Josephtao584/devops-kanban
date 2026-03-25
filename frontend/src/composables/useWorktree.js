import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import * as taskWorktreeApi from '../api/taskWorktree'
import { ElMessageBox } from 'element-plus'
import { useToast } from './ui/useToast'
import { useApiErrorHandler } from './useApiErrorHandler'

const escapeRegExp = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function useWorktree() {
  const { t } = useI18n()
  const toast = useToast()
  const apiError = useApiErrorHandler({ showMessage: false, defaultMessage: 'Worktree operation failed' })
  const worktreeLoading = ref(new Set())

  const isWorktreeLoading = (taskId) => worktreeLoading.value.has(taskId)

  const getWorktreeClass = (task) => {
    if (task.worktree_status === 'created') return 'worktree-created'
    if (task.worktree_status === 'error') return 'worktree-error'
    return 'worktree-none'
  }

  const getWorktreeTooltip = (task) => {
    if (task.worktree_status === 'created') return t('git.openLocalDirectory', '打开本地目录')
    if (task.worktree_status === 'error') return t('git.worktreeCreateFailed', 'Worktree 创建失败')
    return t('git.createWorktreeSandbox', '创建 Worktree 沙箱')
  }

  const getWorktreeStatusText = (task) => {
    if (task.worktree_status === 'created') return t('git.worktreeCreated', '已创建')
    if (task.worktree_status === 'error') return t('git.worktreeCreateError', '创建失败')
    return t('git.worktreeNotCreated', '未创建')
  }

  const getWorktreeBranchText = (task) => task?.worktree_branch || ''
  const hasWorktree = (task) => Boolean(task?.worktree_path)

  const confirmDeleteWorktree = async (task) => {
    const branchName = task.worktree_branch || ''
    const confirmBranch = await ElMessageBox.prompt(
      t('git.deleteWorktreeConfirmInput', { branch: branchName }),
      t('git.deleteWorktreeConfirmTitle', '二次确认'),
      {
        confirmButtonText: t('common.delete'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
        inputPattern: new RegExp(`^${escapeRegExp(branchName)}$`),
        inputErrorMessage: t('git.deleteWorktreeConfirmMismatch', { branch: branchName })
      }
    )
    return confirmBranch.action === 'confirm'
  }

  const applyCreatedWorktree = (task, data) => {
    task.worktree_path = data.worktree_path
    task.worktree_branch = data.worktree_branch
    task.worktree_status = 'created'
  }

  const clearCreatedWorktree = (task) => {
    task.worktree_path = null
    task.worktree_branch = null
    task.worktree_status = 'none'
  }

  const withWorktreeLoading = async (task, action) => {
    if (worktreeLoading.value.has(task.id)) return null

    worktreeLoading.value.add(task.id)
    try {
      return await action()
    } catch (error) {
      const isCancelled = error === 'cancel' || error === 'esc'
      if (!isCancelled) {
        toast.error(error?.message || t('git.worktreeOperationFailed', '操作失败'))
      }
      return null
    } finally {
      worktreeLoading.value.delete(task.id)
    }
  }

  const createWorktree = async (task, onUpdate) => withWorktreeLoading(task, async () => {
    const response = await taskWorktreeApi.createTaskWorktree(task.id)
    const data = apiError.unwrapResponse(response, t('git.worktreeCreateFailed', 'Worktree 创建失败'))
    applyCreatedWorktree(task, data)

    if (onUpdate) {
      onUpdate(task)
    }

    toast.success(t('git.worktreeCreateSuccess', 'Worktree 创建成功'))
    return task
  })

  const deleteWorktree = async (task, onUpdate) => withWorktreeLoading(task, async () => {
    const confirmed = await confirmDeleteWorktree(task)
    if (!confirmed) return null

    const response = await taskWorktreeApi.deleteTaskWorktree(task.id)
    apiError.unwrapResponse(response, t('git.worktreeDeleteFailed', 'Worktree 删除失败'))
    clearCreatedWorktree(task)

    if (onUpdate) {
      onUpdate(task)
    }

    toast.success(t('git.worktreeDeleteSuccess', 'Worktree 已删除'))
    return task
  })

  const handleWorktree = async (task, onUpdate) => {
    if (task.worktree_status === 'created') {
      return deleteWorktree(task, onUpdate)
    }
    return createWorktree(task, onUpdate)
  }

  return {
    worktreeLoading,
    isWorktreeLoading,
    getWorktreeClass,
    getWorktreeTooltip,
    getWorktreeStatusText,
    getWorktreeBranchText,
    hasWorktree,
    confirmDeleteWorktree,
    createWorktree,
    deleteWorktree,
    clearCreatedWorktree,
    handleWorktree
  }
}

export default useWorktree
