import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock dependencies before importing
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key, fallback) => fallback || key
  })
}))

vi.mock('../src/composables/ui/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  })
}))

vi.mock('../src/composables/useApiErrorHandler', () => ({
  useApiErrorHandler: () => ({
    unwrapResponse: vi.fn((response) => {
      if (response.success) return response.data
      throw new Error('Failed')
    })
  })
}))

vi.mock('../src/api/taskWorktree', () => ({
  createTaskWorktree: vi.fn(),
  deleteTaskWorktree: vi.fn()
}))

vi.mock('element-plus', () => ({
  ElMessageBox: {
    prompt: vi.fn()
  }
}))

import { useWorktree } from '../src/composables/useWorktree'
import * as taskWorktreeApi from '../src/api/taskWorktree'
const { createTaskWorktree, deleteTaskWorktree } = taskWorktreeApi
import { ElMessageBox } from 'element-plus'

describe('useWorktree', () => {
  let worktree

  beforeEach(() => {
    vi.clearAllMocks()
    worktree = useWorktree({ taskWorktreeApi })
  })

  describe('getWorktreeClass', () => {
    it('returns worktree-created for created status', () => {
      expect(worktree.getWorktreeClass({ worktree_status: 'created' })).toBe('worktree-created')
    })

    it('returns worktree-error for error status', () => {
      expect(worktree.getWorktreeClass({ worktree_status: 'error' })).toBe('worktree-error')
    })

    it('returns worktree-none for no status', () => {
      expect(worktree.getWorktreeClass({})).toBe('worktree-none')
      expect(worktree.getWorktreeClass({ worktree_status: null })).toBe('worktree-none')
    })
  })

  describe('getWorktreeTooltip', () => {
    it('returns correct tooltip for each status', () => {
      expect(worktree.getWorktreeTooltip({ worktree_status: 'created' })).toBe('打开本地目录')
      expect(worktree.getWorktreeTooltip({ worktree_status: 'error' })).toBe('Worktree 创建失败')
      expect(worktree.getWorktreeTooltip({})).toBe('创建 Worktree 沙箱')
    })
  })

  describe('getWorktreeStatusText', () => {
    it('returns correct status text', () => {
      expect(worktree.getWorktreeStatusText({ worktree_status: 'created' })).toBe('已创建')
      expect(worktree.getWorktreeStatusText({ worktree_status: 'error' })).toBe('创建失败')
      expect(worktree.getWorktreeStatusText({})).toBe('未创建')
    })
  })

  describe('getWorktreeBranchText', () => {
    it('returns branch name', () => {
      expect(worktree.getWorktreeBranchText({ worktree_branch: 'feature/test' })).toBe('feature/test')
    })

    it('returns empty string for missing branch', () => {
      expect(worktree.getWorktreeBranchText({})).toBe('')
      expect(worktree.getWorktreeBranchText(null)).toBe('')
    })
  })

  describe('hasWorktree', () => {
    it('returns true when worktree_path is set', () => {
      expect(worktree.hasWorktree({ worktree_path: '/some/path' })).toBe(true)
    })

    it('returns false when worktree_path is missing', () => {
      expect(worktree.hasWorktree({})).toBe(false)
      expect(worktree.hasWorktree(null)).toBe(false)
    })
  })

  describe('isWorktreeLoading', () => {
    it('returns false initially', () => {
      expect(worktree.isWorktreeLoading(1)).toBe(false)
    })
  })

  describe('clearCreatedWorktree', () => {
    it('clears worktree fields on task', () => {
      const task = { worktree_path: '/path', worktree_branch: 'branch', worktree_status: 'created' }
      worktree.clearCreatedWorktree(task)

      expect(task.worktree_path).toBeNull()
      expect(task.worktree_branch).toBeNull()
      expect(task.worktree_status).toBe('none')
    })
  })

  describe('createWorktree', () => {
    it('calls API and updates task on success', async () => {
      createTaskWorktree.mockResolvedValue({
        success: true,
        data: { worktree_path: '/new/path', worktree_branch: 'twp/1-test' }
      })

      const task = { id: 1, worktree_status: 'none' }
      const result = await worktree.createWorktree(task)

      expect(createTaskWorktree).toHaveBeenCalledWith(1)
      expect(task.worktree_path).toBe('/new/path')
      expect(task.worktree_branch).toBe('twp/1-test')
      expect(task.worktree_status).toBe('created')
      expect(result).toBe(task)
    })

    it('calls onUpdate callback after creation', async () => {
      createTaskWorktree.mockResolvedValue({
        success: true,
        data: { worktree_path: '/path', worktree_branch: 'branch' }
      })

      const task = { id: 1, worktree_status: 'none' }
      const onUpdate = vi.fn()
      await worktree.createWorktree(task, onUpdate)

      expect(onUpdate).toHaveBeenCalledWith(task)
    })

    it('sets loading state during creation', async () => {
      createTaskWorktree.mockImplementation(() => new Promise(resolve =>
        setTimeout(() => resolve({ success: true, data: { worktree_path: '/p', worktree_branch: 'b' } }), 10)
      ))

      const task = { id: 5, worktree_status: 'none' }
      const promise = worktree.createWorktree(task)
      expect(worktree.isWorktreeLoading(5)).toBe(true)
      await promise
      expect(worktree.isWorktreeLoading(5)).toBe(false)
    })
  })

  describe('deleteWorktree', () => {
    it('calls API and clears task on confirm', async () => {
      ElMessageBox.prompt.mockResolvedValue({ action: 'confirm' })
      deleteTaskWorktree.mockResolvedValue({ success: true })

      const task = { id: 1, worktree_path: '/path', worktree_branch: 'branch', worktree_status: 'created' }
      const result = await worktree.deleteWorktree(task)

      expect(ElMessageBox.prompt).toHaveBeenCalled()
      expect(deleteTaskWorktree).toHaveBeenCalledWith(1)
      expect(task.worktree_path).toBeNull()
      expect(task.worktree_branch).toBeNull()
      expect(task.worktree_status).toBe('none')
    })

    it('returns null when user cancels', async () => {
      ElMessageBox.prompt.mockRejectedValue('cancel')

      const task = { id: 1, worktree_path: '/path', worktree_branch: 'branch', worktree_status: 'created' }
      const result = await worktree.deleteWorktree(task)

      expect(deleteTaskWorktree).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })
  })

  describe('handleWorktree', () => {
    it('delegates to createWorktree when status is not created', async () => {
      createTaskWorktree.mockResolvedValue({
        success: true,
        data: { worktree_path: '/path', worktree_branch: 'b' }
      })

      const task = { id: 1, worktree_status: 'none' }
      await worktree.handleWorktree(task)

      expect(createTaskWorktree).toHaveBeenCalledWith(1)
    })

    it('delegates to deleteWorktree when status is created', async () => {
      ElMessageBox.prompt.mockResolvedValue({ action: 'confirm' })
      deleteTaskWorktree.mockResolvedValue({ success: true })

      const task = { id: 1, worktree_path: '/path', worktree_branch: 'b', worktree_status: 'created' }
      await worktree.handleWorktree(task)

      expect(deleteTaskWorktree).toHaveBeenCalledWith(1)
    })
  })
})
