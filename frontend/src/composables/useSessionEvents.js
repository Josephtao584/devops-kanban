import { ref } from 'vue'
import { getSessionEvents } from '../api/session.js'

function stringifyToolValue(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function buildToolInputPreview(toolName, toolInput) {
  if (toolInput == null) {
    return ''
  }

  if (typeof toolInput === 'string') {
    return toolInput
  }

  if (typeof toolInput !== 'object') {
    return String(toolInput)
  }

  if (toolName === 'Read' && typeof toolInput.file_path === 'string') {
    return `file_path: ${toolInput.file_path}`
  }

  if (toolName === 'Bash' && typeof toolInput.command === 'string') {
    return `command: ${toolInput.command}`
  }

  if (toolName === 'Grep') {
    const previewLines = []
    if (typeof toolInput.pattern === 'string' && toolInput.pattern) {
      previewLines.push(`pattern: ${toolInput.pattern}`)
    }
    if (typeof toolInput.path === 'string' && toolInput.path) {
      previewLines.push(`path: ${toolInput.path}`)
    }
    if (typeof toolInput.glob === 'string' && toolInput.glob) {
      previewLines.push(`glob: ${toolInput.glob}`)
    }
    return previewLines.join('\n')
  }

  if (toolName === 'Edit') {
    const previewLines = []
    if (typeof toolInput.file_path === 'string' && toolInput.file_path) {
      previewLines.push(`file_path: ${toolInput.file_path}`)
    }
    if (typeof toolInput.old_string === 'string' && toolInput.old_string) {
      previewLines.push(`old_string: ${toolInput.old_string.slice(0, 120)}`)
    }
    if (typeof toolInput.new_string === 'string' && toolInput.new_string) {
      previewLines.push(`new_string: ${toolInput.new_string.slice(0, 120)}`)
    }
    return previewLines.join('\n')
  }

  const previewEntries = Object.entries(toolInput)
    .filter(([, value]) => value != null && value !== '')
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${stringifyToolValue(value)}`)

  return previewEntries.join('\n')
}

function truncateText(value, maxLength = 240) {
  if (typeof value !== 'string') {
    return ''
  }

  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength)}…`
}

function buildToolResultSummary(text) {
  if (typeof text !== 'string' || !text) {
    return ''
  }

  const compact = text.trim()
  return truncateText(compact, 280)
}

function buildToolMeta(toolName, toolInput) {
  const toolInputPreview = buildToolInputPreview(toolName, toolInput)
  return {
    toolInputPreview,
    toolCallCollapsedByDefault: true
  }
}

function buildToolResultMeta(content) {
  const toolResultText = typeof content === 'string' ? content : ''
  return {
    toolResultText,
    toolResultSummary: buildToolResultSummary(toolResultText),
    toolResultCollapsedByDefault: toolResultText !== ''
  }
}

function buildToolDisplayLabel(toolName) {
  if (typeof toolName === 'string' && toolName) {
    return toolName
  }
  return '工具'
}

function buildRelatedToolName(toolUseId, toolCallMap) {
  if (!toolUseId) {
    return ''
  }
  return toolCallMap.get(toolUseId) || ''
}

function buildToolResultName(eventKind, toolName, toolUseId, toolCallMap) {
  if (eventKind !== 'tool_result') {
    return buildToolDisplayLabel(toolName)
  }

  const relatedToolName = buildRelatedToolName(toolUseId, toolCallMap)
  return relatedToolName || buildToolDisplayLabel(toolName)
}

function buildToolResultMetadata(event, toolName, toolUseId, toolCallMap) {
  const relatedToolName = buildRelatedToolName(toolUseId, toolCallMap)
  return {
    ...buildToolResultMeta(event?.content),
    relatedToolName,
    toolName: buildToolResultName(event?.kind, toolName, toolUseId, toolCallMap)
  }
}

function normalizeEvent(event, toolCallMap) {
  const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {}
  const toolName = typeof payload.tool_name === 'string' && payload.tool_name
    ? payload.tool_name
    : typeof payload.name === 'string' && payload.name
      ? payload.name
      : event?.kind === 'tool_call' && typeof event?.content === 'string' && event.content
        ? event.content
        : ''
  const toolCallId = typeof payload.tool_id === 'string' ? payload.tool_id : ''
  const toolInput = Object.prototype.hasOwnProperty.call(payload, 'input') ? payload.input : null
  const toolUseId = typeof payload.tool_use_id === 'string' ? payload.tool_use_id : ''
  const toolIsError = payload.is_error === true
  const isThinking = payload.block_type === 'thinking'

  if (event?.kind === 'tool_call' && toolCallId) {
    toolCallMap.set(toolCallId, buildToolDisplayLabel(toolName))
  }

  const toolMeta = buildToolMeta(toolName, toolInput)
  const toolResultMeta = buildToolResultMetadata(event, toolName, toolUseId, toolCallMap)

  return {
    ...event,
    payload,
    toolName: toolResultMeta.toolName,
    toolCallId,
    toolInput,
    ...toolMeta,
    toolUseId,
    toolIsError,
    isThinking,
    toolResultText: toolResultMeta.toolResultText,
    toolResultSummary: toolResultMeta.toolResultSummary,
    toolResultCollapsedByDefault: toolResultMeta.toolResultCollapsedByDefault,
    relatedToolName: toolResultMeta.relatedToolName
  }
}

function normalizeEvents(eventList) {
  const toolCallMap = new Map()
  return eventList.map((event) => normalizeEvent(event, toolCallMap))
}

export function useSessionEvents({ pollIntervalMs = 5000 } = {}) {
  const events = ref([])
  const lastSeq = ref(0)
  const isLoading = ref(false)
  const isPolling = ref(false)
  const error = ref(null)

  let pollTimer = null
  let activeSessionId = null
  let loadToken = 0
  let retryCount = 0
  const MAX_RETRIES = 5

  function normalizeResponse(response) {
    const data = response?.data ?? response ?? {}
    const rawEvents = Array.isArray(data.events) ? data.events : []
    return {
      events: normalizeEvents(rawEvents),
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
      events.value = normalizeEvents([...events.value, ...deduped])
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
      clearTimeout(pollTimer)
      pollTimer = null
    }
    isPolling.value = false
  }

  function startPolling(sessionId, isTerminal = () => false, { limit } = {}) {
    stopPolling()
    activeSessionId = sessionId
    retryCount = 0

    if (!sessionId || isTerminal()) {
      return
    }

    isPolling.value = true

    function scheduleNext(delay) {
      pollTimer = setTimeout(async () => {
        if (isTerminal()) {
          stopPolling()
          return
        }

        try {
          await pollNext(sessionId, { limit })
          retryCount = 0
        } catch (err) {
          error.value = err
          retryCount++
          if (retryCount >= MAX_RETRIES) {
            console.error(`[useSessionEvents] Polling failed ${MAX_RETRIES} times, stopping.`, err)
            stopPolling()
            return
          }
          const backoff = Math.min(pollIntervalMs * Math.pow(2, retryCount), 30000)
          console.warn(`[useSessionEvents] Polling failed (${retryCount}/${MAX_RETRIES}), retrying in ${backoff}ms`, err.message)
          scheduleNext(backoff)
          return
        }

        if (isTerminal()) {
          stopPolling()
          return
        }

        scheduleNext(pollIntervalMs)
      }, delay)
    }

    scheduleNext(pollIntervalMs)
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
