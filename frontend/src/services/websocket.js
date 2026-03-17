import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

/**
 * WebSocket service for real-time session communication.
 * Uses STOMP protocol over SockJS for reliable WebSocket connections.
 */
class WebSocketService {
  constructor() {
    this.client = null
    this.subscriptions = new Map()
    this.connected = false
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
  }

  /**
   * Connect to the WebSocket server
   * @param {string} baseUrl - The base URL for the WebSocket connection
   * @returns {Promise} Resolves when connected
   */
  connect(baseUrl = '') {
    return new Promise((resolve, reject) => {
      if (this.client && this.connected) {
        console.log('[WebSocket] Already connected')
        resolve()
        return
      }

      const socketUrl = baseUrl ? `${baseUrl}/ws` : '/ws'
      console.log('[WebSocket] Connecting to:', socketUrl)

      this.client = new Client({
        webSocketFactory: () => {
          console.log('[WebSocket] Creating SockJS instance')
          return new SockJS(socketUrl)
        },
        reconnectDelay: 5000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        onConnect: () => {
          console.log('[WebSocket] Connected successfully')
          this.connected = true
          this.reconnectAttempts = 0
          resolve()
        },
        onDisconnect: () => {
          console.log('[WebSocket] Disconnected')
          this.connected = false
        },
        onStompError: (frame) => {
          console.error('[WebSocket] STOMP error:', frame)
          reject(new Error(frame.headers.message))
        },
        onWebSocketError: (event) => {
          console.error('[WebSocket] WebSocket error:', event)
          if (!this.connected) {
            reject(new Error('WebSocket connection failed'))
          }
        }
      })

      console.log('[WebSocket] Activating client...')
      this.client.activate()
    })
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect() {
    if (this.client) {
      // Unsubscribe from all topics
      this.subscriptions.forEach((subscription) => {
        subscription.unsubscribe()
      })
      this.subscriptions.clear()

      // Deactivate the client
      this.client.deactivate()
      this.client = null
      this.connected = false
    }
  }

  /**
   * Subscribe to session output
   * @param {number} sessionId - The session ID
   * @param {function} callback - Callback function for output messages
   * @returns {object} Subscription object
   */
  subscribeToOutput(sessionId, callback) {
    if (!this.client || !this.connected) {
      console.warn('WebSocket not connected')
      return null
    }

    const topic = `/topic/session/${sessionId}/output`

    // Unsubscribe from existing subscription for this topic
    if (this.subscriptions.has(topic)) {
      this.subscriptions.get(topic).unsubscribe()
    }

    const subscription = this.client.subscribe(topic, (message) => {
      try {
        const data = JSON.parse(message.body)
        callback(data)
      } catch (e) {
        console.error('Failed to parse output message:', e)
      }
    })

    this.subscriptions.set(topic, subscription)
    return subscription
  }

  /**
   * Subscribe to session status changes
   * @param {number} sessionId - The session ID
   * @param {function} callback - Callback function for status messages
   * @returns {object} Subscription object
   */
  subscribeToStatus(sessionId, callback) {
    if (!this.client || !this.connected) {
      console.warn('WebSocket not connected')
      return null
    }

    const topic = `/topic/session/${sessionId}/status`

    // Unsubscribe from existing subscription for this topic
    if (this.subscriptions.has(topic)) {
      this.subscriptions.get(topic).unsubscribe()
    }

    const subscription = this.client.subscribe(topic, (message) => {
      try {
        const data = JSON.parse(message.body)
        callback(data)
      } catch (e) {
        console.error('Failed to parse status message:', e)
      }
    })

    this.subscriptions.set(topic, subscription)
    return subscription
  }

  /**
   * Send input to a session
   * @param {number} sessionId - The session ID
   * @param {string} input - The input text
   */
  sendInput(sessionId, input) {
    if (!this.client || !this.connected) {
      console.warn('WebSocket not connected')
      return false
    }

    const destination = `/app/session/${sessionId}/input`
    this.client.publish({
      destination,
      body: JSON.stringify({ input })
    })

    return true
  }

  /**
   * Unsubscribe from a session's topics
   * @param {number} sessionId - The session ID
   */
  unsubscribeFromSession(sessionId) {
    const outputTopic = `/topic/session/${sessionId}/output`
    const statusTopic = `/topic/session/${sessionId}/status`

    ;[outputTopic, statusTopic].forEach((topic) => {
      if (this.subscriptions.has(topic)) {
        this.subscriptions.get(topic).unsubscribe()
        this.subscriptions.delete(topic)
      }
    })
  }

  /**
   * Check if connected
   * @returns {boolean} True if connected
   */
  isConnected() {
    return this.connected
  }
}

// Export singleton instance
export const wsService = new WebSocketService()
export default wsService
