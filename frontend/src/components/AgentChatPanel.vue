<template>
  <div class="agent-chat-panel">
    <!-- Panel header -->
    <div class="chat-panel-header">
      <div class="chat-panel-title-row">
        <span class="chat-panel-title">{{ $t('agent.chatTitle') }}</span>
        <span class="chat-title-hint">{{ $t('agent.chatTitleHint') }}</span>
        <span v-if="sessionStatus === 'running'" class="chat-status-badge running">
          {{ $t('agent.chatRunning') }}
          <span class="chat-timer">{{ formattedElapsed }}</span>
        </span>
        <span v-else-if="sessionStatus === 'idle'" class="chat-status-badge idle">{{ $t('agent.chatReady') }}</span>
      </div>
      <button class="btn btn-secondary btn-sm" :disabled="isCreatingSession || isLoadingMessages" @click="startNewSession">
        {{ isCreatingSession ? $t('common.loading') : $t('agent.chatNewSession') }}
      </button>
    </div>

    <!-- Chat body -->
    <div class="chat-body">
      <!-- No session state -->
      <div v-if="!chatId && !isCreatingSession && !isLoadingMessages" class="chat-empty-state">
        <div class="chat-empty-icon">💬</div>
        <p class="chat-empty-title">{{ $t('agent.chatNoSession') }}</p>
        <p class="chat-empty-hint">{{ $t('agent.chatNoSessionHint') }}</p>
        <button class="btn btn-primary" :disabled="isCreatingSession" @click="startNewSession">
          {{ isCreatingSession ? $t('common.loading') : $t('agent.chatStart') }}
        </button>
      </div>

      <!-- Loading state -->
      <div v-else-if="isCreatingSession || isLoadingMessages" class="chat-empty-state">
        <p class="chat-empty-hint">{{ $t('common.loading') }}</p>
      </div>

      <!-- Messages list -->
      <div v-else ref="messagesContainer" class="chat-messages">
        <div v-if="messages.length === 0 && sessionStatus !== 'running'" class="chat-empty-state chat-empty-state--inline">
          <p class="chat-empty-hint">{{ $t('agent.chatEmptyHint') }}</p>
        </div>

        <template v-for="msg in displayedMessages" :key="msg._key">
          <!-- User message bubble -->
          <div v-if="msg.role === 'user' && msg.kind === 'message'" class="chat-user-message">
            <div class="chat-user-bubble">{{ msg.content }}</div>
          </div>

          <!-- Agent events via SessionEventRenderer -->
          <SessionEventRenderer v-else :event="msg" />
        </template>

        <!-- Thinking indicator -->
        <div v-if="sessionStatus === 'running'" class="chat-thinking-indicator">
          <span class="thinking-dot"></span>
          <span class="thinking-dot"></span>
          <span class="thinking-dot"></span>
          <span class="thinking-text">{{ $t('agent.chatThinking') }}</span>
        </div>
      </div>
    </div>

    <!-- Toolbar -->
    <div v-if="chatId" class="chat-toolbar">
      <label class="chat-filter-check" @click.prevent="autoScrollEnabled = !autoScrollEnabled">
        <span class="check-box" :class="{ checked: autoScrollEnabled }">
          <svg v-if="autoScrollEnabled" width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5l2.5 2.5L8 3" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span class="check-label">{{ $t('agent.chatAutoScroll') }}</span>
      </label>
      <label class="chat-filter-check" @click.prevent="hideToolMessages = !hideToolMessages">
        <span class="check-box" :class="{ checked: hideToolMessages }">
          <svg v-if="hideToolMessages" width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5l2.5 2.5L8 3" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span class="check-label">{{ $t('agent.chatHideTools') }}</span>
      </label>
      <label class="chat-filter-check" @click.prevent="hideThinkingMessages = !hideThinkingMessages">
        <span class="check-box" :class="{ checked: hideThinkingMessages }">
          <svg v-if="hideThinkingMessages" width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5l2.5 2.5L8 3" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span class="check-label">{{ $t('agent.chatHideThinking') }}</span>
      </label>
    </div>

    <!-- Input area -->
    <div v-if="chatId" class="chat-input-area">
      <div class="chat-input-wrapper">
        <textarea
          ref="inputRef"
          v-model="inputText"
          class="chat-input"
          :placeholder="$t('agent.chatInputPlaceholder')"
          :disabled="sessionStatus === 'running'"
          rows="2"
          @keydown.enter.exact.prevent="sendMessage"
        />
        <button
          class="chat-send-btn"
          :disabled="!inputText.trim() || sessionStatus === 'running'"
          @click="sendMessage"
        >
          <svg v-if="sessionStatus !== 'running'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
          <span v-else class="send-spinner"></span>
        </button>
      </div>
      <p class="chat-input-hint">{{ $t('agent.chatInputHint') }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, computed, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import SessionEventRenderer from './session/SessionEventRenderer.vue'
import { createChatSession, deleteChatSession, getLatestChatSession, streamChatMessage } from '../api/agentChat.js'
import { normalizeEvents } from '../composables/useSessionEvents.js'

const { t } = useI18n()

const props = defineProps({
  agent: {
    type: Object,
    default: null
  }
})

// ─── Component state ──────────────────────────────────────────────────────────
const chatId = ref(null)
const sessionStatus = ref('idle') // 'idle' | 'running'
const messages = ref([])
const inputText = ref('')
const isCreatingSession = ref(false)
const isLoadingMessages = ref(false)
const messagesContainer = ref(null)
const inputRef = ref(null)
const hideToolMessages = ref(true)
const hideThinkingMessages = ref(true)
const autoScrollEnabled = ref(true)
let streamController = null
let currentAgentId = null
// Temp ID counter for messages created during streaming (before backend assigns IDs)
let tempIdCounter = -1
let pollInterval = null

// ─── Timer state ─────────────────────────────────────────────────────────────
const elapsedSeconds = ref(0)
let timerInterval = null
let receivedCompletedStatus = false
const COMPLETED_PATTERNS = ['完成', '结束', 'success', 'completed', 'done']

function startTimer(initialSeconds = 0) {
  stopTimer()
  elapsedSeconds.value = initialSeconds
  timerInterval = setInterval(() => {
    elapsedSeconds.value++
  }, 1000)
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

// ─── Polling for running sessions ────────────────────────────────────────────
function startPolling() {
  stopPolling()
  pollInterval = setInterval(async () => {
    if (!chatId.value || !currentAgentId) {
      stopPolling()
      return
    }
    try {
      const res = await getLatestChatSession(currentAgentId)
      if (res?.success && res.data && res.data.id === chatId.value) {
        const session = res.data
        const normalized = normalizeEvents(session.messages || [])
        messages.value = normalized.map(m => ({ ...m, _key: `b_${m.id}` }))
        scrollToBottom()

        if (session.status !== 'running') {
          sessionStatus.value = 'idle'
          stopTimer()
          stopPolling()
          nextTick(() => inputRef.value?.focus())
        }
      }
    } catch (err) {
      console.error('Chat poll error:', err)
    }
  }, 2000)
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

const formattedElapsed = computed(() => {
  const mins = Math.floor(elapsedSeconds.value / 60)
  const secs = elapsedSeconds.value % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
})

const displayedMessages = computed(() => {
  let result = messages.value
  if (hideToolMessages.value) {
    result = result.filter(m => m.kind !== 'tool_call' && m.kind !== 'tool_result')
  }
  if (hideThinkingMessages.value) {
    result = result.filter(m => !m.isThinking)
  }
  return result
})

// ─── Scroll ───────────────────────────────────────────────────────────────────
function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value && autoScrollEnabled.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

// ─── Session lifecycle ────────────────────────────────────────────────────────

/** Create a brand-new backend session and set it as active. */
async function doCreateSession(agentId) {
  isCreatingSession.value = true
  try {
    const response = await createChatSession(agentId)
    if (!response?.success) {
      console.error('Failed to start chat session:', response?.message)
      return
    }
    chatId.value = response.data.id
    currentAgentId = agentId
    sessionStatus.value = 'idle'
    messages.value = []
  } catch (err) {
    console.error('Failed to start chat session:', err)
  } finally {
    isCreatingSession.value = false
  }
}

/**
 * Restore an existing session from backend or create a new one.
 * Called automatically when the selected agent changes.
 */
async function loadOrCreateSession(agentId) {
  // Query backend for the latest active session for this agent
  isLoadingMessages.value = true
  try {
    const res = await getLatestChatSession(agentId)
    if (res?.success && res.data && res.data.id) {
      const session = res.data
      const normalized = normalizeEvents(session.messages || [])
      messages.value = normalized.map(m => ({ ...m, _key: `b_${m.id}` }))
      chatId.value = session.id
      currentAgentId = agentId
      tempIdCounter = -1

      if (session.status === 'running') {
        sessionStatus.value = 'running'
        const lastUserMsg = [...(session.messages || [])].reverse().find(m => m.role === 'user')
        const elapsed = lastUserMsg
          ? Math.floor((Date.now() - new Date(lastUserMsg.created_at).getTime()) / 1000)
          : 0
        startTimer(Math.max(0, elapsed))
        startPolling()
      } else {
        sessionStatus.value = 'idle'
      }

      nextTick(() => scrollToBottom())
      return
    }
  } catch {
    // No existing session or server error; fall through to create new
  } finally {
    isLoadingMessages.value = false
  }

  await doCreateSession(agentId)
}

/**
 * Explicitly start a new session (user clicked "新建对话").
 * Deletes the current backend session and creates a fresh one.
 */
async function startNewSession() {
  if (!props.agent) return
  if (isCreatingSession.value) return

  if (streamController) {
    streamController.abort()
    streamController = null
  }
  if (chatId.value && currentAgentId) {
    try { await deleteChatSession(currentAgentId, chatId.value) } catch { /* noop */ }
  }
  chatId.value = null
  sessionStatus.value = 'idle'
  stopTimer()
  stopPolling()
  elapsedSeconds.value = 0
  messages.value = []
  currentAgentId = null

  await doCreateSession(props.agent.id)
}

// ─── Messaging ────────────────────────────────────────────────────────────────

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || sessionStatus.value === 'running' || !chatId.value) return

  // Append user message optimistically with a temporary key
  const userMsg = normalizeEvents([{
    id: tempIdCounter--,
    kind: 'message',
    role: 'user',
    content: text,
    payload: {},
    created_at: new Date().toISOString(),
  }])[0]
  userMsg._key = `t_${userMsg.id}`
  messages.value = [...messages.value, userMsg]
  inputText.value = ''
  sessionStatus.value = 'running'
  receivedCompletedStatus = false
  startTimer()
  scrollToBottom()

  streamController = streamChatMessage(
    props.agent.id,
    chatId.value,
    text,
    (event) => {
      if (event.kind === 'status' && COMPLETED_PATTERNS.some(p => (event.content || '').toLowerCase().includes(p))) {
        receivedCompletedStatus = true
      }
      const normalized = normalizeEvents([{
        id: tempIdCounter--,
        kind: event.kind,
        role: event.role,
        content: event.content,
        payload: event.payload ?? {},
        created_at: new Date().toISOString(),
      }])[0]
      normalized._key = `t_${normalized.id}`
      messages.value = [...messages.value, normalized]
      scrollToBottom()
    },
    () => {
      // Stream done — only stop running if agent sent a completed status event
      if (receivedCompletedStatus) {
        sessionStatus.value = 'idle'
        stopTimer()
      }
      streamController = null
      scrollToBottom()
      nextTick(() => inputRef.value?.focus())
    },
    (err) => {
      console.error('Chat stream error:', err)
      streamController = null
    }
  )
}

// ─── Watchers ─────────────────────────────────────────────────────────────────

watch(
  () => props.agent?.id,
  async (newId) => {
    if (streamController) {
      streamController.abort()
      streamController = null
    }
    chatId.value = null
    sessionStatus.value = 'idle'
    stopTimer()
    stopPolling()
    elapsedSeconds.value = 0
    messages.value = []
    currentAgentId = null

    if (!newId) return
    await loadOrCreateSession(newId)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  // Only abort the in-flight stream; keep the backend session alive for restore
  if (streamController) {
    streamController.abort()
    streamController = null
  }
  stopTimer()
  stopPolling()
})
</script>

<style scoped>
@import '../styles/config-page.css';

.agent-chat-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

/* Header */
.chat-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  background: var(--panel-bg);
}

