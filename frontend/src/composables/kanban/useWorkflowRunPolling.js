import { ref, onBeforeUnmount } from 'vue'

export function useWorkflowRunPolling({ fetchFn, isTerminal, interval = 3000 }) {
  const pollingEnabled = ref(true)
  const isPolling = ref(false)
  let pollTimer = null

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    isPolling.value = false
  }

  async function startPolling() {
    stopPolling()
    if (!pollingEnabled.value) return
    isPolling.value = true

    await fetchFn()

    pollTimer = setInterval(async () => {
      if (isTerminal()) {
        stopPolling()
        return
      }
      await fetchFn()
      if (isTerminal()) {
        stopPolling()
      }
    }, interval)
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
