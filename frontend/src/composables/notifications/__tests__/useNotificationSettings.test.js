import { beforeEach, describe, expect, it } from 'vitest'
import { useNotificationSettings, _resetSettings } from '../useNotificationSettings'

describe('useNotificationSettings', () => {
  beforeEach(() => {
    _resetSettings()
    localStorage.clear()
  })

  it('returns default settings when no saved config', () => {
    const { enabled, chatEnabled } = useNotificationSettings()

    expect(enabled.value).toBe(true)
    expect(chatEnabled.value).toBe(false)
  })

  it('persists settings to localStorage on update', () => {
    const { updateSettings } = useNotificationSettings()

    updateSettings({ enabled: false })

    const saved = JSON.parse(localStorage.getItem('notification-settings'))
    expect(saved.enabled).toBe(false)
  })

  it('restores settings from localStorage', () => {
    localStorage.setItem('notification-settings', JSON.stringify({
      enabled: false,
      chatEnabled: true
    }))

    const { enabled, chatEnabled } = useNotificationSettings()

    expect(enabled.value).toBe(false)
    expect(chatEnabled.value).toBe(true)
  })

  it('updates chatEnabled setting', () => {
    const { updateSettings, chatEnabled } = useNotificationSettings()

    updateSettings({ chatEnabled: true })

    expect(chatEnabled.value).toBe(true)
    const saved = JSON.parse(localStorage.getItem('notification-settings'))
    expect(saved.chatEnabled).toBe(true)
  })
})