.chat-panel-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chat-panel-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.chat-title-hint {
  font-size: 11px;
  color: var(--text-muted, var(--text-secondary));
  font-weight: 400;
}

.chat-status-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 600;
}

.chat-status-badge.running {
  background: rgba(251, 191, 36, 0.15);
  color: #d97706;
  border: 1px solid rgba(251, 191, 36, 0.3);
}

.chat-status-badge.idle {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.chat-timer {
  margin-left: 6px;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  font-size: 10px;
  opacity: 0.85;
}

/* Chat body */
.chat-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Empty state */
.chat-empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  text-align: center;
}

.chat-empty-state--inline {
  padding: 16px;
  flex: unset;
  align-items: flex-start;
}

.chat-empty-icon {
  font-size: 36px;
  margin-bottom: 12px;
  opacity: 0.6;
}

.chat-empty-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-secondary);
  margin: 0 0 6px;
}

.chat-empty-hint {
  font-size: 12px;
  color: var(--text-muted, var(--text-secondary));
  margin: 0 0 16px;
  line-height: 1.5;
}

/* User message bubble */
.chat-user-message {
  display: flex;
  justify-content: flex-end;
}

.chat-user-bubble {
  background: var(--accent-color);
  color: white;
  padding: 8px 12px;
  border-radius: 16px 16px 4px 16px;
  font-size: 13px;
  line-height: 1.5;
  max-width: 85%;
  word-break: break-word;
  white-space: pre-wrap;
}

