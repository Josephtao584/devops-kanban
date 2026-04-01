import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useCrudStore } from '../composables/useCrudStore'
import { useApiErrorHandler } from '../composables/useApiErrorHandler'
import * as sessionApi from '../api/session'

export const useSessionStore = defineStore('session', () => {
  // Use useCrudStore for basic CRUD operations
  const crud = useCrudStore({
    api: sessionApi,
    apiMethods: {
      getAll: 'getSessionsByTask',
      getById: 'getSession',
      delete: 'deleteSession'
    }
  })

  // Session-specific state
  const activeSession = ref(null)
  const error = ref(null)
  const apiError = useApiErrorHandler({ showMessage: false, defaultMessage: 'Session request failed' })

  const unwrap = (response, fallbackMessage) => {
    try {
      return apiError.unwrapResponse(response, fallbackMessage)
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  // Getters
  const sessionsByTask = computed(() => {
    const grouped = {}
    crud.items.value.forEach(session => {
      const taskId = session.task_id ?? session.taskId
      if (taskId == null) {
        return
      }
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
      crud.items.value = unwrap(response, 'Failed to fetch sessions') || []
      return crud.items.value
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
      activeSession.value = unwrap(response, 'Failed to fetch active session')
      return activeSession.value
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
      return unwrap(response, 'Failed to fetch session history') || []
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
      const session = unwrap(response, 'Failed to start session')
      updateSessionInList(session)
      crud.setCurrentItem(session)
      return session
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
      const session = unwrap(response, 'Failed to stop session')
      updateSessionInList(session)
      if (activeSession.value?.id === id) {
        activeSession.value = null
      }
      return session
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
      unwrap(response, 'Failed to send session input')
      return true
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
      const session = unwrap(response, 'Failed to continue session')
      updateSessionInList(session)
      crud.setCurrentItem(session)
      return session
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      crud.loading.value = false
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
    // Helpers
    setCurrentSession,
    clearSessions,
    clearError
  }
})
