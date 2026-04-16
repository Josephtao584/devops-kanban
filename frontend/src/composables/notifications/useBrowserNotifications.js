import { ref } from 'vue'
import { useNotificationSettings } from './useNotificationSettings'
import { sendNotification as apiSendNotification } from '../../api/notification'

export function useBrowserNotifications() {
  const { enabled, chatEnabled } = useNotificationSettings()

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

    const notification = new window.Notification(title, options)
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
    return notification
  }

  async function sendChatNotification(content) {
    if (!chatEnabled.value) return false
    try {
      await apiSendNotification(content)
      return true
    } catch {
      return false
    }
  }

  return { permission, supported, requestPermission, showNotification, sendChatNotification }
}
