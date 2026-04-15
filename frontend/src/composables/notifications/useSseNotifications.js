import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useBrowserNotifications } from './useBrowserNotifications'

const eventSource = ref(null)
const connected = ref(false)

export function useSseNotifications() {
  const { showNotification } = useBrowserNotifications()

  const eventMessages = {
    SUSPENDED: { title: '工作流等待确认', body: '工作流执行已暂停，需要您确认后继续' },
    COMPLETED: { title: '工作流已完成', body: '工作流执行已完成' },
    FAILED: { title: '工作流执行失败', body: '工作流执行失败，请查看详情' },
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
          showNotification(`${event.taskTitle} - ${msg.title}`, {
            body: msg.body,
            eventType: `workflow${event.type.charAt(0) + event.type.slice(1).toLowerCase()}`,
          })
        }
      } catch {
        // Ignore malformed data
      }
    }

    es.onerror = () => {
      connected.value = false
      // Auto reconnect after 5s
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
