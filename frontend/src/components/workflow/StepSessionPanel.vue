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
    <div v-else class="panel-events">
      <SessionEventRenderer
        v-for="event in events"
        :key="event.id ?? event.seq"
        :event="event"
      />
    </div>

    <div v-if="sessionId && isTerminal" class="panel-input">
      <input
        v-model="message"
        @keyup.enter="sendMessage"
        placeholder="继续对话..."
        :disabled="isSending"
      />
      <button @click="sendMessage" :disabled="!message.trim() || isSending">
        {{ isSending ? '发送中...' : '发送' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import SessionEventRenderer from '../session/SessionEventRenderer.vue'
import { useSessionEvents } from '../../composables/useSessionEvents.js'
import { SESSION_TERMINAL_STATUSES } from '../../constants/session.js'
import { continueSession } from '../../api/session.js'

const props = defineProps({
  sessionId: {
    type: Number,
    default: null
  },
  sessionStatus: {
    type: String,
    default: ''
  },
  stepName: {
    type: String,
    default: ''
  }
})

const { events, isLoading, error, loadInitial, startPolling, stopPolling } = useSessionEvents()
const message = ref('')
const isSending = ref(false)

const isTerminal = computed(() => SESSION_TERMINAL_STATUSES.includes(props.sessionStatus))

async function sendMessage() {
  if (!message.value.trim() || isSending.value || !props.sessionId) return

  isSending.value = true
  try {
    await continueSession(props.sessionId, message.value.trim())
    message.value = ''
    await loadInitial(props.sessionId)
    startPolling(props.sessionId, () => SESSION_TERMINAL_STATUSES.includes(props.sessionStatus))
  } catch (err) {
    console.error('Failed to send message:', err)
    alert('发送失败: ' + (err.message || err))
  } finally {
    isSending.value = false
  }
}

async function setupSession() {
  stopPolling()

  if (!props.sessionId) {
    return
  }

  await loadInitial(props.sessionId)
  if (!isTerminal.value) {
    startPolling(props.sessionId, () => SESSION_TERMINAL_STATUSES.includes(props.sessionStatus))
  }
}

watch(
  () => [props.sessionId, props.sessionStatus],
  () => {
    setupSession()
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  stopPolling()
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
