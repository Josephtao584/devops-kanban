<template>
  <div class="chat-box" :class="{ collapsed: isCollapsed }">
    <!-- DevTools (only in development) -->
    <DevTools
      v-if="isDev"
      :session="session"
      :ws-connected="isConnected"
      :agent-id="agentId"
    />

    <!-- Header -->
    <div class="chat-header">
      <div class="header-left">
        <span class="header-title">{{ task?.title || 'Agent Chat' }}</span>
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
          v-if="!session && !agentId"
          type="warning"
          size="small"
          :loading="isStarting"
          @click="handleButtonClick"
        >
          <el-icon><VideoPlay /></el-icon> Create
        </el-button>
        <el-button
          v-if="(!session && agentId) || (session && session.status === 'CREATED')"
          type="primary"
          size="small"
          :loading="isStarting"
          @click="handleButtonClick"
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
          v-if="session && session.id"
          type="danger"
          size="small"
          @click="confirmDeleteSession"
        >
          <el-icon><Delete /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- Task summary -->
    <div class="task-summary" v-if="task && task.description && !isCollapsed">
      <div class="task-description">
        <span class="description-label">简介：</span>{{ task.description }}
      </div>
    </div>

    <!-- Messages Area -->
    <div ref="messagesContainer" class="messages-area" v-show="!isCollapsed">
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
    <div class="chat-input-container" v-show="!isCollapsed">
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
import { ElMessage, ElMessageBox } from 'element-plus'
import { Position, VideoPlay, VideoPause, Delete, ChatDotRound, ChatLineRound, ArrowUp, ArrowDown } from '@element-plus/icons-vue'
import DevTools from './DevTools.vue'
import { useSessionManager } from '../composables/useSessionManager'
import { useWebSocketConnection } from '../composables/useWebSocketConnection'
import { useMessageFilter } from '../composables/useMessageFilter'
import { parseOutputToMessages } from '../utils/messageParser'

// Dev mode flag for template
const isDev = import.meta.env.DEV

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

const emit = defineEmits(['session-created', 'session-stopped', 'session-deleted', 'status-change', 'request-agent-select'])

// Use composables
const {
  session,
  isStarting,
  isStopping,
  setSession,
  loadActiveSession: loadSession,
  startSession: startExistingSession,
  stopSession: stopExistingSession,
  continueSession,
  refreshSession
} = useSessionManager()

const {
  isConnected,
  connect: connectWebSocket,
  disconnect: disconnectWebSocket,
  sendInput: wsSendInput,
  isServiceConnected
} = useWebSocketConnection()

const {
  initialPrompt,
  initialPromptFiltered,
  setInitialPrompt,
  shouldFilterContent,
  getContentWithoutInitialPrompt,
  resetFilter
} = useMessageFilter()

// Local state
const messages = ref([])
const inputText = ref('')
const messagesContainer = ref(null)
const isCollapsed = ref(false)

// Waiting state and timer
const isWaitingForResponse = ref(false)
const elapsedSeconds = ref(0)
let waitingTimer = null

// Start waiting timer
const startWaitingTimer = () => {
  isWaitingForResponse.value = true
  elapsedSeconds.value = 0
  if (waitingTimer) clearInterval(waitingTimer)
  waitingTimer = setInterval(() => {
    elapsedSeconds.value++
  }, 1000)
}

// Stop waiting timer
const stopWaitingTimer = () => {
  isWaitingForResponse.value = false
  if (waitingTimer) {
    clearInterval(waitingTimer)
    waitingTimer = null
  }
}

// Format elapsed time
const formatElapsedTime = computed(() => {
  const seconds = elapsedSeconds.value
  if (seconds < 60) return `${seconds}s`
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
  if (isWaitingForResponse.value) return `运行中 ${formatElapsedTime.value}`
  return session.value.status || 'Unknown'
})

// Check if user can send messages
const canSendMessage = computed(() => {
  if (!session.value) return false
  const status = session.value.status
  const claudeSessionId = session.value.claudeSessionId
  if (['RUNNING', 'IDLE'].includes(status)) return true
  if (['STOPPED', 'COMPLETED'].includes(status) && claudeSessionId) return true
  return false
})

// Methods
const formatMessageTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const getMessageRole = (role) => {
  return role === 'user' ? 'You' : 'Assistant'
}

