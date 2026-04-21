<template>
  <div class="agent-chat-panel">
    <!-- Panel header -->
    <div class="chat-panel-header">
      <div class="chat-panel-title-row">
        <span class="chat-panel-title">{{ $t('agent.chatTitle') }}</span>
        <span class="chat-title-hint">{{ $t('agent.chatTitleHint') }}</span>
        <span v-if="sessionStatus === 'running'" class="chat-status-badge running">{{ $t('agent.chatThinking') }}</span>
        <span v-else-if="sessionStatus === 'idle'" class="chat-status-badge idle">{{ $t('agent.chatReady') }}</span>
      </div>
      <button class="btn btn-secondary btn-sm" :disabled="isCreatingSession" @click="startNewSession">
        {{ isCreatingSession ? $t('common.loading') : $t('agent.chatNewSession') }}
      </button>
    </div>

    <!-- Chat body -->
    <div class="chat-body">
      <!-- No session state -->
      <div v-if="!chatId" class="chat-empty-state">
        <div class="chat-empty-icon">💬</div>
        <p class="chat-empty-title">{{ $t('agent.chatNoSession') }}</p>
        <p class="chat-empty-hint">{{ $t('agent.chatNoSessionHint') }}</p>
        <button class="btn btn-primary" :disabled="isCreatingSession" @click="startNewSession">
          {{ isCreatingSession ? $t('common.loading') : $t('agent.chatStart') }}
        </button>
      </div>

      <!-- Messages list -->
      <div v-else ref="messagesContainer" class="chat-messages">
        <div v-if="messages.length === 0 && sessionStatus !== 'running'" class="chat-empty-state chat-empty-state--inline">
          <p class="chat-empty-hint">{{ $t('agent.chatEmptyHint') }}</p>
        </div>

        <template v-for="msg in displayedMessages" :key="msg.id">
          <!-- User message bubble -->
          <div v-if="msg.role === 'user' && msg.kind === 'message'" class="chat-user-message">
            <div class="chat-user-bubble">{{ msg.content }}</div>
          </div>

          <!-- Agent events via SessionEventRenderer -->
          <SessionEventRenderer v-else :event="normalizeMessage(msg)" />
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
      <label class="chat-filter-check" @click.prevent="hideToolMessages = !hideToolMessages">
        <span class="check-box" :class="{ checked: hideToolMessages }">
          <svg v-if="hideToolMessages" width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5l2.5 2.5L8 3" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span class="check-label">{{ $t('agent.chatHideTools') }}</span>
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
import { createChatSession, deleteChatSession, streamChatMessage } from '../api/agentChat.js'

const { t } = useI18n()

const props = defineProps({
  agent: {
    type: Object,
    default: null
  }
})

const chatId = ref(null)
const sessionStatus = ref('idle') // 'idle' | 'running'
const messages = ref([])
const inputText = ref('')
const isCreatingSession = ref(false)
const messagesContainer = ref(null)
const inputRef = ref(null)
const hideToolMessages = ref(true)
let streamController = null
let currentAgentId = null
let msgIdCounter = 0

const displayedMessages = computed(() => {
  if (!hideToolMessages.value) return messages.value
  return messages.value.filter(m => m.kind !== 'tool_call' && m.kind !== 'tool_result')
})

// Normalize stored message into shape expected by SessionEventRenderer
function normalizeMessage(msg) {
  const payload = msg.payload && typeof msg.payload === 'object' ? msg.payload : {}

  let toolName = ''
  if (typeof payload.tool_name === 'string') {
    toolName = payload.tool_name
  } else if (msg.kind === 'tool_call') {
    toolName = msg.content
  }

  const toolCallId = typeof payload.tool_id === 'string' ? payload.tool_id : ''
  const toolInput = Object.prototype.hasOwnProperty.call(payload, 'input') ? payload.input : null
  const toolUseId = typeof payload.tool_use_id === 'string' ? payload.tool_use_id : ''
  const isThinking = payload.block_type === 'thinking'

  // Build tool input preview
  let toolInputPreview = ''
  if (toolInput !== null && toolInput !== undefined && typeof toolInput === 'object') {
    const entries = Object.entries(toolInput).filter(([, v]) => v !== null && v !== undefined && v !== '').slice(0, 3)
    toolInputPreview = entries.map(([k, v]) => `${k}: ${typeof v === 'string' ? v.slice(0, 80) : JSON.stringify(v).slice(0, 80)}`).join('\n')
  }

  return {
    ...msg,
    payload,
    toolName,
    toolCallId,
    toolInput,
    toolInputPreview,
    toolCallCollapsedByDefault: true,
    toolUseId,
    toolIsError: payload.is_error === true,
    isThinking,
    toolResultText: typeof msg.content === 'string' ? msg.content : '',
    toolResultSummary: typeof msg.content === 'string' ? msg.content.slice(0, 280) : '',
    toolResultCollapsedByDefault: msg.kind === 'tool_result' && !!msg.content,
    relatedToolName: '',
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

async function startNewSession() {
  if (!props.agent) return
  if (isCreatingSession.value) return

  // Clean up existing session
  await cleanupSession()

  isCreatingSession.value = true
  try {
    const response = await createChatSession(props.agent.id)
    if (!response?.success) {
      console.error('Failed to start chat session:', response?.message)
      return
    }
    chatId.value = response.data.id
    currentAgentId = props.agent.id
    sessionStatus.value = 'idle'
    messages.value = []
  } catch (err) {
    console.error('Failed to start chat session:', err)
  } finally {
    isCreatingSession.value = false
  }
}

async function cleanupSession() {
  if (streamController) {
    streamController.abort()
    streamController = null
  }
  if (chatId.value && currentAgentId) {
    try {
      await deleteChatSession(currentAgentId, chatId.value)
    } catch { /* noop */ }
  }
  chatId.value = null
  sessionStatus.value = 'idle'
  messages.value = []
  currentAgentId = null
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || sessionStatus.value === 'running' || !chatId.value) return

  // Append user message locally
  const userMsg = {
    id: ++msgIdCounter,
    kind: 'message',
    role: 'user',
    content: text,
    payload: {},
    created_at: new Date().toISOString(),
  }
  messages.value = [...messages.value, userMsg]
  inputText.value = ''
  sessionStatus.value = 'running'
  scrollToBottom()

  streamController = streamChatMessage(
    props.agent.id,
    chatId.value,
    text,
    (event) => {
      // Append streamed event
      const enriched = {
        id: ++msgIdCounter,
        kind: event.kind,
        role: event.role,
        content: event.content,
        payload: event.payload ?? {},
        created_at: new Date().toISOString(),
      }
      messages.value = [...messages.value, enriched]
      scrollToBottom()
    },
    () => {
      // Stream done
      sessionStatus.value = 'idle'
      streamController = null
      scrollToBottom()
      nextTick(() => inputRef.value?.focus())
    },
    (err) => {
      console.error('Chat stream error:', err)
      sessionStatus.value = 'idle'
      streamController = null
    }
  )
}

// Watch for agent changes: auto-start new session when agent is selected
watch(
  () => props.agent?.id,
  async (newId) => {
    if (!newId) {
      await cleanupSession()
      return
    }
    // Only start if agent changes
    if (newId !== currentAgentId) {
      await startNewSession()
    }
  },
  { immediate: true }
)

onBeforeUnmount(async () => {
  await cleanupSession()
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
