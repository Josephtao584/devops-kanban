<template>
  <div class="step-session-panel">
    <div class="panel-header">
      <div class="panel-heading">
        <div class="panel-title-row">
          <div>
            <div class="panel-title">{{ stepName || '步骤会话' }}</div>
            <div class="panel-subtitle" v-if="sessionId">Session #{{ sessionId }}</div>
          </div>
          <div class="panel-status" :class="statusClass">{{ sessionStatusText }}</div>
        </div>
      </div>
    </div>

    <div v-if="!sessionId" class="panel-state panel-empty">
      <div class="panel-state-title">暂无会话记录</div>
      <div class="panel-state-text">当前步骤还没有生成可查看的执行会话。</div>
    </div>
    <div v-else-if="error" class="panel-state panel-error">
      <div class="panel-state-title">加载失败</div>
      <div class="panel-state-text">{{ error.message || error }}</div>
    </div>
    <div v-else-if="isLoading" class="panel-state panel-loading">
      <div class="panel-state-title">加载中...</div>
      <div class="panel-state-text">正在获取会话事件。</div>
    </div>
    <div v-else-if="events.length === 0" class="panel-state panel-empty">
      <div class="panel-state-title">暂无事件</div>
      <div class="panel-state-text">这里会显示该步骤的执行输出和对话记录。</div>
    </div>
    <div v-else ref="eventsContainer" class="panel-events">
      <SessionEventRenderer
        v-for="event in events"
        :key="event.id ?? event.seq"
        :event="event"
      />
    </div>

    <div v-if="sessionId && canInput" class="panel-input">
      <div class="panel-input-shell">
        <input
          v-model="message"
          @keyup.enter="sendMessage"
          placeholder="继续追问或补充要求..."
          :disabled="isBusy || isSending"
        />
        <button @click="sendMessage" :disabled="!message.trim() || isBusy || isSending">
          {{ isBusy ? '处理中...' : (isSending ? '发送中...' : '发送') }}
        </button>
      </div>
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
const statusClass = computed(() => `status-${(sessionStatus.value || 'pending').toLowerCase()}`)
const sessionStatusText = computed(() => {
  const texts = {
    PENDING: '待开始',
    RUNNING: '进行中',
    STOPPED: '已暂停',
    COMPLETED: '已完成',
    FAILED: '失败',
    CANCELLED: '已取消'
  }
  return texts[sessionStatus.value] || sessionStatus.value || '待开始'
})

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

watch(events, () => {
  scrollToBottom()
}, { deep: true })

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
  min-height: 0;
  height: 100%;
  padding: 16px 18px 18px;
  background: #fafafa;
}

.panel-header {
  flex-shrink: 0;
}

.panel-heading {
  display: flex;
  flex-direction: column;
}

.panel-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.panel-title {
  font-size: 18px;
  font-weight: 600;
  line-height: 1.35;
  color: #111827;
}

.panel-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}

.panel-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  background: #eceff3;
  color: #4b5563;
}

.panel-status.status-running {
  background: #e8f1ff;
  color: #2563eb;
}

.panel-status.status-completed {
  background: #eaf8f1;
  color: #059669;
}

.panel-status.status-failed,
.panel-status.status-cancelled {
  background: #fdecec;
  color: #dc2626;
}

.panel-status.status-stopped {
  background: #fff4e5;
  color: #d97706;
}

.panel-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  min-height: 160px;
  padding: 18px 20px;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #ffffff;
}

.panel-state-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.panel-state-text {
  font-size: 13px;
  line-height: 1.6;
  color: #6b7280;
}

.panel-error {
  border-color: #fecaca;
  background: #fff7f7;
}

.panel-loading .panel-state-title,
.panel-loading .panel-state-text {
  color: #4b5563;
}

.panel-events {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 4px 0;
}

.panel-input {
  flex-shrink: 0;
  padding-top: 4px;
}

.panel-input-shell {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #ffffff;
}

.panel-input input {
  flex: 1;
  min-width: 0;
  padding: 10px 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: #111827;
}

.panel-input input::placeholder {
  color: #9ca3af;
}

.panel-input button {
  padding: 9px 14px;
  border: none;
  border-radius: 12px;
  background: #111827;
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.15s ease;
}

.panel-input button:hover:not(:disabled) {
  opacity: 0.88;
}

.panel-input button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>

