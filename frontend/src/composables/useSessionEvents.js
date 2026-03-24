import { ref } from 'vue'
import { getSessionEvents } from '../api/session.js'

export function useSessionEvents({ pollIntervalMs = 2000 } = {}) {
  const events = ref([])
  const lastSeq = ref(0)
  const isLoading = ref(false)
  const isPolling = ref(false)
  const error = ref(null)

  let pollTimer = null
  let activeSessionId = null
  let loadToken = 0

  function normalizeResponse(response) {
    const data = response?.data ?? response ?? {}
    return {
      events: Array.isArray(data.events) ? data.events : [],
      lastSeq: Number(data.last_seq ?? 0),
      hasMore: data.has_more === true
    }
  }

  function appendEvents(nextEvents) {
    if (!Array.isArray(nextEvents) || nextEvents.length === 0) {
      return
    }

    const seen = new Set(events.value.map((event) => event.id ?? `seq:${event.seq}`))
    const deduped = nextEvents.filter((event) => {
      const key = event.id ?? `seq:${event.seq}`
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })

    if (deduped.length > 0) {
      events.value = [...events.value, ...deduped]
    }
  }

  async function loadInitial(sessionId, { limit } = {}) {
    activeSessionId = sessionId
    const currentToken = ++loadToken
    isLoading.value = true
    error.value = null

    try {
      let afterSeq = 0
      let hasMore = false
      let aggregatedEvents = []
      let nextLastSeq = 0

      do {
        const response = await getSessionEvents(sessionId, { afterSeq, ...(limit != null ? { limit } : {}) })
        const normalized = normalizeResponse(response)

        if (activeSessionId !== sessionId || currentToken !== loadToken) {
          return { events: aggregatedEvents, lastSeq: nextLastSeq, hasMore: normalized.hasMore }
        }

        aggregatedEvents = [...aggregatedEvents, ...normalized.events]
        nextLastSeq = normalized.lastSeq
        afterSeq = normalized.lastSeq
        hasMore = normalized.hasMore
      } while (hasMore)

      if (activeSessionId === sessionId && currentToken === loadToken) {
        events.value = aggregatedEvents
        lastSeq.value = nextLastSeq
      }

      return { events: aggregatedEvents, lastSeq: nextLastSeq, hasMore: false }
    } catch (err) {
      error.value = err
      throw err
    } finally {
      if (currentToken === loadToken) {
        isLoading.value = false
      }
    }
  }

  async function pollNext(sessionId = activeSessionId, { limit } = {}) {
    if (!sessionId) {
      return { events: [], lastSeq: lastSeq.value, hasMore: false }
    }

    const response = await getSessionEvents(sessionId, { afterSeq: lastSeq.value, ...(limit != null ? { limit } : {}) })
    const normalized = normalizeResponse(response)
    if (activeSessionId === sessionId) {
      appendEvents(normalized.events)
      lastSeq.value = normalized.lastSeq
    }
    return normalized
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    isPolling.value = false
  }

  function startPolling(sessionId, isTerminal = () => false, { limit } = {}) {
    stopPolling()
    activeSessionId = sessionId

    if (!sessionId || isTerminal()) {
      return
    }

    isPolling.value = true
    pollTimer = setInterval(async () => {
      if (isTerminal()) {
        stopPolling()
        return
      }

      try {
        await pollNext(sessionId, { limit })
      } catch (err) {
        error.value = err
        stopPolling()
      }

      if (isTerminal()) {
        stopPolling()
      }
    }, pollIntervalMs)
  }

  return {
    events,
    lastSeq,
    isLoading,
    isPolling,
    error,
    loadInitial,
    pollNext,
    startPolling,
    stopPolling
  }
}

export default useSessionEvents
