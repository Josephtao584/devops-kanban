import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useIterationStore } from '../src/stores/iterationStore'

const mockIterationApi = vi.hoisted(() => ({
  getIterations: vi.fn(),
  getIteration: vi.fn(),
  getIterationWithStats: vi.fn(),
  createIteration: vi.fn(),
  updateIteration: vi.fn(),
  updateIterationStatus: vi.fn(),
  deleteIteration: vi.fn()
}))

vi.mock('../src/api/iteration', () => ({ ...mockIterationApi }))

describe('iterationStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('fetchByProject', () => {
    it('passes projectId to API and sets iterations', async () => {
      mockIterationApi.getIterations.mockResolvedValue({
        success: true,
        data: [
          { id: 1, name: 'Sprint 1', project_id: 42 },
          { id: 2, name: 'Sprint 2', project_id: 42 }
        ]
      })

      const store = useIterationStore()
      await store.fetchByProject(42)

      expect(mockIterationApi.getIterations).toHaveBeenCalledWith(42)
      expect(store.iterations).toHaveLength(2)
    })

    it('sets loading during fetch', async () => {
      let loadingDuringFetch = false
      mockIterationApi.getIterations.mockImplementation(async () => {
        return { success: true, data: [] }
      })

      const store = useIterationStore()
      const promise = store.fetchByProject(1)
      loadingDuringFetch = store.loading
      await promise

      expect(loadingDuringFetch).toBe(true)
      expect(store.loading).toBe(false)
    })

    it('sets error on failure', async () => {
      mockIterationApi.getIterations.mockResolvedValue({
        success: false,
        message: 'Server error'
      })

      const store = useIterationStore()
      await expect(store.fetchByProject(1)).rejects.toThrow('Server error')
      expect(store.error).toBe('Server error')
    })
  })

  describe('fetchWithStats', () => {
    it('returns iteration with stats from API', async () => {
      mockIterationApi.getIterationWithStats.mockResolvedValue({
        success: true,
        data: { id: 1, name: 'Sprint 1', taskCount: 5 }
      })

      const store = useIterationStore()
      const result = await store.fetchWithStats(1)

      expect(mockIterationApi.getIterationWithStats).toHaveBeenCalledWith(1)
      expect(result).toEqual({ id: 1, name: 'Sprint 1', taskCount: 5 })
    })

    it('throws on API failure', async () => {
      mockIterationApi.getIterationWithStats.mockResolvedValue({
        success: false,
        message: 'Not found'
      })

      const store = useIterationStore()
      await expect(store.fetchWithStats(999)).rejects.toThrow('Not found')
    })
  })

  describe('updateStatus', () => {
    it('updates status and refreshes item in list', async () => {
      mockIterationApi.getIterations.mockResolvedValue({
        success: true,
        data: [{ id: 1, name: 'Sprint 1', status: 'ACTIVE', project_id: 1 }]
      })
      mockIterationApi.updateIterationStatus.mockResolvedValue({
        success: true,
        data: { id: 1, name: 'Sprint 1', status: 'COMPLETED', project_id: 1 }
      })

      const store = useIterationStore()
      await store.fetchByProject(1)
      await store.updateStatus(1, 'COMPLETED')

      expect(mockIterationApi.updateIterationStatus).toHaveBeenCalledWith(1, 'COMPLETED')
      expect(store.iterations[0].status).toBe('COMPLETED')
    })

    it('updates currentItem if it matches', async () => {
      mockIterationApi.getIterations.mockResolvedValue({
        success: true,
        data: [{ id: 1, name: 'Sprint 1', status: 'ACTIVE', project_id: 1 }]
      })
      mockIterationApi.updateIterationStatus.mockResolvedValue({
        success: true,
        data: { id: 1, name: 'Sprint 1', status: 'COMPLETED', project_id: 1 }
      })

      const store = useIterationStore()
      await store.fetchByProject(1)
      store.setCurrentIteration(store.iterations[0])
      await store.updateStatus(1, 'COMPLETED')

      expect(store.currentIteration.status).toBe('COMPLETED')
    })
  })

  describe('deleteIteration', () => {
    it('removes iteration from list', async () => {
      mockIterationApi.getIterations.mockResolvedValue({
        success: true,
        data: [
          { id: 1, name: 'Sprint 1', project_id: 1 },
          { id: 2, name: 'Sprint 2', project_id: 1 }
        ]
      })
      mockIterationApi.deleteIteration.mockResolvedValue({ success: true })

      const store = useIterationStore()
      await store.fetchByProject(1)
      await store.deleteIteration(1)

      expect(mockIterationApi.deleteIteration).toHaveBeenCalledWith(1, {})
      expect(store.iterations).toHaveLength(1)
      expect(store.iterations[0].id).toBe(2)
    })

    it('passes options to API', async () => {
      mockIterationApi.deleteIteration.mockResolvedValue({ success: true })

      const store = useIterationStore()
      await store.deleteIteration(5, { deleteTasks: true })

      expect(mockIterationApi.deleteIteration).toHaveBeenCalledWith(5, { deleteTasks: true })
    })

    it('clears currentItem if it was deleted', async () => {
      mockIterationApi.getIterations.mockResolvedValue({
        success: true,
        data: [{ id: 1, name: 'Sprint 1', project_id: 1 }]
      })
      mockIterationApi.deleteIteration.mockResolvedValue({ success: true })

      const store = useIterationStore()
      await store.fetchByProject(1)
      store.setCurrentIteration(store.iterations[0])
      await store.deleteIteration(1)

      expect(store.currentIteration).toBeNull()
    })
  })

  describe('iterationsByProject', () => {
    it('filters iterations by project_id', async () => {
      mockIterationApi.getIterations.mockResolvedValue({
        success: true,
        data: [
          { id: 1, name: 'A', project_id: 10 },
          { id: 2, name: 'B', project_id: 20 },
          { id: 3, name: 'C', project_id: 10 }
        ]
      })

      const store = useIterationStore()
      await store.fetchByProject(10)

      expect(store.iterationsByProject(10)).toHaveLength(2)
      expect(store.iterationsByProject(20)).toHaveLength(1)
      expect(store.iterationsByProject(null)).toEqual([])
    })
  })

  describe('clearError', () => {
    it('resets error state', async () => {
      mockIterationApi.getIterations.mockResolvedValue({
        success: false,
        message: 'Failed'
      })

      const store = useIterationStore()
      try { await store.fetchByProject(1) } catch (e) { /* expected */ }
      expect(store.error).toBeTruthy()

      store.clearError()
      expect(store.error).toBeNull()
    })
  })
})
