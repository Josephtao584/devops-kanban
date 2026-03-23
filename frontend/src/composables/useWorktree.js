import { ref } from 'vue'
import * as taskWorktreeApi from '../api/taskWorktree'
import { ElMessage, ElMessageBox } from 'element-plus'

/**
 * Composable for managing worktree operations
 * Extracts common worktree logic from TaskColumn and KanbanListView
 */
export function useWorktree() {
  const worktreeLoading = ref(new Set())

  /**
   * Check if a task's worktree is currently being created/deleted
   */
  const isWorktreeLoading = (taskId) => worktreeLoading.value.has(taskId)

  /**
   * Get CSS class for worktree button based on task status
   */
  const getWorktreeClass = (task) => {
    if (task.worktree_status === 'created') return 'worktree-created'
    if (task.worktree_status === 'error') return 'worktree-error'
    return 'worktree-none'
  }

  /**
   * Get tooltip text for worktree button
   */
  const getWorktreeTooltip = (task) => {
    if (task.worktree_status === 'created') return 'Worktree 已创建，点击删除'
    if (task.worktree_status === 'error') return 'Worktree 创建失败'
    return '创建 Worktree 沙箱'
  }

  /**
   * Handle worktree create/delete action
   * @param {Object} task - Task object
   * @param {Function} onUpdate - Optional callback after worktree is updated
   */
  const handleWorktree = async (task, onUpdate) => {
    if (worktreeLoading.value.has(task.id)) return

    try {
      worktreeLoading.value.add(task.id)

      if (task.worktree_status === 'created') {
        // Confirm deletion by typing branch name
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
        if (confirmBranch.action !== 'confirm') return

        // Delete worktree
        const response = await taskWorktreeApi.deleteTaskWorktree(task.id)
        if (response.success) {
          task.worktree_path = null
          task.worktree_branch = null
          task.worktree_status = 'none'
          ElMessage.success('Worktree 已删除')
          if (onUpdate) {
            onUpdate(task)
          }
        }
      } else {
        // Create worktree
        const response = await taskWorktreeApi.createTaskWorktree(task.id)
        if (response.success) {
          task.worktree_path = response.data.worktree_path
          task.worktree_branch = response.data.worktree_branch
          task.worktree_status = 'created'
          ElMessage.success('Worktree 创建成功')
          if (onUpdate) {
            onUpdate(task)
          }
        }
      }
    } catch (error) {
      // Check if user cancelled (error will be 'cancel' or 'esc' string)
      const isCancelled = error === 'cancel' || error === 'esc'
      if (!isCancelled) {
        ElMessage.error(error.message || '操作失败')
      }
    } finally {
      worktreeLoading.value.delete(task.id)
    }
  }

  return {
    // State
    worktreeLoading,
    // Methods
    isWorktreeLoading,
    getWorktreeClass,
    getWorktreeTooltip,
    handleWorktree
  }
}