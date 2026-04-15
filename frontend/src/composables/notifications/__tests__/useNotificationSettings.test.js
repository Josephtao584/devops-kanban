import { beforeEach, describe, expect, it } from 'vitest'
import { useNotificationSettings, _resetSettings } from '../useNotificationSettings'

describe('useNotificationSettings', () => {
  beforeEach(() => {
    _resetSettings()
    localStorage.clear()
  })

  it('returns default settings when no saved config', () => {
    const { enabled, chatEnabled, events } = useNotificationSettings()

    expect(enabled.value).toBe(true)
    expect(chatEnabled.value).toBe(false)
    expect(events.value).toEqual({ workflowSuspended: true, workflowCompleted: false, workflowFailed: false })
  })

  it('persists settings to localStorage on update', () => {
    const { updateSettings } = useNotificationSettings()

    updateSettings({ enabled: false })

    const saved = JSON.parse(localStorage.getItem('notification-settings'))
    expect(saved.enabled).toBe(false)
    expect(saved.events.workflowSuspended).toBe(true)
  })

  it('restores settings from localStorage', () => {
    localStorage.setItem('notification-settings', JSON.stringify({
      enabled: false,
      chatEnabled: true,
      events: { workflowSuspended: false, workflowCompleted: true, workflowFailed: true }
    }))

    const { enabled, chatEnabled, events } = useNotificationSettings()

    expect(enabled.value).toBe(false)
    expect(chatEnabled.value).toBe(true)
    expect(events.value.workflowSuspended).toBe(false)
    expect(events.value.workflowCompleted).toBe(true)
    expect(events.value.workflowFailed).toBe(true)
  })

  it('updates individual event settings', () => {
    const { updateSettings, events } = useNotificationSettings()

    updateSettings({ events: { workflowSuspended: false } })

    expect(events.value.workflowSuspended).toBe(false)
    const saved = JSON.parse(localStorage.getItem('notification-settings'))
    expect(saved.events.workflowSuspended).toBe(false)
  })

  it('updates chatEnabled setting', () => {
    const { updateSettings, chatEnabled } = useNotificationSettings()

    updateSettings({ chatEnabled: true })

    expect(chatEnabled.value).toBe(true)
    const saved = JSON.parse(localStorage.getItem('notification-settings'))
    expect(saved.chatEnabled).toBe(true)
  })
})