// Unified session initialization function
const initializeSession = async (sessionData, isHistory = false) => {
  console.log('[ChatBox] Initializing session:', sessionData?.id, sessionData?.status, 'isHistory:', isHistory)

  setSession(sessionData)

  // Set initialPrompt BEFORE processing messages
  if (sessionData.initialPrompt) {
    setInitialPrompt(sessionData.initialPrompt)
  } else {
    resetFilter()
  }

  // Process messages (after initialPrompt is set)
  let output = sessionData.output
  // If output is empty and this is a history session, try to fetch it from API
  if ((!output || !output.trim()) && isHistory && sessionData.id) {
    console.log('[ChatBox] Output is empty, fetching from API for session:', sessionData.id)
    try {
      const response = await fetch(`/api/sessions/${sessionData.id}/output`).then(r => r.json())
      if (response.success && response.data) {
        output = response.data
      }
    } catch (e) {
      console.error('[ChatBox] Failed to fetch output from API:', e)
    }
  }

  if (output && output.trim()) {
    const parsedMessages = parseOutputToMessages(output)
    // If loading history session, don't filter messages (they are already complete)
    if (isHistory) {
      initialPromptFiltered.value = true
      messages.value = parsedMessages
    } else {
      messages.value = parsedMessages.filter(msg => !shouldFilterContent(msg.content))
    }

    // Add initialPrompt as user message at the beginning if there are messages
    // Check if already exists to avoid duplicate
    const hasInitialPrompt = messages.value.some(msg =>
      msg.role === 'user' && msg.content === sessionData.initialPrompt
    )
    if (sessionData.initialPrompt && messages.value.length > 0 && !hasInitialPrompt) {
      messages.value.unshift({
        id: `initial-prompt-${sessionData.id}`,
        role: 'user',
        content: sessionData.initialPrompt,
        timestamp: sessionData.startedAt
      })
    }

    scrollToBottom()
  }

  // If session is active, connect WebSocket
  if (['RUNNING', 'IDLE'].includes(sessionData.status)) {
    setupWebSocket(sessionData.id)
  }
}

const loadActiveSession = async () => {
  const sessionData = await loadSession(props.task.id)
  if (sessionData) {
    initializeSession(sessionData)
    return sessionData
  }
  return null
}

const loadLastHistorySession = async () => {
  try {
    const response = await fetch(`/api/sessions/task/${props.task.id}/history?includeOutput=true`)
      .then(r => r.json())
    if (response.success && response.data && response.data.length > 0) {
      // Sort by startedAt descending and get the most recent session
      const sortedSessions = response.data.sort((a, b) => {
        const timeA = new Date(a.startedAt || 0).getTime()
        const timeB = new Date(b.startedAt || 0).getTime()
        return timeB - timeA
      })
      const lastSession = sortedSessions[0]
      initializeSession(lastSession, true) // isHistory = true
    }
  } catch (e) {
    console.error('[ChatBox] Failed to load history session:', e)
  }
}

