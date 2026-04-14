import { ref } from 'vue'

const STORAGE_KEY = 'notification-settings'
const DEFAULT_SETTINGS = {
  enabled: true,
  events: { workflowSuspended: true }
}

// Module-scoped singleton state — shared across all callers
let _initialized = false
const enabled = ref(DEFAULT_SETTINGS.enabled)
const events = ref({ ...DEFAULT_SETTINGS.events })

function _initFromStorage() {
  if (_initialized) return
  _initialized = true
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      if (saved.enabled !== undefined) enabled.value = saved.enabled
      if (saved.events) events.value = saved.events
    }
  } catch {
    // ignore parse errors
  }
}

export function useNotificationSettings() {
  _initFromStorage()

  function updateSettings(updates) {
    if (updates.enabled !== undefined) {
      enabled.value = updates.enabled
    }
    if (updates.events) {
      events.value = { ...events.value, ...updates.events }
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        enabled: enabled.value,
        events: events.value
      }))
    } catch {
      // ignore quota or storage errors
    }
  }

  return { enabled, events, updateSettings }
}

// Reset singleton state (for testing only)
export function _resetSettings() {
  _initialized = false
  enabled.value = DEFAULT_SETTINGS.enabled
  events.value = { ...DEFAULT_SETTINGS.events }
}
