import { ref, computed } from 'vue'
import { useApiErrorHandler } from './useApiErrorHandler'

/**
 * Generic CRUD store composable for eliminating duplicate code across stores.
 *
 * @param {Object} options - Configuration options
 * @param {Object} options.api - API module with CRUD methods
 * @param {String} options.apiMethods - Method names in the API module
 * @param {String} options.apiMethods.getAll - Method to fetch all items (default: 'get')
 * @param {String} options.apiMethods.getById - Method to fetch by id (default: 'getById')
 * @param {String} options.apiMethods.create - Method to create (default: 'create')
 * @param {String} options.apiMethods.update - Method to update (default: 'update')
 * @param {String} options.apiMethods.delete - Method to delete (default: 'delete')
 * @param {Function} options.getters - Optional computed getters for derived state
 * @param {Function} options.transformCreate - Optional transform function for create data
 * @param {Function} options.transformUpdate - Optional transform function for update data
 * @param {Function} options.fetchAllParams - Optional function to get params for fetchAll
 * @param {String} options.storageKey - Optional key for localStorage persistence
 *
 * @returns {Object} Store state, getters, and actions
 */
export function useCrudStore(options = {}) {
  const {
    api,
    apiMethods = {},
    getters: customGetters = {},
    transformCreate = (data) => data,
    transformUpdate = (id, data) => data,
    fetchAllParams = null,
    storageKey = null
  } = options

  // Default method names
  const methods = {
    getAll: apiMethods.getAll || 'get',
    getById: apiMethods.getById || 'getById',
    create: apiMethods.create || 'create',
    update: apiMethods.update || 'update',
    delete: apiMethods.delete || 'delete'
  }

  const apiError = useApiErrorHandler({ showMessage: false, defaultMessage: 'CRUD request failed' })

  // State
  const items = ref([])
  const currentItem = ref(null)
  const loading = ref(false)
  const error = ref(null)

  const unwrap = (response, fallbackMessage = 'CRUD request failed') => {
    try {
      return apiError.unwrapResponse(response, fallbackMessage)
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  // Default getters
  const defaultGetters = {
    itemList: computed(() => items.value),
    currentItemValue: computed(() => currentItem.value),
    currentItemId: computed(() => currentItem.value?.id),
    isLoading: computed(() => loading.value),
    hasError: computed(() => error.value !== null)
  }

  const getters = { ...defaultGetters, ...customGetters }

  // Helper to load from localStorage
  const loadFromStorage = () => {
    if (!storageKey) return
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        items.value = JSON.parse(stored)
      }
    } catch (e) {
      console.error('Failed to load from storage:', e)
    }
  }

  // Helper to save to localStorage
  const saveToStorage = () => {
    if (!storageKey) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(items.value))
    } catch (e) {
      console.error('Failed to save to storage:', e)
    }
  }

  // Actions
  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      const apiMethod = api[methods.getAll]
      if (!apiMethod) {
        throw new Error(`API method '${methods.getAll}' not found`)
      }
      const params = fetchAllParams ? fetchAllParams() : null
      const response = params !== null ? await apiMethod(params) : await apiMethod()
      items.value = unwrap(response) || []
      saveToStorage()
      return response
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchById(id) {
    loading.value = true
    error.value = null
    try {
      const apiMethod = api[methods.getById]
      if (!apiMethod) {
        throw new Error(`API method '${methods.getById}' not found`)
      }
      const response = await apiMethod(id)
      const item = unwrap(response)
      currentItem.value = item
      const index = items.value.findIndex(existingItem => existingItem.id === id)
      if (index !== -1) {
        items.value[index] = item
      }
      return item
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function create(itemData) {
    loading.value = true
    error.value = null
    try {
      const transformedData = transformCreate(itemData)
      const apiMethod = api[methods.create]
      if (!apiMethod) {
        throw new Error(`API method '${methods.create}' not found`)
      }
      const response = await apiMethod(transformedData)
      const createdItem = unwrap(response)
      items.value.push(createdItem)
      saveToStorage()
      return response
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function update(id, itemData) {
    loading.value = true
    error.value = null
    try {
      const transformedData = transformUpdate(id, itemData)
      const apiMethod = api[methods.update]
      if (!apiMethod) {
        throw new Error(`API method '${methods.update}' not found`)
      }
      const response = await apiMethod(id, transformedData)
      const updatedItem = unwrap(response)
      const index = items.value.findIndex(item => item.id === id)
      if (index !== -1) {
        items.value[index] = updatedItem
      }
      if (currentItem.value?.id === id) {
        currentItem.value = updatedItem
      }
      saveToStorage()
      return response
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteItem(id) {
    loading.value = true
    error.value = null
    try {
      const apiMethod = api[methods.delete]
      if (!apiMethod) {
        throw new Error(`API method '${methods.delete}' not found`)
      }
      const response = await apiMethod(id)
      unwrap(response)
      items.value = items.value.filter(item => item.id !== id)
      if (currentItem.value?.id === id) {
        currentItem.value = null
      }
      saveToStorage()
      return response
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  function setCurrentItem(item) {
    currentItem.value = item
  }

  function clearCurrentItem() {
    currentItem.value = null
  }

  function clearItems() {
    items.value = []
    currentItem.value = null
  }

  function clearError() {
    error.value = null
  }

  function setError(message) {
    error.value = message
  }

  // Initialize from storage if enabled
  if (storageKey) {
    loadFromStorage()
  }

  return {
    // State
    items,
    currentItem,
    loading,
    error,
    // Getters
    ...getters,
    // Utilities
    unwrap,
    // Actions
    fetchAll,
    fetchById,
    create,
    update,
    deleteItem,
    setCurrentItem,
    clearCurrentItem,
    clearItems,
    clearError,
    setError
  }
}

export default useCrudStore
