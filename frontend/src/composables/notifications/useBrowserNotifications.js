import { ref } from 'vue'
import { useNotificationSettings } from './useNotificationSettings'

export function useBrowserNotifications() {
  const { enabled, events } = useNotificationSettings()

  const supported = typeof window !== 'undefined' && 'Notification' in window
  const permission = ref(supported ? window.Notification.permission : 'denied')

  async function requestPermission() {
    if (!supported) return 'denied'
    const result = await window.Notification.requestPermission()
    permission.value = result
    return result
  }

  function showNotification(title, options = {}) {
    if (!supported) return null
    if (permission.value !== 'granted') return null
    if (!enabled.value) return null

    const { eventType, ...notificationOptions } = options
    if (eventType && events.value[eventType] === false) return null

    const notification = new window.Notification(title, notificationOptions)
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
    return notification
  }

  return { permission, supported, requestPermission, showNotification }
}
