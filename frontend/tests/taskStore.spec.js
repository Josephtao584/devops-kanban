import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTaskStore } from '../src/stores/taskStore'

const mockTaskApi = vi.hoisted(() => ({
  getTasks: vi.fn(),
  getTask: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  updateTaskStatus: vi.fn()
}))

vi.mock('../src/api/task', () => ({ ...mockTaskApi }))

describe('taskStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('fetchTasks', () => {
    it('passes projectId to API', async () => {
      mockTaskApi.getTasks.mockResolvedValue({
        success: true,
        data: [{ id: 1, title: 'Task 1', status: 'TODO' }]
      })

      const store = useTaskStore()
      await store.fetchTasks('project-42')

      expect(mockTaskApi.getTasks).toHaveBeenCalledWith('project-42')
      expect(store.tasks).toHaveLength(1)
    })

    it('sets loading state during fetch', async () => {
      let loadingDuringFetch = false
      mockTaskApi.getTasks.mockImplementation(async () => {
        return { success: true, data: [] }
      })

      const store = useTaskStore()
      const promise = store.fetchTasks('p1')
      loadingDuringFetch = store.loading
      await promise

      expect(loadingDuringFetch).toBe(true)
      expect(store.loading).toBe(false)
    })
  })

  describe('tasksByStatus', () => {
    it('groups tasks by status', async () => {
      mockTaskApi.getTasks.mockResolvedValue({
        success: true,
        data: [
          { id: 1, status: 'TODO', title: 'A' },
          { id: 2, status: 'IN_PROGRESS', title: 'B' },
          { id: 3, status: 'TODO', title: 'C' },
          { id: 4, status: 'DONE', title: 'D' },
          { id: 5, status: 'BLOCKED', title: 'E' }
        ]
      })

      const store = useTaskStore()
      await store.fetchTasks('p1')

      expect(store.tasksByStatus.TODO).toHaveLength(2)
      expect(store.tasksByStatus.IN_PROGRESS).toHaveLength(1)
      expect(store.tasksByStatus.DONE).toHaveLength(1)
      expect(store.tasksByStatus.BLOCKED).toHaveLength(1)
    })

    it('defaults unknown status to TODO group', async () => {
      mockTaskApi.getTasks.mockResolvedValue({
        success: true,
        data: [{ id: 1, title: 'No status' }]
      })

      const store = useTaskStore()
      await store.fetchTasks('p1')

      expect(store.tasksByStatus.TODO).toHaveLength(1)
    })

    it('returns empty groups when no tasks', () => {
      const store = useTaskStore()
      const grouped = store.tasksByStatus
      expect(grouped.TODO).toEqual([])
      expect(grouped.IN_PROGRESS).toEqual([])
      expect(grouped.DONE).toEqual([])
      expect(grouped.BLOCKED).toEqual([])
    })
  })

  describe('updateTaskStatus', () => {
    it('calls API and updates task in list', async () => {
      mockTaskApi.getTasks.mockResolvedValue({
        success: true,
        data: [{ id: 1, status: 'TODO', title: 'A' }]
      })
      mockTaskApi.updateTaskStatus.mockResolvedValue({
        success: true,
        data: { id: 1, status: 'IN_PROGRESS', title: 'A' }
      })

      const store = useTaskStore()
      await store.fetchTasks('p1')
      await store.updateTaskStatus(1, 'IN_PROGRESS')

      expect(mockTaskApi.updateTaskStatus).toHaveBeenCalledWith(1, 'IN_PROGRESS')
      expect(store.tasks[0].status).toBe('IN_PROGRESS')
    })
  })

  describe('clearTasks', () => {
    it('empties the tasks array', async () => {
      mockTaskApi.getTasks.mockResolvedValue({
        success: true,
        data: [{ id: 1 }, { id: 2 }]
      })

      const store = useTaskStore()
      await store.fetchTasks('p1')
      expect(store.tasks).toHaveLength(2)

      store.clearTasks()
      expect(store.tasks).toHaveLength(0)
    })
  })

  describe('clearError', () => {
    it('resets error state', async () => {
      mockTaskApi.getTasks.mockResolvedValue({
        success: false,
        message: 'Failed'
      })

      const store = useTaskStore()
      try { await store.fetchTasks('p1') } catch (e) { /* expected */ }
      expect(store.error).toBeTruthy()

      store.clearError()
      expect(store.error).toBeNull()
    })
  })
})
