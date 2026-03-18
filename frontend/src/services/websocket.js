/**
 * WebSocket service for real-time session communication.
 * Uses native WebSocket API for simple, direct communication.
 */

/**
 * WebSocket service class
 */
class WebSocketService {
  constructor() {
    this.ws = null
    this.subscribers = new Map() // sessionId:channel -> [callbacks]
    this.connected = false
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.baseUrl = ''
    this reconnectTimer = null
  }

  /**
   * Connect to the WebSocket server
   * @param {string} baseUrl - The base URL for the WebSocket connection
   * @returns {Promise} Resolves when connected
   */
  connect(baseUrl = '') {
    return new Promise((resolve, reject) => {
      if (this.ws && this.connected) {
        console.log('[WebSocket] Already connected')
        resolve()
        return
      }

      this.baseUrl = baseUrl
      const socketUrl = baseUrl ? `${baseUrl}/ws`.replace('http', 'ws') : `ws://${window.location.host}/ws`
      console.log('[WebSocket] Connecting to:', socketUrl)

      try {
        this.ws = new WebSocket(socketUrl)

        this.ws.onopen = () => {
          console.log('[WebSocket] Connected successfully')
          this.connected = true
          this.reconnectAttempts = 0
          resolve()
        }

        this.ws.onclose = (event) => {
          console.log('[WebSocket] Disconnected:', event.code, event.reason)
          this.connected = false

          // Attempt reconnection
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++
            console.log(`[WebSocket] Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
            this.reconnectTimer = setTimeout(() => {
              this.connect(this.baseUrl)
            }, 5000 * this.reconnectAttempts)
          }
        }

        this.ws.onerror = (error) => {
          console.error('[WebSocket] WebSocket error:', error)
          if (!this.connected) {
            reject(new Error('WebSocket connection failed'))
          }
        }

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            this._handleMessage(data)
          } catch (e) {
            console.error('[WebSocket] Failed to parse message:', e)
          }
        }
      } catch (error) {
        console.error('[WebSocket] Failed to create WebSocket:', error)
        reject(error)
      }
    })
  }

  /**
   * Handle incoming messages
   * @private
   * @param {object} data - Parsed message data
   */
  _handleMessage(data) {
    const { sessionId, session_id, channel, type, destination } = data

    // Handle simple format: { sessionId, channel, ... }
    if (sessionId || session_id) {
      const sid = sessionId || session_id
      const ch = channel || this._extractChannelFromDestination(destination)

      if (sid && ch) {
        this._notifySubscribers(sid, ch, data)
      }
    }

    // Handle STOMP-like format with destination
    if (destination && destination.startsWith('/topic/session/')) {
      const parts = destination.split('/')
      if (parts.length >= 5) {
        const sid = parseInt(parts[3], 10)
        const ch = parts[4]
        this._notifySubscribers(sid, ch, data)
      }
    }

    // Handle SUBSCRIBED confirmation
    if (type === 'SUBSCRIBED' || type === 'subscribed') {
      console.log('[WebSocket] Subscription confirmed:', data)
    }
  }

  /**
   * Extract channel from STOMP-style destination
   * @private
   * @param {string} destination - Destination path
   * @returns {string|null} Channel name
   */
  _extractChannelFromDestination(destination) {
    if (!destination) return null
    if (destination.startsWith('/topic/session/')) {
      const parts = destination.split('/')
      if (parts.length >= 5) return parts[4]
    }
    return null
  }

  /**
   * Notify subscribers for a session/channel
   * @private
   * @param {number} sessionId - Session ID
   * @param {string} channel - Channel name
   * @param {object} data - Message data
   */
  _notifySubscribers(sessionId, channel, data) {
    const key = this._getSubscriberKey(sessionId, channel)
    const callbacks = this.subscribers.get(key)

    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(data)
        } catch (e) {
          console.error('[WebSocket] Subscriber callback error:', e)
        }
      })
    }
  }

  /**
   * Get subscriber key
   * @private
   * @param {number} sessionId - Session ID
   * @param {string} channel - Channel name
   * @returns {string} Subscriber key
   */
  _getSubscriberKey(sessionId, channel) {
    return `${sessionId}:${channel}`
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.ws) {
      this.ws.onclose = null // Prevent reconnection
      this.ws.close()
      this.ws = null
    }

    this.subscribers.clear()
    this.connected = false
  }

  /**
   * Subscribe to session output
   * @param {number} sessionId - The session ID
   * @param {function} callback - Callback function for output messages
   * @returns {boolean} True if subscribed
   */
  subscribeToOutput(sessionId, callback) {
    return this._subscribe(sessionId, 'output', callback)
  }

  /**
   * Subscribe to session status changes
   * @param {number} sessionId - The session ID
   * @param {function} callback - Callback function for status messages
   * @returns {boolean} True if subscribed
   */
  subscribeToStatus(sessionId, callback) {
    return this._subscribe(sessionId, 'status', callback)
  }

  /**
   * Internal subscribe method
   * @private
   * @param {number} sessionId - Session ID
   * @param {string} channel - Channel name
   * @param {function} callback - Callback function
   * @returns {boolean} True if subscribed
   */
  _subscribe(sessionId, channel, callback) {
    if (!this.ws || !this.connected) {
      console.warn('[WebSocket] Not connected, cannot subscribe')
      return false
    }

    const key = this._getSubscriberKey(sessionId, channel)
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, [])
    }
    this.subscribers.get(key).push(callback)

    // Send subscription message
    this._sendSubscription(sessionId, channel)

    console.log(`[WebSocket] Subscribed to session ${sessionId} channel: ${channel}`)
    return true
  }

  /**
   * Send subscription message to server
   * @private
   * @param {number} sessionId - Session ID
   * @param {string} channel - Channel name
   */
  _sendSubscription(sessionId, channel) {
    // Send both simple format and STOMP-like format for compatibility
    const simpleMsg = {
      type: 'subscribe',
      session_id: sessionId,
      channel,
    }

    const stompMsg = {
      type: 'SUBSCRIBE',
      destination: `/topic/session/${sessionId}/${channel}`,
      session_id: sessionId,
    }

    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(simpleMsg))
      // Small delay for STOMP message
      setTimeout(() => {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(stompMsg))
        }
      }, 100)
    }
  }

  /**
   * Send input to a session
   * @param {number} sessionId - The session ID
   * @param {string} input - The input text
   * @returns {boolean} True if sent
   */
  sendInput(sessionId, input) {
    if (!this.ws || !this.connected) {
      console.warn('[WebSocket] Not connected, cannot send input')
      return false
    }

    // Send both simple format and STOMP-like format for compatibility
    const simpleMsg = {
      type: 'input',
      session_id: sessionId,
      input,
    }

    const stompMsg = {
      type: 'SEND',
      destination: `/app/session/${sessionId}/input`,
      body: JSON.stringify({ input }),
    }

    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(simpleMsg))
      setTimeout(() => {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(stompMsg))
        }
      }, 100)
    }

    return true
  }

  /**
   * Unsubscribe from a session's topics
   * @param {number} sessionId - The session ID
   */
  unsubscribeFromSession(sessionId) {
    const outputKey = this._getSubscriberKey(sessionId, 'output')
    const statusKey = this._getSubscriberKey(sessionId, 'status')

    this.subscribers.delete(outputKey)
    this.subscribers.delete(statusKey)

    console.log(`[WebSocket] Unsubscribed from session ${sessionId}`)
  }

  /**
   * Unsubscribe a specific callback
   * @param {number} sessionId - Session ID
   * @param {string} channel - Channel name
   * @param {function} callback - Callback to remove
   */
  unsubscribe(sessionId, channel, callback) {
    const key = this._getSubscriberKey(sessionId, channel)
    const callbacks = this.subscribers.get(key)

    if (callbacks) {
      const idx = callbacks.indexOf(callback)
      if (idx > -1) {
        callbacks.splice(idx, 1)
      }

      if (callbacks.length === 0) {
        this.subscribers.delete(key)
      }
    }
  }

  /**
   * Check if connected
   * @returns {boolean} True if connected
   */
  isConnected() {
    return this.connected && this.ws && this.ws.readyState === WebSocket.OPEN
  }

  /**
   * Get connection state
   * @returns {string} Connection state
   */
  getState() {
    if (!this.ws) return 'CLOSED'
    const states = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']
    return states[this.ws.readyState] || 'UNKNOWN'
  }
}

// Export singleton instance
export const wsService = new WebSocketService()
export default wsService
