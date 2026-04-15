import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useBrowserNotifications } from './useBrowserNotifications'
import { useI18n } from 'vue-i18n'

const eventSource = ref(null)
const connected = ref(false)

export function useSseNotifications() {
  const { showNotification } = useBrowserNotifications()
  const { t } = useI18n()

  const eventMessages = {
    SUSPENDED: { titleKey: 'notification.suspendedTitle', bodyKey: 'notification.suspendedBody', event: 'workflowSuspended' },
    COMPLETED: { titleKey: 'notification.completedTitle', bodyKey: 'notification.completedBody', event: 'workflowCompleted' },
    FAILED: { titleKey: 'notification.failedTitle', bodyKey: 'notification.failedBody', event: 'workflowFailed' },
  }

  function connect() {
    if (eventSource.value) return

    const es = new EventSource('/api/notifications/events')
    eventSource.value = es

    es.onopen = () => {
      connected.value = true
    }

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data)
        const msg = eventMessages[event.type]
        if (msg) {
          showNotification(`${event.taskTitle} - ${t(msg.titleKey)}`, {
            body: t(msg.bodyKey),
            eventType: msg.event,
          })
        }
      } catch {
        // Ignore malformed data
      }
    }

    es.onerror = () => {
      connected.value = false
      es.close()
      eventSource.value = null
      setTimeout(connect, 5000)
    }
  }

  function disconnect() {
    if (eventSource.value) {
      eventSource.value.close()
      eventSource.value = null
      connected.value = false
    }
  }

  onMounted(() => {
    connect()
  })

  onBeforeUnmount(() => {
    disconnect()
  })

  return { connected, connect, disconnect }
}
