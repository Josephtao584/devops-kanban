import { ref } from 'vue'
import {
  createSession as apiCreateSession,
  getSession as apiGetSession,
  startSession as apiStartSession,
  stopSession as apiStopSession,
  continueSession as apiContinueSession,
  getActiveSessionByTask as apiGetActiveSessionByTask
} from '../api/session'
import { ElMessage } from 'element-plus'

/**
 * Composable for managing session lifecycle
 */
export function useSessionManager() {
  const session = ref(null)
  const isStarting = ref(false)
  const isStopping = ref(false)

  /**
   * Create a new session for a task
   */
  async function createSession(taskId, agentId) {
    if (!agentId) {
      return null
    }

    if (session.value) {
      console.log('[useSessionManager] Session already exists:', session.value.id)
      return session.value
    }

    try {
      const response = await apiCreateSession(taskId, agentId)
      if (response.success && response.data) {
        session.value = response.data
        return session.value
      } else {
        ElMessage.error(response.message || 'Failed to create session')
        return null
      }
    } catch (e) {
      console.error('Failed to create session:', e)
      ElMessage.error(e.response?.data?.message || e.message || 'Failed to create session')
      return null
    }
  }

  /**
   * Start an existing session
   */
  async function startSession(onStatusChange) {
    if (!session.value) return false

    if (isStarting.value) {
      console.warn('Session is already starting')
      return false
    }

    isStarting.value = true

    try {
      const response = await apiStartSession(session.value.id)
      if (response.success && response.data) {
        session.value = response.data
        if (onStatusChange) {
          onStatusChange(session.value.status)
        }
        return true
      } else {
        ElMessage.error(response.message || 'Failed to start session')
        return false
      }
    } catch (e) {
      console.error('Failed to start session:', e)
      ElMessage.error(e.response?.data?.message || e.message || 'Failed to start session')
      return false
    } finally {
      isStarting.value = false
    }
  }

  /**
   * Stop the current session
   */
  async function stopSession(onStatusChange, onStopped) {
    if (!session.value) return false

    isStopping.value = true
    try {
      const response = await apiStopSession(session.value.id)
      if (response.success && response.data) {
        session.value = response.data
        if (onStatusChange) {
          onStatusChange(session.value.status)
        }
        if (onStopped) {
          onStopped()
        }
        return true
      }
    } catch (e) {
      console.error('Failed to stop session:', e)
      ElMessage.error('Failed to stop session')
    } finally {
      isStopping.value = false
    }
    return false
  }

  /**
   * Load active session for a task
   */
  async function loadActiveSession(taskId) {
    try {
      const response = await apiGetActiveSessionByTask(taskId)
      if (response.success && response.data) {
        session.value = response.data
        return response.data
      }
    } catch (e) {
      console.error('Failed to load active session:', e)
    }
    return null
  }

  /**
   * Continue a stopped session with new input
   */
  async function continueSession(input, onStatusChange) {
    if (!session.value) return false

    try {
      const response = await apiContinueSession(session.value.id, input)
      if (response.success && response.data) {
        session.value = response.data
        if (onStatusChange) {
          onStatusChange(session.value.status)
        }
        return true
      } else {
        ElMessage.error(response.message || 'Failed to continue session')
        return false
      }
    } catch (e) {
      console.error('Failed to continue session:', e)
      ElMessage.error(e.response?.data?.message || e.message || 'Failed to continue session')
      return false
    }
  }

  /**
   * Refresh session data from server
   */
  async function refreshSession() {
    if (!session.value) return null

    try {
      const response = await apiGetSession(session.value.id)
      if (response.success && response.data) {
        session.value = response.data
        return response.data
      }
    } catch (e) {
      console.error('Failed to refresh session:', e)
    }
    return null
  }

  /**
   * Set session data directly
   */
  function setSession(sessionData) {
    session.value = sessionData
  }

  /**
   * Clear session data
   */
  function clearSession() {
    session.value = null
  }

  return {
    // State
    session,
    isStarting,
    isStopping,
    // Actions
    createSession,
    startSession,
    stopSession,
    loadActiveSession,
    continueSession,
    refreshSession,
    setSession,
    clearSession
  }
}
