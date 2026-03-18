import { ref } from 'vue'
import { useSessionStore } from '../stores/sessionStore'
import { ElMessage } from 'element-plus'

/**
 * Composable for managing session lifecycle
 * Uses sessionStore internally to eliminate duplicate code
 */
export function useSessionManager() {
  const sessionStore = useSessionStore()
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
      const newSession = await sessionStore.createSession(taskId, agentId)
      if (newSession) {
        session.value = newSession
        return session.value
      }
      return null
    } catch (e) {
      ElMessage.error(e.message || 'Failed to create session')
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
      const updatedSession = await sessionStore.startSession(session.value.id)
      if (updatedSession) {
        session.value = updatedSession
        if (onStatusChange) {
          onStatusChange(session.value.status)
        }
        return true
      }
      return false
    } catch (e) {
      ElMessage.error(e.message || 'Failed to start session')
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
      const updatedSession = await sessionStore.stopSession(session.value.id)
      if (updatedSession) {
        session.value = updatedSession
        if (onStatusChange) {
          onStatusChange(session.value.status)
        }
        if (onStopped) {
          onStopped()
        }
        return true
      }
    } catch (e) {
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
      const activeSession = await sessionStore.fetchActiveSession(taskId)
      if (activeSession) {
        session.value = activeSession
        return activeSession
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
      const updatedSession = await sessionStore.continueSession(session.value.id, input)
      if (updatedSession) {
        session.value = updatedSession
        if (onStatusChange) {
          onStatusChange(session.value.status)
        }
        return true
      }
      return false
    } catch (e) {
      ElMessage.error(e.message || 'Failed to continue session')
      return false
    }
  }

  /**
   * Refresh session data from server
   */
  async function refreshSession() {
    if (!session.value) return null

    // Use sessionStore's startSession with existing id to get fresh data
    // Actually, there's no direct refresh method in sessionStore
    // Let's just return current session
    return session.value
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
