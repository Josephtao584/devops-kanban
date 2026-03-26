<template>
  <div class="step-session-panel">
    <div class="panel-header">
      <div>
        <div class="panel-title">{{ stepName || '步骤会话' }}</div>
        <div class="panel-subtitle" v-if="sessionId">Session #{{ sessionId }}</div>
      </div>
      <div class="panel-status">{{ sessionStatus || 'PENDING' }}</div>
    </div>

    <div v-if="!sessionId" class="panel-empty">暂无会话记录</div>
    <div v-else-if="error" class="panel-error">{{ error.message || error }}</div>
    <div v-else-if="isLoading" class="panel-loading">加载中...</div>
    <div v-else-if="events.length === 0" class="panel-empty">暂无事件</div>
    <div v-else ref="eventsContainer" class="panel-events">
      <SessionEventRenderer
        v-for="event in events"
        :key="event.id ?? event.seq"
        :event="event"
      />
    </div>

    <div v-if="sessionId && canInput" class="panel-input">
      <input
        v-model="message"
        @keyup.enter="sendMessage"
        placeholder="继续对话..."
        :disabled="isBusy || isSending"
      />
      <button @click="sendMessage" :disabled="!message.trim() || isBusy || isSending">
        {{ isBusy ? '处理中...' : (isSending ? '发送中...' : '发送') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import SessionEventRenderer from '../session/SessionEventRenderer.vue'
import { useSessionEvents } from '../../composables/useSessionEvents.js'
import { SESSION_INPUT_STATUSES, SESSION_BUSY_STATUSES } from '../../constants/session.js'
import { getSession, continueSession } from '../../api/session.js'

const props = defineProps({
  sessionId: {
    type: Number,
    default: null
  },
  stepName: {
    type: String,
    default: ''
  }
})

const { events, isLoading, error, loadInitial, startPolling, stopPolling } = useSessionEvents()
const message = ref('')
const isSending = ref(false)
const sessionStatus = ref('')
const eventsContainer = ref(null)

const canInput = computed(() => SESSION_INPUT_STATUSES.includes(sessionStatus.value))
const isBusy = computed(() => SESSION_BUSY_STATUSES.includes(sessionStatus.value))

function scrollToBottom() {
  nextTick(() => {
    if (eventsContainer.value) {
      eventsContainer.value.scrollTop = eventsContainer.value.scrollHeight
    }
  })
}

async function fetchSessionStatus() {
  if (!props.sessionId) {
    sessionStatus.value = ''
    return
  }
  try {
    const response = await getSession(props.sessionId)
    sessionStatus.value = response.data?.status || ''
  } catch (err) {
    console.error('Failed to fetch session status:', err)
    sessionStatus.value = ''
  }
}

async function sendMessage() {
  if (!message.value.trim() || isSending.value || !props.sessionId) return

  isSending.value = true
  try {
    await continueSession(props.sessionId, message.value.trim())
    message.value = ''
    await fetchSessionStatus()
    await loadInitial(props.sessionId)
    scrollToBottom()
    startPollingWithStatusCheck()
  } catch (err) {
    console.error('Failed to send message:', err)
    alert('发送失败: ' + (err.message || err))
  } finally {
    isSending.value = false
  }
}

function startPollingWithStatusCheck() {
  startPolling(props.sessionId, () => false)
}

async function setupSession() {
  stopPolling()

  if (!props.sessionId) {
    sessionStatus.value = ''
    return
  }

  await fetchSessionStatus()
  await loadInitial(props.sessionId)
  scrollToBottom()
  startPollingWithStatusCheck()
}

// Watch events changes and scroll to bottom
watch(events, () => {
  scrollToBottom()
}, { deep: true })

// Poll session status periodically
let statusPollTimer = null
function startStatusPolling() {
  stopStatusPolling()
  statusPollTimer = setInterval(async () => {
    if (props.sessionId && sessionStatus.value === 'RUNNING') {
      await fetchSessionStatus()
    }
  }, 2000)
}

function stopStatusPolling() {
  if (statusPollTimer) {
    clearInterval(statusPollTimer)
    statusPollTimer = null
  }
}

watch(
  () => props.sessionId,
  () => {
    setupSession()
    startStatusPolling()
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  stopPolling()
  stopStatusPolling()
})
</script>

<style scoped>
.step-session-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 320px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
}

.panel-subtitle,
.panel-status {
  font-size: 12px;
  color: #64748b;
}

.panel-empty,
.panel-loading,
.panel-error {
  padding: 16px;
  border-radius: 8px;
  background: #f8fafc;
  color: #64748b;
}

.panel-error {
  background: #fef2f2;
  color: #b91c1c;
}

.panel-events {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
  flex: 1;
}

.panel-input {
  display: flex;
  gap: 8px;
  padding: 8px;
  border-top: 1px solid #e2e8f0;
}

.panel-input input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
}

.panel-input button {
  padding: 8px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.panel-input button:disabled {
  background: #94a3b8;
  cursor: not-allowed;
}
</style>
