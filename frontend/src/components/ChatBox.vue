<template>
  <div class="chat-box">
    <!-- Debug info (temporary) -->
    <div style="padding: 4px 8px; background: #f0f0f0; font-size: 11px; color: #666;">
      Debug: status={{ session?.status }} | canSend={{ canSendMessage }} | claudeId={{ session?.claudeSessionId?.substring(0, 8) || 'none' }}
    </div>
    <!-- Header -->
    <div class="chat-header">
      <div class="header-left">
        <span class="header-title">Agent Chat</span>
        <span class="header-status" :class="statusClass">
          <span class="status-dot"></span>
          {{ statusText }}
        </span>
        <span v-if="session?.claudeSessionId" class="claude-session-id">
          Session: {{ session.claudeSessionId }}
        </span>
      </div>
      <div class="header-actions">
        <el-button
          v-if="!session || session.status === 'CREATED' || session.status === 'STOPPED'"
          type="primary"
          size="small"
          :loading="isStarting"
          @click="startSession"
        >
          <el-icon><VideoPlay /></el-icon> Start
        </el-button>
        <el-button
          v-if="session && (session.status === 'RUNNING' || session.status === 'IDLE')"
          type="danger"
          size="small"
          :loading="isStopping"
          @click="stopSession"
        >
          <el-icon><VideoPause /></el-icon> Stop
        </el-button>
        <el-button
          v-if="session && messages.length > 0"
          size="small"
          @click="clearMessages"
        >
          <el-icon><Delete /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- Task summary -->
    <div class="task-summary" v-if="task && task.description">
      <div class="task-description">
        <span class="description-label">简介：</span>{{ task.description }}
      </div>
    </div>

    <!-- Messages Area -->
    <div ref="messagesContainer" class="messages-area">
      <div v-if="!session" class="chat-empty">
        <div class="empty-icon">
          <el-icon :size="48"><ChatDotRound /></el-icon>
        </div>
        <p class="empty-text">No active session</p>
        <p class="empty-hint">Select an agent and start a session to begin chatting</p>
      </div>
      <div v-else-if="messages.length === 0" class="chat-empty">
        <div class="empty-icon">
          <el-icon :size="48"><ChatLineRound /></el-icon>
        </div>
        <p class="empty-text">Ready to chat</p>
        <p class="empty-hint">Click "Start" to begin the conversation</p>
      </div>
      <div v-else class="messages-list">
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="message"
          :class="`message-${msg.role}`"
        >
          <div class="message-header">
            <span class="message-role">{{ getMessageRole(msg.role) }}</span>
            <span class="message-time">{{ formatMessageTime(msg.timestamp) }}</span>
          </div>
          <div class="message-content">{{ msg.content }}</div>
        </div>
      </div>
    </div>

    <!-- Input Area -->
    <div class="chat-input-container">

      <div class="chat-input-wrapper">
        <el-input
          v-model="inputText"
          type="textarea"
          :rows="1"
          :autosize="{ minRows: 1, maxRows: 4 }"
          placeholder="Type a message... (Enter to send)"
          :disabled="false"
          @keyup.enter.exact="sendMessage"
        />
        <el-button
          type="primary"
          :disabled="!inputText.trim()"
          @click="sendMessage"
        >
          <el-icon><Position /></el-icon>
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Position, VideoPlay, VideoPause, Delete, ChatDotRound, ChatLineRound } from '@element-plus/icons-vue'
import wsService from '../services/websocket'
import sessionApi from '../api/session'
import { createMessage } from '../types/chat'
import { parseOutputToMessages } from '../utils/messageParser'