/* Thinking indicator */
.chat-thinking-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 0 4px;
}

.thinking-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent-color);
  animation: thinking-bounce 1.4s infinite ease-in-out;
}

.thinking-dot:nth-child(1) { animation-delay: 0s; }
.thinking-dot:nth-child(2) { animation-delay: 0.2s; }
.thinking-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes thinking-bounce {
  0%, 80%, 100% { transform: scale(0.7); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

.thinking-text {
  font-size: 11px;
  color: var(--text-secondary);
  margin-left: 4px;
}

/* Toolbar */
.chat-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
  flex-shrink: 0;
}

.chat-filter-check {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  user-select: none;
}

.check-box {
  width: 14px;
  height: 14px;
  border: 1.5px solid var(--border-color);
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  transition: all 0.15s;
  flex-shrink: 0;
}

.check-box.checked {
  background: var(--accent-color);
  border-color: var(--accent-color);
}

.check-label {
  font-size: 11px;
  color: var(--text-secondary);
}

/* Input area */
.chat-input-area {
  padding: 10px 12px;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
  background: var(--panel-bg);
}

.chat-input-wrapper {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.chat-input {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.5;
  resize: none;
  transition: border-color 0.2s;
  font-family: inherit;
  min-height: 36px;
  max-height: 100px;
  overflow-y: auto;
}

.chat-input:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px rgba(37, 198, 201, 0.1);
}

.chat-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.chat-send-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: var(--accent-color);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
}

.chat-send-btn:hover:not(:disabled) {
  opacity: 0.85;
}

.chat-send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.send-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.chat-input-hint {
  font-size: 10px;
  color: var(--text-muted, var(--text-secondary));
  margin: 4px 0 0;
  opacity: 0.7;
}
</style>
