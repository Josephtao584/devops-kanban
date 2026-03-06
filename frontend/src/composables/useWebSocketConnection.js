import { ref } from 'vue'
import wsService from '../services/websocket'

/**
 * Composable for managing WebSocket connections for sessions
 */
export function useWebSocketConnection() {
  const isConnected = ref(false)

  /**
   * Connect to WebSocket and subscribe to session output
   */
  async function connect(sessionId, callbacks = {}) {
    if (!sessionId) return false

    if (isConnected.value) {
      console.log('[useWebSocketConnection] Already connected for session', sessionId)
      return true
    }

    try {
      // Ensure connection is established
      if (!wsService.isConnected()) {
        console.log('[useWebSocketConnection] Connecting WebSocket...')
        await wsService.connect()
        // Wait a moment for connection to stabilize
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Check connection status again
      if (!wsService.isConnected()) {
        console.warn('[useWebSocketConnection] WebSocket not connected after connect()')
        return false
      }

      isConnected.value = true
      console.log('[useWebSocketConnection] Connected, subscribing to session', sessionId)

      // Subscribe to output messages
      if (callbacks.onOutput) {
        wsService.subscribeToOutput(sessionId, (data) => {
          callbacks.onOutput(data)
        })
      }

      // Subscribe to status changes
      if (callbacks.onStatus) {
        wsService.subscribeToStatus(sessionId, (data) => {
          callbacks.onStatus(data)
        })
      }

      return true
    } catch (e) {
      console.error('[useWebSocketConnection] Failed to connect:', e)
      isConnected.value = false
      return false
    }
  }

  /**
   * Disconnect from WebSocket for a session
   */
  function disconnect(sessionId) {
    if (sessionId) {
      wsService.unsubscribeFromSession(sessionId)
    }
    isConnected.value = false
  }

  /**
   * Send input to session via WebSocket
   */
  function sendInput(sessionId, input) {
    if (!isConnected.value) {
      console.warn('[useWebSocketConnection] Not connected, cannot send input')
      return false
    }
    wsService.sendInput(sessionId, input)
    return true
  }

  /**
   * Check if WebSocket service is connected
   */
  function isServiceConnected() {
    return wsService.isConnected()
  }

  return {
    // State
    isConnected,
    // Actions
    connect,
    disconnect,
    sendInput,
    isServiceConnected
  }
}