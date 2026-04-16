import { ref, onBeforeUnmount, getCurrentInstance } from 'vue'

/**
 * Generic polling composable with exponential backoff and retry logic.
 * @param {Object} options
 * @param {Function} options.fetchFn - Async function to call on each poll
 * @param {Function} options.isTerminalFn - Returns true when polling should stop
 * @param {number} options.interval - Polling interval in ms (default: 3000)
 * @param {number} options.maxRetries - Max consecutive failures before stopping (default: 5)
 * @param {string} options.label - Label for log messages (default: 'usePolling')
 */
export function usePolling({ fetchFn, isTerminalFn = () => false, interval = 3000, maxRetries = 5, label = 'usePolling' } = {}) {
  const isPolling = ref(false)
  let pollTimer = null
  let retryCount = 0

  function stopPolling() {
    if (pollTimer) {
      clearTimeout(pollTimer)
      pollTimer = null
    }
    isPolling.value = false
  }

  function startPolling() {
    stopPolling()
    retryCount = 0

    if (isTerminalFn()) {
      return
    }

    isPolling.value = true

    function scheduleNext(delay) {
      pollTimer = setTimeout(async () => {
        if (isTerminalFn()) {
          stopPolling()
          return
        }

        try {
          await fetchFn()
          retryCount = 0
        } catch (err) {
          retryCount++
          if (retryCount >= maxRetries) {
            console.error(`[${label}] Polling failed ${maxRetries} times, stopping.`, err)
            stopPolling()
            return
          }
          const backoff = Math.min(interval * Math.pow(2, retryCount), 30000)
          console.warn(`[${label}] Polling failed (${retryCount}/${maxRetries}), retrying in ${backoff}ms`, err.message)
          scheduleNext(backoff)
          return
        }

        if (isTerminalFn()) {
          stopPolling()
          return
        }

        scheduleNext(interval)
      }, delay)
    }

    scheduleNext(interval)
  }

  // Only register lifecycle hook when inside a component instance
  if (getCurrentInstance()) {
    onBeforeUnmount(() => {
      stopPolling()
    })
  }

  return {
    isPolling,
    startPolling,
    stopPolling
  }
}
