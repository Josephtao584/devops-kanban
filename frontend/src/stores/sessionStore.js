import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as sessionApi from '../api/session'

export const useSessionStore = defineStore('session', () => {
  // State
  const sessions = ref([])
  const currentSession = ref(null)
  const activeSession = ref(null)
  const loading = ref(false)
  const error = ref(null)

  // Getters
  const sessionsByTask = computed(() => {
    const grouped = {}
    sessions.value.forEach(session => {
      const taskId = session.taskId
      if (!grouped[taskId]) {
        grouped[taskId] = []
      }
      grouped[taskId].push(session)
    })
    return grouped
  })

  const runningSessions = computed(() =>
    sessions.value.filter(s => s.status === 'RUNNING' || s.status === 'IDLE')
  )

  // Actions
  async function createSession(taskId, agentId) {
    loading.value = true
    error.value = null
    try {
      const response = await sessionApi.createSession(taskId, agentId)
      if (response.success) {
        currentSession.value = response.data
        sessions.value.push(response.data)
        return response.data
      } else {
        error.value = response.message
        throw new Error(response.message)
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchSessions(taskId, activeOnly = false) {
    loading.value = true
    error.value = null
    try {
      const response = await sessionApi.getSessionsByTask(taskId, activeOnly)
      if (response.success) {
        sessions.value = response.data || []
        return sessions.value
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchActiveSession(taskId) {
    loading.value = true
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
      loading.value = false
    }
  }

  async function fetchSessionHistory(taskId, includeOutput = true) {
    loading.value = true
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
      loading.value = false
    }
  }

  async function startSession(id) {
    loading.value = true
    error.value = null
    try {
      const response = await sessionApi.startSession(id)
      if (response.success) {
        updateSessionInList(response.data)
        currentSession.value = response.data
        return response.data
      } else {
        error.value = response.message
        throw new Error(response.message)
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function stopSession(id) {
    loading.value = true
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
      loading.value = false
    }
  }

  async function sendInput(id, input) {
    try {
      const response = await sessionApi.sendSessionInput(id, input)
      return response.success
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  async function continueSession(id, input) {
    loading.value = true
    error.value = null
    try {
      const response = await sessionApi.continueSession(id, input)
      if (response.success) {
        updateSessionInList(response.data)
        currentSession.value = response.data
        return response.data
      } else {
        error.value = response.message
        throw new Error(response.message)
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

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

  async function deleteSession(id) {
    loading.value = true
    error.value = null
    try {
      const response = await sessionApi.deleteSession(id)
      if (response.success) {
        sessions.value = sessions.value.filter(s => s.id !== id)
        if (currentSession.value?.id === id) {
          currentSession.value = null
        }
        if (activeSession.value?.id === id) {
          activeSession.value = null
        }
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  function updateSessionInList(session) {
    const index = sessions.value.findIndex(s => s.id === session.id)
    if (index !== -1) {
      sessions.value[index] = session
    } else {
      sessions.value.push(session)
    }
  }

  function setCurrentSession(session) {
    currentSession.value = session
  }

  function clearSessions() {
    sessions.value = []
    currentSession.value = null
    activeSession.value = null
  }

  function clearError() {
    error.value = null
  }

  return {
    // State
    sessions,
    currentSession,
    activeSession,
    loading,
    error,
    // Getters
    sessionsByTask,
    runningSessions,
    // Actions
    createSession,
    fetchSessions,
    fetchActiveSession,
    fetchSessionHistory,
    startSession,
    stopSession,
    sendInput,
    continueSession,
    getSessionOutput,
    deleteSession,
    setCurrentSession,
    clearSessions,
    clearError
  }
})