const createSession = async () => {
  console.log('createSession called, agentId:', props.agentId)
  if (!props.agentId) {
    emit('request-agent-select', props.task)
    return null
  }

  if (session.value) {
    console.log('[ChatBox] Session already exists:', session.value.id)
    return session.value
  }

  try {
    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: props.task.id, agentId: props.agentId })
    }).then(r => r.json())

    if (response.success && response.data) {
      setSession(response.data)
      if (response.data.initialPrompt) {
        setInitialPrompt(response.data.initialPrompt)
      }
      emit('session-created', session.value)
      setupWebSocket(session.value.id)
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

const handleButtonClick = async () => {
  if (!session.value && !props.agentId) {
    // No agent selected, trigger agent selection dialog
    emit('request-agent-select', props.task)
    return
  }
  // No session but has agentId, create and start session
  if (!session.value && props.agentId) {
    const newSession = await createSession()
    if (!newSession) return
  }
  await startSession()
}

const startSession = async () => {
  // If no session but has agentId, create session first
  if (!session.value && props.agentId) {
    const newSession = await createSession()
    if (!newSession) return
  }

  if (isStarting.value) {
    console.warn('Session is already starting')
    return
  }

  isStarting.value = true
  messages.value.push({ id: Date.now(), role: 'system', content: 'Starting session...' })

  try {
    const response = await fetch(`/api/sessions/${session.value.id}/start`, {
      method: 'POST'
    }).then(r => r.json())

    if (response.success && response.data) {
      setSession(response.data)
      emit('status-change', session.value.status)

      if (response.data.initialPrompt) {
        setInitialPrompt(response.data.initialPrompt)
      }

      messages.value = messages.value.filter(m => m.role !== 'system')

      if (response.data.output) {
        const parsedMessages = parseOutputToMessages(response.data.output)
        messages.value = parsedMessages.filter(msg => !shouldFilterContent(msg.content))

        // Add initialPrompt as user message at the beginning if there are messages
        // Check if already exists to avoid duplicate
        const hasInitialPrompt = messages.value.some(msg =>
          msg.role === 'user' && msg.content === response.data.initialPrompt
        )
        if (response.data.initialPrompt && messages.value.length > 0 && !hasInitialPrompt) {
          messages.value.unshift({
            id: `initial-prompt-${response.data.id}`,
            role: 'user',
            content: response.data.initialPrompt,
            timestamp: response.data.startedAt
          })
        }

        scrollToBottom()
      }

      await setupWebSocket(session.value.id)

      if (messages.value.length === 0) {
        messages.value.push({ id: Date.now(), role: 'assistant', content: 'Session started. Waiting for output...' })
      }
    } else {
      messages.value.push({ id: Date.now(), role: 'system', content: 'Error: ' + (response.message || 'Failed to start session') })
      ElMessage.error(response.message || 'Failed to start session')
    }
  } catch (e) {
    console.error('Failed to start session:', e)
    messages.value.push({ id: Date.now(), role: 'system', content: 'Error: ' + (e.response?.data?.message || e.message || 'Failed to start session') })
    ElMessage.error(e.response?.data?.message || e.message || 'Failed to start session')
  } finally {
    isStarting.value = false
  }
}

const stopSession = async () => {
  if (!session.value) return

  const status = session.value.status
  emit('status-change', status)
  emit('session-stopped')

  await stopExistingSession(
    (newStatus) => emit('status-change', newStatus),
    () => emit('session-stopped')
  )
}

const sendMessage = async () => {
  if (!inputText.value.trim() || !session.value) return

  const input = inputText.value.trim()
  inputText.value = ''

  messages.value.push({ id: Date.now(), role: 'user', content: input })
  scrollToBottom()

  startWaitingTimer()

  try {
    const status = session.value.status
    if (['STOPPED', 'COMPLETED'].includes(status) && session.value.claudeSessionId) {
      console.log('Resuming session with claudeSessionId:', session.value.claudeSessionId)
      const success = await continueSession(input, (newStatus) => {
        emit('status-change', newStatus)
      })

      if (success) {
        disconnectWebSocket(session.value.id)
        if (['RUNNING', 'IDLE'].includes(session.value.status)) {
          await setupWebSocket(session.value.id)
        }
      } else {
        stopWaitingTimer()
        ElMessage.error('Failed to continue session')
        inputText.value = input
        messages.value.pop()
      }
    } else if (isConnected.value) {
      wsSendInput(session.value.id, input)
    } else {
      const response = await fetch(`/api/sessions/${session.value.id}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input })
      }).then(r => r.json())

      if (!response.success) {
        stopWaitingTimer()
        ElMessage.error('Failed to send message')
        inputText.value = input
        messages.value.pop()
      }
    }
  } catch (e) {
    stopWaitingTimer()
    console.error('Failed to send message:', e)
    ElMessage.error('Failed to send message')
    inputText.value = input
    messages.value.pop()
  }
}

const confirmDeleteSession = async () => {
  if (!session.value) return

  try {
    await ElMessageBox.confirm(
      '确定要删除当前会话吗？删除后将无法恢复。',
      '删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    // User confirmed, delete the session
    const response = await fetch(`/api/sessions/${session.value.id}`, {
      method: 'DELETE'
    }).then(r => r.json())

    if (response.success) {
      ElMessage.success('会话已删除')
      // Disconnect WebSocket
      disconnectWebSocket(session.value.id)
      // Clear local state
      setSession(null)
      messages.value = []
      resetFilter()
      emit('session-deleted')
    } else {
      ElMessage.error(response.message || '删除失败')
    }
  } catch (e) {
    // User cancelled or error
    if (e !== 'cancel') {
      console.error('Failed to delete session:', e)
      ElMessage.error('删除失败')
    }
  }
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

const setupWebSocket = async (sessionId) => {
  await connectWebSocket(sessionId, {
    onOutput: (data) => {
      console.log('Received output:', data)
      if (data.type === 'chunk') {
        const role = data.stream === 'stdin' ? 'user' : 'assistant'
        if (role !== 'user') {
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
    },
    onStatus: async (data) => {
      if (data.type === 'status' && session.value) {
        session.value.status = data.status
        emit('status-change', data.status)
        if (data.status === 'IDLE') {
          stopWaitingTimer()
        }
      }
      if (data.type === 'claude_session_id' && session.value) {
        // Update claudeSessionId when received from backend
        session.value.claudeSessionId = data.claudeSessionId
        console.log('[ChatBox] Received claudeSessionId:', data.claudeSessionId)
      }
      if (data.type === 'exit') {
        stopWaitingTimer()
        if (session.value) {
          session.value.status = data.status
        }
        emit('status-change', data.status)
        const refreshed = await refreshSession()
        if (refreshed) {
          console.log('Session refreshed, claudeSessionId:', session.value?.claudeSessionId)
        }
      }
    }
  })
}

// Lifecycle
// Note: watch(props.task) handles initialization when task changes,
// so onMounted only needs to handle the case when component is first rendered
// with a task that was already set (not changed)
onMounted(async () => {
  console.log('[ChatBox] onMounted, initialSession:', props.initialSession ? props.initialSession.id : null, 'task:', props.task?.id, 'session:', session.value?.id)
  // If session is already initialized (by watch(props.task)), skip
  if (session.value) {
    console.log('[ChatBox] Session already initialized, skipping onMounted')
    return
  }
  if (props.initialSession) {
    console.log('[ChatBox] Initializing with initialSession:', props.initialSession)
    initializeSession(props.initialSession)
  } else {
    console.log('[ChatBox] No initialSession, loading from server')
    await loadActiveSession()
  }
})

onUnmounted(() => {
  if (session.value) {
    disconnectWebSocket(session.value.id)
  }
  stopWaitingTimer()
})

// Watch for agent changes
watch(() => props.agentId, async (newAgentId, oldAgentId) => {
  console.log('[ChatBox] agentId changed:', oldAgentId, '->', newAgentId)

  if (session.value) {
    console.log('[ChatBox] Session exists, skip creating new session')
    return
  }

  if ((oldAgentId == null || oldAgentId === undefined) && newAgentId != null) {
    console.log('[ChatBox] Agent selected, creating session...')
    await createSession()
    return
  }

  if (oldAgentId && newAgentId !== oldAgentId && session.value) {
    await stopSession()
    setSession(null)
    messages.value = []
    resetFilter()
  }
})

// Watch for initialSession changes from parent
watch(() => props.initialSession, (newSession, oldSession) => {
  if (newSession) {
    if (!oldSession || oldSession.id !== newSession.id || messages.value.length === 0) {
      // initialSession is from parent, treat as history (already complete)
      initializeSession(newSession, true)
    }
  }
}, { deep: true })

// Watch for task changes
watch(() => props.task, async (newTask, oldTask) => {
  console.log('[ChatBox] watch(props.task) triggered:', { oldTaskId: oldTask?.id, newTaskId: newTask?.id, initialSessionId: props.initialSession?.id, sessionId: session.value?.id })
  if (!newTask) {
    // Task cleared
    return
  }
  // Load session when task changes (including first time load when oldTask is null)
  if (!oldTask || newTask.id !== oldTask.id) {
    console.log('[ChatBox] Task changed:', oldTask?.id, '->', newTask.id)
    // Clear old messages
    messages.value = []
    resetFilter()
    // Disconnect WebSocket from old session
    if (session.value) {
      disconnectWebSocket(session.value.id)
      setSession(null)
    }
    // Use initialSession if available, otherwise load from server
    // Note: initialSession may be null initially if parent is still loading,
    // in that case we'll load from server
    if (props.initialSession) {
      console.log('[ChatBox] Using initialSession for task:', props.initialSession.id)
      // initialSession is from parent, treat as history (already complete)
      initializeSession(props.initialSession, true)
    } else {
      console.log('[ChatBox] No initialSession, loading from server')
      // No initialSession, load from server
      const activeSession = await loadActiveSession()
      if (!activeSession) {
        // No active session, load last history session
        console.log('[ChatBox] No active session, loading last history session')
        await loadLastHistorySession()
      }
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
  confirmDeleteSession,
  session
})
</script>

<style scoped>
.chat-box {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-secondary);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.chat-box.collapsed {
  flex: 0 0 auto;
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
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.collapse-btn {
  flex-shrink: 0;
}

.header-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  flex-shrink: 0;
}

.header-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

.claude-session-id {
  font-size: 11px;
  font-family: monospace;
  color: var(--text-muted);
  padding: 2px 6px;
  background: rgba(144, 147, 153, 0.1);
  border-radius: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #9ca3af;
}

.status-running .status-dot {
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
  flex-shrink: 0;
}

.header-actions .el-button {
  font-size: 12px;
  padding: 6px 12px;
}

.task-summary {
  padding: 8px 16px;
  background-color: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
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
  min-height: 0;
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