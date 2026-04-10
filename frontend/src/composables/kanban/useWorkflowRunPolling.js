import { ref, onBeforeUnmount } from 'vue'

export function useWorkflowRunPolling({ fetchFn, isTerminal, interval = 3000 }) {
  const pollingEnabled = ref(true)
  const isPolling = ref(false)
  let pollTimer = null
  let retryCount = 0
  const MAX_RETRIES = 5

  function stopPolling() {
    if (pollTimer) {
      clearTimeout(pollTimer)
      pollTimer = null
    }
    isPolling.value = false
  }

  function startPolling() {
    stopPolling()
    if (!pollingEnabled.value) return
    isPolling.value = true
    retryCount = 0

    function scheduleNext(delay) {
      pollTimer = setTimeout(async () => {
        if (isTerminal()) {
          stopPolling()
          return
        }

        try {
          await fetchFn()
          retryCount = 0
        } catch (err) {
          retryCount++
          if (retryCount >= MAX_RETRIES) {
            console.error(`[useWorkflowRunPolling] Polling failed ${MAX_RETRIES} times, stopping.`, err)
            stopPolling()
            return
          }
          const backoff = Math.min(interval * Math.pow(2, retryCount), 30000)
          console.warn(`[useWorkflowRunPolling] Polling failed (${retryCount}/${MAX_RETRIES}), retrying in ${backoff}ms`, err.message)
          scheduleNext(backoff)
          return
        }

        if (isTerminal()) {
          stopPolling()
          return
        }

        scheduleNext(interval)
      }, delay)
    }

    // Initial fetch immediately, then start polling
    fetchFn().then(() => {
      retryCount = 0
    }).catch(() => {
      // Ignore initial fetch errors, will retry in scheduleNext
    }).finally(() => {
      if (!isTerminal()) {
        scheduleNext(interval)
      }
    })
  }

  function togglePolling(enabled) {
    pollingEnabled.value = enabled
    if (!enabled) {
      stopPolling()
    }
  }

  onBeforeUnmount(() => {
    stopPolling()
  })

  return {
    pollingEnabled,
    isPolling,
    startPolling,
    stopPolling,
    togglePolling
  }
}
