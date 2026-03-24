/**
 * Session status constants
 */
export const SESSION_STATUS = {
  CREATED: 'CREATED',
  RUNNING: 'RUNNING',
  IDLE: 'IDLE',
  STOPPED: 'STOPPED',
  ERROR: 'ERROR',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
}

/**
 * Session statuses that indicate an active session
 */
export const SESSION_ACTIVE_STATUSES = [
  SESSION_STATUS.CREATED,
  SESSION_STATUS.RUNNING,
  SESSION_STATUS.IDLE
]

/**
 * Session statuses that indicate a session can receive input
 */
export const SESSION_INPUT_STATUSES = [
  SESSION_STATUS.RUNNING,
  SESSION_STATUS.IDLE
]

/**
 * Session statuses that indicate a terminal/inactive session
 */
export const SESSION_TERMINAL_STATUSES = [
  SESSION_STATUS.STOPPED,
  SESSION_STATUS.ERROR,
  SESSION_STATUS.COMPLETED,
  SESSION_STATUS.FAILED,
  SESSION_STATUS.CANCELLED
]

/**
 * Check if a session is active (can be started or continued)
 * @param {Object} session - Session object
 * @returns {boolean}
 */
export function isSessionActive(session) {
  if (!session || !session.status) return false
  return SESSION_ACTIVE_STATUSES.includes(session.status)
}

/**
 * Check if a session can receive input
 * @param {Object} session - Session object
 * @returns {boolean}
 */
export function canSessionReceiveInput(session) {
  if (!session || !session.status) return false
  return SESSION_INPUT_STATUSES.includes(session.status)
}

/**
 * Check if a session is stopped/terminal
 * @param {Object} session - Session object
 * @returns {boolean}
 */
export function isSessionStopped(session) {
  if (!session || !session.status) return false
  return SESSION_TERMINAL_STATUSES.includes(session.status)
}

/**
 * Get status class for styling
 * @param {string} status - Session status
 * @returns {string} CSS class name
 */
export function getSessionStatusClass(status) {
  if (!status) return 'status-none'
  const statusMap = {
    [SESSION_STATUS.RUNNING]: 'status-running',
    [SESSION_STATUS.IDLE]: 'status-idle',
    [SESSION_STATUS.STOPPED]: 'status-stopped',
    [SESSION_STATUS.ERROR]: 'status-error',
    [SESSION_STATUS.CREATED]: 'status-created',
    [SESSION_STATUS.COMPLETED]: 'status-completed',
    [SESSION_STATUS.FAILED]: 'status-failed',
    [SESSION_STATUS.CANCELLED]: 'status-cancelled'
  }
  return statusMap[status] || 'status-unknown'
}
