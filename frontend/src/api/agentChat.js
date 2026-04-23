import api from './index.js'

/**
 * Create a new chat session for the given agent.
 */
export const createChatSession = (agentId) =>
  api.post(`/agents/${agentId}/chat/sessions`)

/**
 * Get the latest active chat session for an agent (includes messages).
 */
export const getLatestChatSession = (agentId) =>
  api.get(`/agents/${agentId}/chat/sessions`)

/**
 * Get all messages for a chat session.
 */
export const getChatMessages = (agentId, chatId) =>
  api.get(`/agents/${agentId}/chat/sessions/${chatId}/messages`)

/**
 * Delete (end) a chat session.
 */
export const deleteChatSession = (agentId, chatId) =>
  api.delete(`/agents/${agentId}/chat/sessions/${chatId}`)

/**
 * Send a message and stream back events via SSE.
 *
 * @param {number} agentId
 * @param {string} chatId
 * @param {string} content
 * @param {(event: object) => void} onEvent - Called for each streamed event
 * @param {() => void} onDone - Called when stream completes
 * @param {(err: Error) => void} onError - Called on network error
 * @returns {AbortController} controller - Call controller.abort() to cancel
 */
export const streamChatMessage = (agentId, chatId, content, onEvent, onDone, onError) => {
  const controller = new AbortController()

  const run = async () => {
    let response
    try {
      response = await fetch(`/api/agents/${agentId}/chat/sessions/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ content }),
        signal: controller.signal,
      })
    } catch (err) {
      if (err.name !== 'AbortError') onError?.(err)
      return
    }

    if (!response.ok) {
      let msg = `HTTP ${response.status}`
      try {
        const data = await response.json()
        msg = data?.message || data?.error || msg
      } catch { /* noop */ }
      onError?.(new Error(msg))
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    const processBuffer = () => {
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''
      for (const part of parts) {
        if (!part.trim()) continue
        let eventType = 'message'
        let dataStr = ''
        for (const line of part.split('\n')) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            dataStr = line.slice(6)
          }
        }
        if (!dataStr) continue
        try {
          const parsed = JSON.parse(dataStr)
          if (eventType === 'message') {
            onEvent?.(parsed)
          } else if (eventType === 'done') {
            // stream finished
          } else if (eventType === 'error') {
            onError?.(new Error(parsed?.message || 'Unknown error'))
          }
        } catch { /* noop */ }
      }
    }

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        processBuffer()
      }
    } catch (err) {
      if (err.name !== 'AbortError') onError?.(err)
    } finally {
      onDone?.()
    }
  }

  run()
  return controller
}
