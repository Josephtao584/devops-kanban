import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBrowserNotifications } from '../useBrowserNotifications'
import { _resetSettings } from '../useNotificationSettings'

describe('useBrowserNotifications', () => {
  beforeEach(() => {
    _resetSettings()
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('returns default permission when Notification API unavailable', () => {
    const originalNotification = window.Notification
    delete window.Notification

    const { permission } = useBrowserNotifications()
    expect(permission.value).toBe('denied')

    window.Notification = originalNotification
  })

  it('requests permission and updates state', async () => {
    const mockRequest = vi.fn().mockResolvedValue('granted')
    window.Notification = { requestPermission: mockRequest, permission: 'default' }

    const { permission, requestPermission } = useBrowserNotifications()
    await requestPermission()

    expect(mockRequest).toHaveBeenCalled()
    expect(permission.value).toBe('granted')
  })

  it('shows notification when permission granted and settings enabled', () => {
    const mockNotification = vi.fn()
    window.Notification = mockNotification
    mockNotification.permission = 'granted'
    mockNotification.requestPermission = vi.fn()

    const { showNotification } = useBrowserNotifications()
    showNotification('Test Title', { body: 'Test Body' })

    expect(mockNotification).toHaveBeenCalledWith('Test Title', { body: 'Test Body' })
  })

  it('does not show notification when permission denied', () => {
    const mockNotification = vi.fn()
    window.Notification = mockNotification
    mockNotification.permission = 'denied'
    mockNotification.requestPermission = vi.fn()

    const { showNotification } = useBrowserNotifications()
    showNotification('Test Title', { body: 'Test Body' })

    expect(mockNotification).not.toHaveBeenCalled()
  })

  it('does not show notification when globally disabled', () => {
    localStorage.setItem('notification-settings', JSON.stringify({
      enabled: false
    }))

    const mockNotification = vi.fn()
    window.Notification = mockNotification
    mockNotification.permission = 'granted'
    mockNotification.requestPermission = vi.fn()

    const { showNotification } = useBrowserNotifications()
    showNotification('Test', { body: 'Body' })

    expect(mockNotification).not.toHaveBeenCalled()
  })
})
