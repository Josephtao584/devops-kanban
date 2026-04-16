import { ref } from 'vue'
import { usePolling } from '../usePolling.js'

export function useWorkflowRunPolling({ fetchFn, isTerminal, interval = 3000 } = {}) {
  const pollingEnabled = ref(true)

  const polling = usePolling({
    fetchFn,
    isTerminalFn: isTerminal,
    interval,
    label: 'useWorkflowRunPolling'
  })

  // Override isPolling to respect pollingEnabled
  const isPolling = polling.isPolling

  async function startPolling() {
    if (!pollingEnabled.value) return

    // Initial immediate fetch, then start polling
    try {
      await fetchFn()
    } catch {
      // Ignore initial fetch errors
    }

    if (!isTerminal()) {
      polling.startPolling()
    }
  }

  function togglePolling(enabled) {
    pollingEnabled.value = enabled
    if (!enabled) {
      polling.stopPolling()
    }
  }

  return {
    pollingEnabled,
    isPolling,
    startPolling,
    stopPolling: polling.stopPolling,
    togglePolling
  }
}
