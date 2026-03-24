import { ref } from 'vue'
import { useSessionStore } from '../stores/sessionStore'
import { useToast } from './ui/useToast'

const ACTIVE_SESSION_ERROR = 'No active session found'

export function useSessionManager() {
  const sessionStore = useSessionStore()
  const toast = useToast()
  const session = ref(null)
  const isStarting = ref(false)
  const isStopping = ref(false)

  const emitStatusChange = (onStatusChange) => {
    if (onStatusChange && session.value) {
      onStatusChange(session.value.status)
    }
  }

  async function createSession(taskId, agentId) {
    if (!agentId) {
      return null
    }

    if (session.value) {
      return session.value
    }

    try {
      const newSession = await sessionStore.createSession(taskId, agentId)
      session.value = newSession
      return session.value
    } catch (e) {
      toast.error(e.message || 'Failed to create session')
      return null
    }
  }

  async function deleteSession() {
    if (!session.value) return false

    try {
      const response = await sessionStore.deleteSession(session.value.id)
      if (!response?.success) {
        throw new Error(response?.message || 'Failed to delete session')
      }
      session.value = null
      return true
    } catch (e) {
      toast.error(e.message || 'Failed to delete session')
      return false
    }
  }

  async function startSession(onStatusChange) {
    if (!session.value) return false
    if (isStarting.value) return false

    isStarting.value = true
    try {
      const updatedSession = await sessionStore.startSession(session.value.id)
      session.value = updatedSession
      emitStatusChange(onStatusChange)
      return true
    } catch (e) {
      toast.error(e.message || 'Failed to start session')
      return false
    } finally {
      isStarting.value = false
    }
  }

  async function stopSession(onStatusChange, onStopped) {
    if (!session.value) return false

    isStopping.value = true
    try {
      const updatedSession = await sessionStore.stopSession(session.value.id)
      session.value = updatedSession
      emitStatusChange(onStatusChange)
      if (onStopped) {
        onStopped()
      }
      return true
    } catch (e) {
      toast.error(e.message || 'Failed to stop session')
      return false
    } finally {
      isStopping.value = false
    }
  }

  async function loadActiveSession(taskId) {
    try {
      const activeSession = await sessionStore.fetchActiveSession(taskId)
      session.value = activeSession
      return activeSession
    } catch (e) {
      if (e?.message !== ACTIVE_SESSION_ERROR) {
        console.error('Failed to load active session:', e)
      }
      return null
    }
  }

  async function continueSession(input, onStatusChange) {
    if (!session.value) return false

    try {
      const updatedSession = await sessionStore.continueSession(session.value.id, input)
      session.value = updatedSession
      emitStatusChange(onStatusChange)
      return true
    } catch (e) {
      toast.error(e.message || 'Failed to continue session')
      return false
    }
  }

  async function sendInput(input) {
    if (!session.value) return false

    try {
      return await sessionStore.sendInput(session.value.id, input)
    } catch (e) {
      toast.error(e.message || 'Failed to send session input')
      return false
    }
  }

  async function refreshSession() {
    if (!session.value) return null

    try {
      const refreshedSession = await sessionStore.fetchSession(session.value.id)
      session.value = refreshedSession
      return refreshedSession
    } catch (e) {
      console.error('Failed to refresh session:', e)
      return session.value
    }
  }

  function setSession(sessionData) {
    session.value = sessionData
  }

  function clearSession() {
    session.value = null
  }

  function hasActiveSession() {
    return ['CREATED', 'RUNNING', 'IDLE'].includes(session.value?.status)
  }

  return {
    session,
    isStarting,
    isStopping,
    createSession,
    deleteSession,
    startSession,
    stopSession,
    loadActiveSession,
    continueSession,
    sendInput,
    refreshSession,
    setSession,
    clearSession,
    hasActiveSession
  }
}

export default useSessionManager
