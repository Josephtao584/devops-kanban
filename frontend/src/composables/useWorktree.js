import { ref } from 'vue'
import * as taskWorktreeApi from '../api/taskWorktree'
import { ElMessageBox } from 'element-plus'
import { useToast } from './ui/useToast'
import { useApiErrorHandler } from './useApiErrorHandler'

export function useWorktree() {
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
    if (task.worktree_status === 'created') return 'Worktree 已创建，点击删除'
    if (task.worktree_status === 'error') return 'Worktree 创建失败'
    return '创建 Worktree 沙箱'
  }

  const getWorktreeStatusText = (task) => {
    if (task.worktree_status === 'created') return '已创建'
    if (task.worktree_status === 'error') return '创建失败'
    return '未创建'
  }

  const getWorktreeBranchText = (task) => task?.worktree_branch || ''
  const hasWorktree = (task) => Boolean(task?.worktree_path)

  const confirmDeleteWorktree = async (task) => {
    const confirmBranch = await ElMessageBox.prompt(
      `请输入 branch 名称 "${task.worktree_branch}" 确认删除`,
      '二次确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
        inputPattern: new RegExp(`^${task.worktree_branch}$`),
        inputErrorMessage: `branch 名称不匹配，应为 "${task.worktree_branch}"`,
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

  const handleWorktree = async (task, onUpdate) => {
    if (worktreeLoading.value.has(task.id)) return null

    worktreeLoading.value.add(task.id)
    try {
      if (task.worktree_status === 'created') {
        const confirmed = await confirmDeleteWorktree(task)
        if (!confirmed) return null

        const response = await taskWorktreeApi.deleteTaskWorktree(task.id)
        apiError.unwrapResponse(response, 'Worktree 删除失败')
        clearCreatedWorktree(task)
        toast.success('Worktree 已删除')
      } else {
        const response = await taskWorktreeApi.createTaskWorktree(task.id)
        const data = apiError.unwrapResponse(response, 'Worktree 创建失败')
        applyCreatedWorktree(task, data)
        toast.success('Worktree 创建成功')
      }

      if (onUpdate) {
        onUpdate(task)
      }
      return task
    } catch (error) {
      const isCancelled = error === 'cancel' || error === 'esc'
      if (!isCancelled) {
        toast.error(error?.message || '操作失败')
      }
      return null
    } finally {
      worktreeLoading.value.delete(task.id)
    }
  }

  return {
    worktreeLoading,
    isWorktreeLoading,
    getWorktreeClass,
    getWorktreeTooltip,
    getWorktreeStatusText,
    getWorktreeBranchText,
    hasWorktree,
    handleWorktree
  }
}

export default useWorktree
