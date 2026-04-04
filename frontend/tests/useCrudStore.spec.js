import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { useCrudStore } from '../src/composables/useCrudStore'

function createMockApi() {
  return {
    get: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}

describe('useCrudStore', () => {
  let mockApi

  beforeEach(() => {
    mockApi = createMockApi()
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('exposes reactive state refs', () => {
      const store = useCrudStore({ api: mockApi })
      expect(store.items).toBeDefined()
      expect(store.currentItem).toBeDefined()
      expect(store.loading).toBeDefined()
      expect(store.error).toBeDefined()
    })

    it('starts with empty state', () => {
      const store = useCrudStore({ api: mockApi })
      expect(store.items.value).toEqual([])
      expect(store.currentItem.value).toBeNull()
      expect(store.loading.value).toBe(false)
      expect(store.error.value).toBeNull()
    })
  })

  describe('fetchAll', () => {
    it('calls API getAll method and sets items', async () => {
      mockApi.get.mockResolvedValue({
        success: true,
        data: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }]
      })

      const store = useCrudStore({ api: mockApi })
      await store.fetchAll()

      expect(mockApi.get).toHaveBeenCalledTimes(1)
      expect(store.items.value).toEqual([{ id: 1, name: 'A' }, { id: 2, name: 'B' }])
    })

    it('sets loading during fetch', async () => {
      let loadingDuringFetch = false
      mockApi.get.mockImplementation(async () => {
        return { success: true, data: [] }
      })

      const store = useCrudStore({ api: mockApi })
      const promise = store.fetchAll()
      loadingDuringFetch = store.loading.value
      await promise

      expect(loadingDuringFetch).toBe(true)
      expect(store.loading.value).toBe(false)
    })

    it('sets error on API failure', async () => {
      mockApi.get.mockResolvedValue({
        success: false,
        message: 'Fetch failed'
      })

      const store = useCrudStore({ api: mockApi })
      await expect(store.fetchAll()).rejects.toThrow('Fetch failed')
      expect(store.error.value).toBe('Fetch failed')
    })

    it('uses custom apiMethods.getAll name', async () => {
      const customApi = { listAll: vi.fn().mockResolvedValue({ success: true, data: [] }) }
      const store = useCrudStore({ api: customApi, apiMethods: { getAll: 'listAll' } })
      await store.fetchAll()
      expect(customApi.listAll).toHaveBeenCalledTimes(1)
    })

    it('passes fetchAllParams to API method', async () => {
      mockApi.get.mockResolvedValue({ success: true, data: [] })
      const store = useCrudStore({
        api: mockApi,
        fetchAllParams: () => ({ projectId: 42 })
      })
      await store.fetchAll()
      expect(mockApi.get).toHaveBeenCalledWith({ projectId: 42 })
    })
  })

  describe('fetchById', () => {
    it('calls API getById and sets currentItem', async () => {
      mockApi.getById.mockResolvedValue({
        success: true,
        data: { id: 1, name: 'A' }
      })

      const store = useCrudStore({ api: mockApi })
      const result = await store.fetchById(1)

      expect(mockApi.getById).toHaveBeenCalledWith(1)
      expect(store.currentItem.value).toEqual({ id: 1, name: 'A' })
    })
  })

  describe('create', () => {
    it('calls API create and adds item to list', async () => {
      mockApi.create.mockResolvedValue({
        success: true,
        data: { id: 1, name: 'New' }
      })

      const store = useCrudStore({ api: mockApi })
      await store.create({ name: 'New' })

      expect(mockApi.create).toHaveBeenCalledWith({ name: 'New' })
      expect(store.items.value).toContainEqual({ id: 1, name: 'New' })
    })

    it('applies transformCreate before calling API', async () => {
      mockApi.create.mockResolvedValue({ success: true, data: { id: 1 } })
      const transformCreate = (data) => ({ ...data, extra: true })

      const store = useCrudStore({ api: mockApi, transformCreate })
      await store.create({ name: 'Test' })

      expect(mockApi.create).toHaveBeenCalledWith({ name: 'Test', extra: true })
    })
  })

  describe('update', () => {
    it('calls API update and replaces item in list', async () => {
      mockApi.get.mockResolvedValue({
        success: true,
        data: [{ id: 1, name: 'Old' }]
      })
      mockApi.update.mockResolvedValue({
        success: true,
        data: { id: 1, name: 'Updated' }
      })

      const store = useCrudStore({ api: mockApi })
      await store.fetchAll()
      await store.update(1, { name: 'Updated' })

      expect(mockApi.update).toHaveBeenCalledWith(1, { name: 'Updated' })
      expect(store.items.value[0]).toEqual({ id: 1, name: 'Updated' })
    })
  })

  describe('deleteItem', () => {
    it('calls API delete and removes item from list', async () => {
      mockApi.get.mockResolvedValue({
        success: true,
        data: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }]
      })
      mockApi.delete.mockResolvedValue({ success: true })

      const store = useCrudStore({ api: mockApi })
      await store.fetchAll()
      await store.deleteItem(1)

      expect(mockApi.delete).toHaveBeenCalledWith(1)
      expect(store.items.value).toEqual([{ id: 2, name: 'B' }])
    })

    it('clears currentItem if it was the deleted item', async () => {
      mockApi.get.mockResolvedValue({
        success: true,
        data: [{ id: 1, name: 'A' }]
      })
      mockApi.delete.mockResolvedValue({ success: true })

      const store = useCrudStore({ api: mockApi })
      await store.fetchAll()
      store.setCurrentItem({ id: 1, name: 'A' })
      await store.deleteItem(1)

      expect(store.currentItem.value).toBeNull()
    })
  })

  describe('state management', () => {
    it('setCurrentItem sets currentItem', () => {
      const store = useCrudStore({ api: mockApi })
      store.setCurrentItem({ id: 5, name: 'Test' })
      expect(store.currentItem.value).toEqual({ id: 5, name: 'Test' })
    })

    it('clearCurrentItem resets currentItem', () => {
      const store = useCrudStore({ api: mockApi })
      store.setCurrentItem({ id: 5 })
      store.clearCurrentItem()
      expect(store.currentItem.value).toBeNull()
    })

    it('clearItems empties items and currentItem', () => {
      const store = useCrudStore({ api: mockApi })
      store.items.value = [{ id: 1 }, { id: 2 }]
      store.setCurrentItem({ id: 1 })
      store.clearItems()
      expect(store.items.value).toEqual([])
      expect(store.currentItem.value).toBeNull()
    })

    it('clearError resets error', () => {
      const store = useCrudStore({ api: mockApi })
      store.error.value = 'Some error'
      store.clearError()
      expect(store.error.value).toBeNull()
    })
  })

  describe('unwrap', () => {
    it('returns response.data on successful response', async () => {
      mockApi.get.mockResolvedValue({
        success: true,
        data: [{ id: 1 }]
      })

      const store = useCrudStore({ api: mockApi })
      await store.fetchAll()

      // unwrap is tested indirectly via fetchAll returning correct data
      expect(store.items.value).toEqual([{ id: 1 }])
    })

    it('sets error and throws on failed response', async () => {
      mockApi.get.mockResolvedValue({
        success: false,
        message: 'Something went wrong'
      })

      const store = useCrudStore({ api: mockApi })
      await expect(store.fetchAll()).rejects.toThrow('Something went wrong')
      expect(store.error.value).toBe('Something went wrong')
    })

    it('can be called directly with custom fallback message', async () => {
      const store = useCrudStore({ api: mockApi })
      const result = store.unwrap({ success: true, data: 'hello' }, 'Fallback')
      expect(result).toBe('hello')
    })

    it('throws with fallback message when response has no message', async () => {
      const store = useCrudStore({ api: mockApi })
      expect(() => store.unwrap({ success: false }, 'Custom fallback')).toThrow('Custom fallback')
      expect(store.error.value).toBe('Custom fallback')
    })
  })

  describe('custom getters', () => {
    it('merges custom getters with default getters', () => {
      const store = useCrudStore({
        api: mockApi,
        getters: {
          activeItems: computed(() => mockApi.items?.value?.filter(i => i.active) || [])
        }
      })

      expect(store.activeItems).toBeDefined()
      expect(store.itemList).toBeDefined() // default getter still present
    })
  })

  describe('localStorage persistence', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    it('loads items from localStorage on init', () => {
      localStorage.setItem('test-items', JSON.stringify([{ id: 1, name: 'Cached' }]))

      const store = useCrudStore({ api: mockApi, storageKey: 'test-items' })
      expect(store.items.value).toEqual([{ id: 1, name: 'Cached' }])
    })

    it('saves items to localStorage after fetchAll', async () => {
      mockApi.get.mockResolvedValue({
        success: true,
        data: [{ id: 1, name: 'Fetched' }]
      })

      const store = useCrudStore({ api: mockApi, storageKey: 'test-items' })
      await store.fetchAll()

      const stored = JSON.parse(localStorage.getItem('test-items'))
      expect(stored).toEqual([{ id: 1, name: 'Fetched' }])
    })

    it('saves items to localStorage after create', async () => {
      mockApi.create.mockResolvedValue({
        success: true,
        data: { id: 2, name: 'New' }
      })

      const store = useCrudStore({ api: mockApi, storageKey: 'test-items' })
      await store.create({ name: 'New' })

      const stored = JSON.parse(localStorage.getItem('test-items'))
      expect(stored).toEqual([{ id: 2, name: 'New' }])
    })
  })

  describe('error handling for missing API methods', () => {
    it('throws when getAll method is not found', async () => {
      const store = useCrudStore({ api: {}, apiMethods: { getAll: 'nonExistent' } })
      await expect(store.fetchAll()).rejects.toThrow("API method 'nonExistent' not found")
    })
  })
})
