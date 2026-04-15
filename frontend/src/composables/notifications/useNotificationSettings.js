import { ref } from 'vue'

const STORAGE_KEY = 'notification-settings'
const DEFAULT_SETTINGS = {
  enabled: true,
  chatEnabled: false
}

// Module-scoped singleton state — shared across all callers
let _initialized = false
const enabled = ref(DEFAULT_SETTINGS.enabled)
const chatEnabled = ref(DEFAULT_SETTINGS.chatEnabled)

function _initFromStorage() {
  if (_initialized) return
  _initialized = true
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      if (saved.enabled !== undefined) enabled.value = saved.enabled
      if (saved.chatEnabled !== undefined) chatEnabled.value = saved.chatEnabled
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
    if (updates.chatEnabled !== undefined) {
      chatEnabled.value = updates.chatEnabled
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        enabled: enabled.value,
        chatEnabled: chatEnabled.value
      }))
    } catch {
      // ignore quota or storage errors
    }
  }

  return { enabled, chatEnabled, updateSettings }
}

// Reset singleton state (for testing only)
export function _resetSettings() {
  _initialized = false
  enabled.value = DEFAULT_SETTINGS.enabled
  chatEnabled.value = DEFAULT_SETTINGS.chatEnabled
}