const props = defineProps({
  task: {
    type: Object,
    required: true
  },
  agentId: {
    type: Number,
    default: null
  },
  initialSession: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['session-created', 'session-stopped', 'status-change', 'request-agent-select'])

// State
const session = ref(null)
const messages = ref([])
const inputText = ref('')
const isStarting = ref(false)
const isStopping = ref(false)
const isConnected = ref(false)
const messagesContainer = ref(null)

// Store initial prompt for filtering
const initialPrompt = ref(null)
const initialPromptFiltered = ref(false)

// Waiting state and timer
const isWaitingForResponse = ref(false)
const waitingStartTime = ref(null)
const elapsedSeconds = ref(0)
let waitingTimer = null

// Start waiting timer
const startWaitingTimer = () => {
  isWaitingForResponse.value = true
  waitingStartTime.value = Date.now()
  elapsedSeconds.value = 0
  if (waitingTimer) clearInterval(waitingTimer)
  waitingTimer = setInterval(() => {
    if (waitingStartTime.value) {
      elapsedSeconds.value = Math.floor((Date.now() - waitingStartTime.value) / 1000)
    }
  }, 1000)
}

// Stop waiting timer
const stopWaitingTimer = () => {
  isWaitingForResponse.value = false
  waitingStartTime.value = null
  if (waitingTimer) {
    clearInterval(waitingTimer)
    waitingTimer = null
  }
}

// Format elapsed time
const formatElapsedTime = computed(() => {
  const seconds = elapsedSeconds.value
  if (seconds < 60) {
    return `${seconds}s`
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
})

// Computed
const statusClass = computed(() => {
  if (!session.value) return 'status-none'
  if (isWaitingForResponse.value) return 'status-running'
  const status = session.value.status?.toLowerCase()
  if (status === 'running') return 'status-running'
  if (status === 'idle') return 'status-idle'
  if (status === 'stopped') return 'status-stopped'
  if (status === 'error') return 'status-error'
  return 'status-created'
})

const statusText = computed(() => {
  if (!session.value) return 'No Session'
  if (isWaitingForResponse.value) {
    return `运行中 ${formatElapsedTime.value}`
  }
  return session.value.status || 'Unknown'
})

// Check if user can send messages
const canSendMessage = computed(() => {
  if (!session.value) {
    console.log('[canSendMessage] No session')
    return false
  }
  const status = session.value.status
  const claudeSessionId = session.value.claudeSessionId
  console.log('[canSendMessage] status:', status, 'claudeSessionId:', claudeSessionId)
  // Can send if running/idle, or if stopped but has claudeSessionId (can resume)
  if (['RUNNING', 'IDLE'].includes(status)) return true
  if (['STOPPED', 'COMPLETED'].includes(status) && claudeSessionId) return true
  console.log('[canSendMessage] returning false')
  return false
})

// Reason why input is disabled
const inputDisabledReason = computed(() => {
  if (!session.value) return 'No active session'
  const status = session.value.status
  if (['RUNNING', 'IDLE'].includes(status)) return ''
  if (['STOPPED', 'COMPLETED'].includes(status) && !session.value.claudeSessionId) {
    return 'Session ended - no resume capability (session ID not found)'
  }
  if (['STOPPED', 'COMPLETED'].includes(status)) {
    return '' // Can resume
  }
  return 'Start the session to send messages'
})

// Task status and priority display
const taskStatusText = computed(() => {
  if (!props.task?.status) return ''
  const statusMap = {
    'TODO': 'To Do',
    'IN_PROGRESS': 'In Progress',
    'IN_REVIEW': 'In Review',
    'DONE': 'Done',
    'BLOCKED': 'Blocked'
  }
  return statusMap[props.task.status] || props.task.status
})

const statusTagType = computed(() => {
  if (!props.task?.status) return 'info'
  const typeMap = {
    'TODO': 'info',
    'IN_PROGRESS': 'warning',
    'IN_REVIEW': '',
    'DONE': 'success',
    'BLOCKED': 'danger'
  }
  return typeMap[props.task.status] || 'info'
})

const taskPriorityText = computed(() => {
  if (!props.task?.priority) return ''
  const priorityMap = {
    'LOW': 'Low',
    'MEDIUM': 'Medium',
    'HIGH': 'High',
    'CRITICAL': 'Critical'
  }
  return priorityMap[props.task.priority] || props.task.priority
})

const priorityTagType = computed(() => {
  if (!props.task?.priority) return 'info'
  const typeMap = {
    'LOW': 'info',
    'MEDIUM': '',
    'HIGH': 'warning',
    'CRITICAL': 'danger'
  }
  return typeMap[props.task.priority] || 'info'
})

// Methods
const formatMessageTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Get display role name for messages
const getMessageRole = (role) => {
  if (role === 'user') return 'You'
  return 'Assistant'
}

// Check if content is the initial prompt (should be filtered out)
const isInitialPrompt = (content) => {
  if (!initialPrompt.value) return false
  if (initialPromptFiltered.value) return false

  const normalizedContent = content.trim()
  const normalizedPrompt = initialPrompt.value.trim()

  // Exact match or content starts with the full prompt
  if (normalizedContent === normalizedPrompt || normalizedContent.startsWith(normalizedPrompt)) {
    return true
  }

  // Check if content starts with the first line of prompt (for chunked messages)
  const promptFirstLine = initialPrompt.value.split('\n')[0]?.trim()
  if (promptFirstLine && normalizedContent.startsWith(promptFirstLine)) {
    return true
  }

  return false
}

// Filter out initial prompt from content (only filter once)
const shouldFilterContent = (content) => {
  if (!isInitialPrompt(content)) return false

  // Mark as filtered after detecting initial prompt
  initialPromptFiltered.value = true
  return true
}

// Get content with initial prompt removed (for partial filtering)
const getContentWithoutInitialPrompt = (content) => {
  if (!initialPrompt.value) return content
  if (!isInitialPrompt(content)) return content

  // Mark as filtered
  initialPromptFiltered.value = true

  const normalizedContent = content.trim()
  const normalizedPrompt = initialPrompt.value.trim()

  // Remove full prompt prefix
  if (normalizedContent.startsWith(normalizedPrompt)) {
    const rest = normalizedContent.slice(normalizedPrompt.length).trim()
    return rest
  }

  // Remove first line prefix (for chunked messages)
  const promptFirstLine = initialPrompt.value.split('\n')[0]?.trim()
  if (promptFirstLine && normalizedContent.startsWith(promptFirstLine)) {
    const rest = normalizedContent.slice(promptFirstLine.length).trim()
    return rest
  }

  return content
}

const loadActiveSession = async () => {
  try {
    const response = await sessionApi.getActiveByTask(props.task.id)
    if (response.success && response.data) {
      session.value = response.data
      if (response.data.initialPrompt) {
        initialPrompt.value = response.data.initialPrompt
      }
      if (response.data.output) {
        messages.value = parseOutputToMessages(response.data.output)
        scrollToBottom()
      }
      if (['RUNNING', 'IDLE'].includes(response.data.status)) {
        connectWebSocket()
      }
    }
  } catch (e) {
    console.error('Failed to load active session:', e)
  }
}

const createSession = async () => {
  console.log('createSession called, agentId:', props.agentId)
  if (!props.agentId) {
    emit('request-agent-select', props.task)
    return null
  }

  try {
    const response = await sessionApi.create(props.task.id, props.agentId)
    if (response.success && response.data) {
      session.value = response.data
      if (response.data.initialPrompt) {
        initialPrompt.value = response.data.initialPrompt
        initialPromptFiltered.value = false
      }
      emit('session-created', session.value)
      connectWebSocket()
      return session.value
    } else {
      ElMessage.error(response.message || 'Failed to create session')
      return null
    }
  } catch (e) {
    console.error('Failed to create session:', e)
    ElMessage.error(e.response?.data?.message || e.message || 'Failed to create session')
    return null
  }
}

const startSession = async () => {
  if (!session.value) {
    session.value = await createSession()
    if (!session.value) return
  }

  if (isStarting.value) {
    console.warn('Session is already starting')
    return
  }

  isStarting.value = true
  messages.value.push(createMessage('system', 'Starting session...'))

  try {
    const response = await sessionApi.start(session.value.id)
    if (response.success && response.data) {
      session.value = response.data
      emit('status-change', session.value.status)

      if (response.data.initialPrompt) {
        initialPrompt.value = response.data.initialPrompt
        initialPromptFiltered.value = false
      }

      messages.value = messages.value.filter(m => m.role !== 'system')

      if (response.data.output) {
        const parsedMessages = parseOutputToMessages(response.data.output)
        messages.value = parsedMessages.filter(msg => !shouldFilterContent(msg.content))
        scrollToBottom()
      }

      await connectWebSocket()

      if (messages.value.length === 0) {
        messages.value.push(createMessage('assistant', 'Session started. Waiting for output...'))
      }
    } else {
      messages.value.push(createMessage('system', 'Error: ' + (response.message || 'Failed to start session')))
      ElMessage.error(response.message || 'Failed to start session')
    }
  } catch (e) {
    console.error('Failed to start session:', e)
    messages.value.push(createMessage('system', 'Error: ' + (e.response?.data?.message || e.message || 'Failed to start session')))
    ElMessage.error(e.response?.data?.message || e.message || 'Failed to start session')
  } finally {
    isStarting.value = false
  }
}

const stopSession = async () => {
  if (!session.value) return

  isStopping.value = true
  try {
    const response = await sessionApi.stop(session.value.id)
    session.value = response.data
    emit('status-change', session.value.status)
    emit('session-stopped')
  } catch (e) {
    console.error('Failed to stop session:', e)
    ElMessage.error('Failed to stop session')
  } finally {
    isStopping.value = false
  }
}

const sendMessage = async () => {
  if (!inputText.value.trim() || !session.value) return

  const input = inputText.value.trim()
  inputText.value = ''

  messages.value.push(createMessage('user', input))
  scrollToBottom()

  // Start waiting timer
  startWaitingTimer()

  try {
    const status = session.value.status
    // If session is stopped/completed but has claudeSessionId, use continue API
    if (['STOPPED', 'COMPLETED'].includes(status) && session.value.claudeSessionId) {
      console.log('Resuming session with claudeSessionId:', session.value.claudeSessionId)
      const response = await sessionApi.continue(session.value.id, input)
      if (response.success && response.data) {
        // Update session data to get new status (RUNNING)
        session.value = response.data
        emit('status-change', session.value.status)
        // Force reconnect WebSocket to receive new output
        disconnectWebSocket()
        if (['RUNNING', 'IDLE'].includes(response.data.status)) {
          await connectWebSocket()
        }
      } else {
        stopWaitingTimer()
        ElMessage.error(response.message || 'Failed to continue session')
        // Restore input on failure
        inputText.value = input
        messages.value.pop()
      }
    } else if (isConnected.value) {
      wsService.sendInput(session.value.id, input)
    } else {
      await sessionApi.sendInput(session.value.id, input)
    }
  } catch (e) {
    stopWaitingTimer()
    console.error('Failed to send message:', e)
    ElMessage.error('Failed to send message')
    // Restore input on error
    inputText.value = input
    messages.value.pop()
  }
}

const clearMessages = () => {
  messages.value = []
  initialPromptFiltered.value = false
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

const connectWebSocket = async () => {
  if (!session.value) return

  if (isConnected.value) {
    console.log('WebSocket already connected for session', session.value.id)
    return
  }

  try {
    // 确保连接建立
    if (!wsService.isConnected()) {
      console.log('[ChatBox] Connecting WebSocket...')
      await wsService.connect()
      // 等待一小段时间确保连接稳定
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // 再次检查连接状态
    if (!wsService.isConnected()) {
      console.warn('[ChatBox] WebSocket not connected after connect()')
      return
    }

    isConnected.value = true
    console.log('[ChatBox] WebSocket connected, subscribing to session', session.value.id)

    wsService.subscribeToOutput(session.value.id, (data) => {
      console.log('Received output:', data)
      if (data.type === 'chunk') {
        const role = data.stream === 'stdin' ? 'user' : 'assistant'
        if (role !== 'user') {
          // Stop waiting timer when receiving response
          stopWaitingTimer()

          if (shouldFilterContent(data.content)) {
            return
          }

          const cleanedContent = getContentWithoutInitialPrompt(data.content)
          if (cleanedContent !== data.content) {
            if (cleanedContent) {
              messages.value.push({
                id: data.timestamp || Date.now(),
                role,
                content: cleanedContent,
                timestamp: data.timestamp
              })
              scrollToBottom()
            }
          } else {
            messages.value.push({
              id: data.timestamp || Date.now(),
              role,
              content: data.content,
              timestamp: data.timestamp
            })
            scrollToBottom()
          }
        }
      }
    })

    wsService.subscribeToStatus(session.value.id, async (data) => {
      if (data.type === 'status' && session.value) {
        session.value.status = data.status
        emit('status-change', data.status)
        // Stop waiting timer when status changes to IDLE
        if (data.status === 'IDLE') {
          stopWaitingTimer()
        }
      }
      if (data.type === 'exit') {
        stopWaitingTimer()
        if (session.value) {
          session.value.status = data.status
        }
        emit('status-change', data.status)
        // Refresh session data to get claudeSessionId for resume capability
        try {
          const response = await sessionApi.getById(session.value.id)
          if (response.success && response.data) {
            // Use Object.assign to ensure reactivity
            Object.assign(session.value, response.data)
            console.log('Session refreshed, claudeSessionId:', session.value.claudeSessionId)
          }
        } catch (e) {
          console.error('Failed to refresh session:', e)
        }
      }
    })
  } catch (e) {
    console.error('Failed to connect WebSocket:', e)
    isConnected.value = false
  }
}

const disconnectWebSocket = () => {
  if (session.value) {
    wsService.unsubscribeFromSession(session.value.id)
  }
}

// Lifecycle
onMounted(() => {
  if (props.initialSession) {
    session.value = props.initialSession
    if (props.initialSession.initialPrompt) {
      initialPrompt.value = props.initialSession.initialPrompt
      initialPromptFiltered.value = false
    }
    if (props.initialSession.output) {
      const parsedMessages = parseOutputToMessages(props.initialSession.output)
      messages.value = parsedMessages.filter(msg => !shouldFilterContent(msg.content))
      scrollToBottom()
    }
    if (['RUNNING', 'IDLE'].includes(props.initialSession.status)) {
      connectWebSocket()
    }
  } else {
    loadActiveSession()
  }
})

onUnmounted(() => {
  disconnectWebSocket()
  stopWaitingTimer()
})

// Watch for agent changes
watch(() => props.agentId, async (newAgentId, oldAgentId) => {
  console.log('[ChatBox] agentId changed:', oldAgentId, '->', newAgentId)
  // If agentId changes from null/undefined to a value, create a session
  if ((oldAgentId == null || oldAgentId === undefined) && newAgentId != null) {
    console.log('[ChatBox] Agent selected, creating session...')
    await createSession()
    return
  }

  // If changing to a different agent and there's an existing session, stop it
  if (oldAgentId && newAgentId !== oldAgentId && session.value) {
    await stopSession()
    session.value = null
    messages.value = []
    initialPrompt.value = null
    initialPromptFiltered.value = false
  }
})

// Watch for initialSession changes from parent
watch(() => props.initialSession, (newSession) => {
  if (newSession) {
    session.value = newSession
    if (newSession.initialPrompt) {
      initialPrompt.value = newSession.initialPrompt
      initialPromptFiltered.value = false
    }
    if (newSession.output && messages.value.length === 0) {
      const parsedMessages = parseOutputToMessages(newSession.output)
      messages.value = parsedMessages.filter(msg => !shouldFilterContent(msg.content))
      scrollToBottom()
    }
    if (['RUNNING', 'IDLE'].includes(newSession.status) && !isConnected.value) {
      connectWebSocket()
    }
  }
}, { deep: true })

// Auto-scroll when messages change
watch(messages, () => {
  scrollToBottom()
}, { deep: true })

// Expose methods for parent component
defineExpose({
  createSession,
  startSession,
  stopSession,
  clearMessages,
  session
})
</script>

<style scoped>
.chat-box {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background-color: var(--bg-secondary);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background-color: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.header-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.claude-session-id {
  font-size: 11px;
  font-family: monospace;
  color: var(--text-muted);
  padding: 2px 6px;
  background: rgba(144, 147, 153, 0.1);
  border-radius: 4px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #9ca3af;
}

.status-running .status-dot {  /* 柔和绿色 */
  background: #86efac;
  animation: pulse 1.5s infinite;
}

.status-idle .status-dot {
  background: #fcd34d;
}

.status-stopped .status-dot {
  background: #6b7280;
}

.status-error .status-dot {
  background: #f87171;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.header-actions {
  display: flex;
  gap: 8px;
}

.header-actions .el-button {
  font-size: 12px;
  padding: 6px 12px;
}

/* Task summary styles */
.task-summary {
  padding: 8px 16px;
  background-color: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
}

.task-summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.task-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-primary);
  flex: 1;
  margin-right: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-meta {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.task-description {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  max-height: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.description-label {
  color: var(--text-muted);
  margin-right: 4px;
}

.messages-area {
  flex: 1;
  min-height: 0;  /* 关键：允许 flex 收缩 */
  overflow-y: auto;
  padding: 12px;
  background-color: var(--bg-secondary);
}

.chat-empty {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  flex: 1;
  min-height: 0;
  color: var(--text-muted);
}

.empty-icon {
  color: var(--text-muted);
  margin-bottom: 16px;
}

.empty-text {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.empty-hint {
  font-size: 13px;
  color: var(--text-muted);
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.message {
  display: flex;
  flex-direction: column;
  max-width: 85%;
}

.message-user {
  align-self: flex-end;
  align-items: flex-end;
}

.message-assistant,
.message-system {
  align-self: flex-start;
  align-items: flex-start;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.message-user .message-header {
  flex-direction: row-reverse;
}

.message-role {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.message-user .message-role {
  color: #2563eb;
}

.message-time {
  font-size: 11px;
  color: var(--text-muted);
}

.message-content {
  padding: 8px 16px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'Segoe UI Emoji', 'Noto Color Emoji', 'Apple Color Emoji', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
}

.message-user .message-content {
  background: #2563eb;
  color: #ffffff;
  border-radius: 12px 12px 4px 12px;
}

.message-assistant .message-content,
.message-system .message-content {
  background-color: var(--message-bg);
  color: var(--text-primary);
  border-radius: 12px 12px 12px 4px;
}

.chat-input-container {
  position: relative;
  border-top: 1px solid var(--border-color);
  background-color: var(--bg-tertiary);
  flex-shrink: 0;
}

.chat-input-wrapper {
  display: flex;
  gap: 8px;
  padding: 10px 16px;
  background-color: var(--bg-tertiary);
}


.chat-input-wrapper .el-textarea {
  flex: 1;
}

.chat-input-wrapper .el-textarea :deep(textarea) {
  resize: none;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  padding: 8px 12px;
  font-size: 14px;
}

.chat-input-wrapper .el-textarea :deep(textarea:focus) {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
}

.chat-input-wrapper .el-button {
  height: auto;
  align-self: flex-end;
  border-radius: 8px;
}

/* Scrollbar styling */
.messages-area::-webkit-scrollbar {
  width: 8px;
}

.messages-area::-webkit-scrollbar-track {
  background: transparent;
}

.messages-area::-webkit-scrollbar-thumb {
  background-color: var(--border-color);
  border-radius: 4px;
}

.messages-area::-webkit-scrollbar-thumb:hover {
  background-color: var(--scrollbar-thumb);
}
</style>
