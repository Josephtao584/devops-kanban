/**
 * Session status constants
 */
export const SESSION_STATUS = {
  CREATED: 'CREATED',
  RUNNING: 'RUNNING',
  IDLE: 'IDLE',
  STOPPED: 'STOPPED',
  SUSPENDED: 'SUSPENDED',
  ERROR: 'ERROR',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
}

/**
 * Session statuses where the input area is visible.
 * During RUNNING state the input is shown but disabled (see SESSION_BUSY_STATUSES).
 */
export const SESSION_INPUT_STATUSES = [
  SESSION_STATUS.RUNNING,
  SESSION_STATUS.STOPPED,
  SESSION_STATUS.SUSPENDED,
  SESSION_STATUS.COMPLETED,
  SESSION_STATUS.FAILED,
  SESSION_STATUS.CANCELLED,
]

/**
 * Session statuses where input is disabled (processing)
 */
export const SESSION_BUSY_STATUSES = [
  SESSION_STATUS.RUNNING
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
