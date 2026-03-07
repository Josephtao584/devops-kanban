import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  SESSION_STATUS,
  SESSION_ACTIVE_STATUSES,
  SESSION_INPUT_STATUSES,
  SESSION_TERMINAL_STATUSES,
  isSessionActive,
  canSessionReceiveInput,
  isSessionStopped
} from '../../constants/session'

/**
 * Composable for computing session status-related values
 * @param {import('vue').Ref<Object|null>} session - Reactive session reference
 * @returns {Object} Status-related computed properties
 */
export function useSessionStatus(session) {
  const { t } = useI18n()

  /**
   * CSS class for the status badge
   */
  const statusClass = computed(() => {
    if (!session.value) return 'status-none'
    const status = session.value.status?.toLowerCase()
    if (status === 'running') return 'status-running'
    if (status === 'idle') return 'status-idle'
    if (status === 'stopped') return 'status-stopped'
    if (status === 'error') return 'status-error'
    if (status === 'completed') return 'status-completed'
    return 'status-created'
  })

  /**
   * Human-readable status text
   */
  const statusText = computed(() => {
    if (!session.value) return t('session.status.none', 'No Session')
    const status = session.value.status
    const statusKey = `session.status.${status?.toLowerCase()}`
    return t(statusKey, status || 'Unknown')
  })

  /**
   * Whether the session can receive user input
   */
  const canSendInput = computed(() => {
    return canSessionReceiveInput(session.value)
  })

  /**
   * Whether the session is currently active
   */
  const isActive = computed(() => {
    return isSessionActive(session.value)
  })

  /**
   * Whether the session is stopped/terminal
   */
  const isStopped = computed(() => {
    return isSessionStopped(session.value)
  })

  /**
   * Whether the session can be started
   */
  const canStart = computed(() => {
    if (!session.value) return false
    return session.value.status === SESSION_STATUS.CREATED
  })

  /**
   * Whether the session can be stopped
   */
  const canStop = computed(() => {
    if (!session.value) return false
    return SESSION_INPUT_STATUSES.includes(session.value.status)
  })

  /**
   * Whether the session can be continued (resumed)
   */
  const canContinue = computed(() => {
    if (!session.value) return false
    return session.value.status === SESSION_STATUS.STOPPED
  })

  return {
    statusClass,
    statusText,
    canSendInput,
    isActive,
    isStopped,
    canStart,
    canStop,
    canContinue
  }
}
