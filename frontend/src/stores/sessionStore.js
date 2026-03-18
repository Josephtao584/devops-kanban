import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useCrudStore } from '../composables/useCrudStore'
import * as sessionApi from '../api/session'

export const useSessionStore = defineStore('session', () => {
  // Use useCrudStore for basic CRUD operations
  const crud = useCrudStore({
    api: sessionApi,
    apiMethods: {
      getAll: 'getSessionsByTask',
      getById: 'getSession',
      create: 'createSession',
      update: 'updateSession', // Not used but required by crud
      delete: 'deleteSession'
    }
  })

  // Session-specific state
  const activeSession = ref(null)
  const error = ref(null)

  // Getters
  const sessionsByTask = computed(() => {
    const grouped = {}
    crud.items.value.forEach(session => {
      const taskId = session.taskId
      if (!grouped[taskId]) {
        grouped[taskId] = []
      }
      grouped[taskId].push(session)
    })
    return grouped
  })

  const runningSessions = computed(() =>
    crud.items.value.filter(s => s.status === 'RUNNING' || s.status === 'IDLE')
  )

  // Session-specific actions

  /**
   * Fetch sessions for a task
   * @param {String} taskId - Task ID
   * @param {Boolean} activeOnly - Only fetch active sessions
   * @returns {Array} Sessions
   */
  async function fetchSessions(taskId, activeOnly = false) {
    crud.loading.value = true
    error.value = null
    try {
      const response = await sessionApi.getSessionsByTask(taskId, activeOnly)
      if (response.success) {
        crud.items.value = response.data || []
        return crud.items.value
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      crud.loading.value = false
    }
  }

  /**
   * Fetch active session for a task
   * @param {String} taskId - Task ID
   * @returns {Object} Active session
   */
  async function fetchActiveSession(taskId) {
    crud.loading.value = true
    error.value = null
    try {
      const response = await sessionApi.getActiveSessionByTask(taskId)
      if (response.success) {
        activeSession.value = response.data
        return response.data
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      crud.loading.value = false
    }
  }

  /**
   * Fetch session history for a task
   * @param {String} taskId - Task ID
   * @param {Boolean} includeOutput - Include session output
   * @returns {Array} Session history
   */
  async function fetchSessionHistory(taskId, includeOutput = true) {
    crud.loading.value = true
    error.value = null
    try {
      const response = await sessionApi.getSessionHistory(taskId, includeOutput)
      if (response.success) {
        return response.data || []
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      crud.loading.value = false
    }
  }

  /**
   * Start a session
   * @param {String} id - Session ID
   * @returns {Object} Updated session
   */
  async function startSession(id) {
    crud.loading.value = true
    error.value = null
    try {
      const response = await sessionApi.startSession(id)
      if (response.success) {
        updateSessionInList(response.data)
        crud.setCurrentItem(response.data)
        return response.data
      } else {
        error.value = response.message
        throw new Error(response.message)
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      crud.loading.value = false
    }
  }

  /**
   * Stop a session
   * @param {String} id - Session ID
   * @returns {Object} Updated session
   */
  async function stopSession(id) {
    crud.loading.value = true
    error.value = null
    try {
      const response = await sessionApi.stopSession(id)
      if (response.success) {
        updateSessionInList(response.data)
        if (activeSession.value?.id === id) {
          activeSession.value = null
        }
        return response.data
      } else {
        error.value = response.message
        throw new Error(response.message)
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      crud.loading.value = false
    }
  }

  /**
   * Send input to a session
   * @param {String} id - Session ID
   * @param {String} input - Input to send
   * @returns {Boolean} True if successful
   */
  async function sendInput(id, input) {
    try {
      const response = await sessionApi.sendSessionInput(id, input)
      return response.success
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Continue a stopped session
   * @param {String} id - Session ID
   * @param {String} input - Input to send
   * @returns {Object} Updated session
   */
  async function continueSession(id, input) {
    crud.loading.value = true
    error.value = null
    try {
      const response = await sessionApi.continueSession(id, input)
      if (response.success) {
        updateSessionInList(response.data)
        crud.setCurrentItem(response.data)
        return response.data
      } else {
        error.value = response.message
        throw new Error(response.message)
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      crud.loading.value = false
    }
  }

  /**
   * Get session output
   * @param {String} id - Session ID
   * @returns {String} Session output
   */
  async function getSessionOutput(id) {
    try {
      const response = await sessionApi.getSessionOutput(id)
      if (response.success) {
        return response.data
      }
      return ''
    } catch (e) {
      error.value = e.message
      return ''
    }
  }

  /**
   * Update session in the list
   * @param {Object} session - Session to update
   */
  function updateSessionInList(session) {
    const index = crud.items.value.findIndex(s => s.id === session.id)
    if (index !== -1) {
      crud.items.value[index] = session
    } else {
      crud.items.value.push(session)
    }
  }

  /**
   * Set current session
   * @param {Object} session - Session object
   */
  function setCurrentSession(session) {
    crud.setCurrentItem(session)
  }

  /**
   * Clear sessions
   */
  function clearSessions() {
    crud.clearItems()
    activeSession.value = null
  }

  /**
   * Clear error
   */
  function clearError() {
    error.value = null
  }

  return {
    // State from crud
    sessions: crud.items,
    currentSession: crud.currentItem,
    loading: crud.loading,
    // Session-specific state
    activeSession,
    error,
    // Getters
    sessionsByTask,
    runningSessions,
    // Actions from crud
    createSession: crud.create,
    fetchSession: crud.fetchById,
    deleteSession: crud.deleteItem,
    // Session-specific actions
    fetchSessions,
    fetchActiveSession,
    fetchSessionHistory,
    startSession,
    stopSession,
    sendInput,
    continueSession,
    getSessionOutput,
    // Helpers
    setCurrentSession,
    clearSessions,
    clearError
  }
})
