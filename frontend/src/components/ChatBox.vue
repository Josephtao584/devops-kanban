<template>
  <div class="chat-box" :class="{ collapsed: isCollapsed }">
    <!-- DevTools (only in development) -->
    <DevTools
      v-if="isDev"
      :session="session"
      :ws-connected="isConnected"
      :agent-id="agentId"
    />

    <!-- Header using extracted component -->
    <SessionHeader
      :title="task?.title || 'Agent Chat'"
      :status="sessionStatus"
      :status-text="statusText"
      :session-id="session?.claudeSessionId"
      :worktree-path="effectiveWorktreePath"
    >
      <template #actions>
        <!-- Thinking toggle switch -->
        <div class="thinking-toggle" :title="showThinking ? $t('chat.hideThinking', 'Hide thinking') : $t('chat.showThinking', 'Show thinking')">
          <span class="thinking-toggle-label">{{ $t('chat.thinking', 'Thinking') }}</span>
          <el-switch
            v-model="showThinking"
            size="small"
            :active-icon="Cpu"
            :inactive-icon="Hide"
          />
        </div>
        <SessionControls
          :status="session?.status"
          :has-agent="!!agentId"
          :has-session="!!session"
          :loading="isStarting || isStopping"
          @create="handleButtonClick"
          @start="handleButtonClick"
          @stop="stopSession"
          @delete="confirmDeleteSession"
        />
      </template>
    </SessionHeader>

    <!-- Task summary -->
    <div class="task-summary" v-if="task && task.description && !isCollapsed">
      <div class="task-description">
        <span class="description-label">{{ $t('chat.taskSummary', '简介：') }}</span>{{ task.description }}
      </div>
    </div>

    <!-- Messages Area using extracted component -->
    <MessageList
      ref="messageListRef"
      :messages="filteredMessages"
      :has-session="!!session"
      :show-thinking="showThinking"
      :empty-title="$t('chat.noSession', 'No active session')"
      :empty-hint="$t('chat.noSessionHint', 'Select an agent and start a session to begin')"
      :ready-title="$t('chat.readyTitle', 'Ready to chat')"
      :ready-hint="$t('chat.readyHint', 'Click Start to begin')"
    />

    <!-- Input Area using extracted component -->
    <MessageInput
      v-show="!isCollapsed"
      v-model="inputText"
      :placeholder="$t('chat.inputPlaceholder', 'Type a message... (Enter to send)')"
      @send="sendMessage"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Cpu, Hide } from '@element-plus/icons-vue'
import DevTools from './DevTools.vue'
import SessionHeader from './session/SessionHeader.vue'
import SessionControls from './session/SessionControls.vue'
import MessageList from './session/MessageList.vue'
import MessageInput from './session/MessageInput.vue'
import { useSessionManager } from '../composables/useSessionManager'
import { useWebSocketConnection } from '../composables/useWebSocketConnection'
import { useMessageFilter } from '../composables/useMessageFilter'
import { parseOutputToMessages } from '../utils/messageParser'

// Dev mode flag for template
const isDev = import.meta.env.DEV
const { t } = useI18n()

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
const messageListRef = ref(null)
const isCollapsed = ref(false)
const showThinking = ref(true)  // Toggle for showing thinking messages

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

// Computed status for header
const sessionStatus = computed(() => {
  if (isWaitingForResponse.value) return 'RUNNING'
  return session.value?.status || ''
})

const statusText = computed(() => {
  if (!session.value) return t('session.status.none', 'No Session')
  if (isWaitingForResponse.value) return `${t('session.status.running', 'Running')} ${formatElapsedTime.value}`
  return t(`session.status.${session.value.status?.toLowerCase()}`, session.value.status || 'Unknown')
})

// Get worktree from task first (persistent), fall back to session
const effectiveWorktreePath = computed(() => {
  return props.task?.worktreePath || session.value?.worktreePath || ''
})

// Filter messages based on showThinking toggle
const filteredMessages = computed(() => {
  if (showThinking.value) {
    return messages.value
  }
  // Filter out thinking messages, but always show tool messages and permission denials
  return messages.value.filter(msg =>
    msg.contentType !== 'thinking'
  )
})

// Unified session initialization function
const initializeSession = async (sessionData, isHistory = false) => {
  console.log('[ChatBox] Initializing session:', sessionData?.id, sessionData?.status, 'isHistory:', isHistory)

  // Reset streaming state
  streamingMessages.value = {}

  setSession(sessionData)

  // Set initialPrompt BEFORE processing messages
  if (sessionData.initialPrompt) {
    setInitialPrompt(sessionData.initialPrompt)
  } else {
    resetFilter()
  }

  // Priority: Use messages field if available (structured chat history)
  if (sessionData.messages && Array.isArray(sessionData.messages) && sessionData.messages.length > 0) {
    console.log('[ChatBox] Using structured messages from backend, count:', sessionData.messages.length)
    messages.value = sessionData.messages
      .map(msg => ({
        id: msg.id || `msg-${Date.now()}-${Math.random()}`,
        role: msg.role,
        content: msg.content,
        contentType: msg.contentType,  // Preserve contentType for thinking/tool messages
        timestamp: msg.timestamp,
        // Tool fields (if present)
        toolCallId: msg.toolCallId,
        toolName: msg.toolName,
        toolInput: msg.toolInput,
        toolUseId: msg.toolUseId,
        toolIsError: msg.toolIsError,
        // Permission denial fields (if present)
        resource: msg.resource,
        reason: msg.reason
      }))
      .sort((a, b) => {
        // Sort by timestamp ascending (oldest first)
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0
        return timeA - timeB
      })
    scrollToBottom()
  } else {
    // Fallback: Parse output field (legacy behavior)
    let output = sessionData.output
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
      if (isHistory) {
        initialPromptFiltered.value = true
        messages.value = parsedMessages
      } else {
        messages.value = parsedMessages.filter(msg => !shouldFilterContent(msg.content))
      }

      // Handle initialPrompt
      if (sessionData.initialPrompt) {
        const initialPromptContent = sessionData.initialPrompt
        const hasUserInitialPrompt = messages.value.some(msg =>
          msg.role === 'user' && msg.content === initialPromptContent
        )

        if (!hasUserInitialPrompt) {
          const assistantMsgIndex = messages.value.findIndex(msg =>
            msg.role === 'assistant' && msg.content === initialPromptContent
          )

          if (assistantMsgIndex !== -1) {
            messages.value[assistantMsgIndex].role = 'user'
            messages.value[assistantMsgIndex].id = `initial-prompt-${sessionData.id}`
          } else {
            messages.value.unshift({
              id: `initial-prompt-${sessionData.id}`,
              role: 'user',
              content: initialPromptContent,
              timestamp: sessionData.startedAt
            })
          }
        }
      }

      scrollToBottom()
    }

    // Handle initialPrompt for sessions with empty output
    if (sessionData.initialPrompt &&
        messages.value.length === 0 &&
        sessionData.status !== 'CREATED') {
      messages.value.push({
        id: `initial-prompt-${sessionData.id}`,
        role: 'user',
        content: sessionData.initialPrompt,
        timestamp: sessionData.startedAt || new Date().toISOString()
      })
      scrollToBottom()
    }
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
    // Load session with messages but not raw output
    const response = await fetch(`/api/sessions/task/${props.task.id}/history?includeOutput=false`)
      .then(r => r.json())
    if (response.success && response.data && response.data.length > 0) {
      const sortedSessions = response.data.sort((a, b) => {
        const timeA = new Date(a.startedAt || 0).getTime()
        const timeB = new Date(b.startedAt || 0).getTime()
        return timeB - timeA
      })
      const lastSession = sortedSessions[0]
      console.log('[ChatBox] Loaded last history session:', lastSession?.id, 'worktree:', lastSession?.worktreePath)
      initializeSession(lastSession, true)
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
    emit('request-agent-select', props.task)
    return
  }

  if (isStarting.value) {
    console.warn('Session is already starting')
    return
  }
  isStarting.value = true

  try {
    if (!session.value && props.agentId) {
      const newSession = await createSession()
      if (!newSession) {
        isStarting.value = false
        return
      }
    }
    await startSession()
  } catch (e) {
    console.error('handleButtonClick error:', e)
    isStarting.value = false
  }
}

const startSession = async () => {
  if (!session.value && props.agentId) {
    const newSession = await createSession()
    if (!newSession) return
  }

  if (!isStarting.value) {
    isStarting.value = true
  }

  messages.value.push({ id: Date.now(), role: 'system', content: 'Starting session...' })

  if (session.value.initialPrompt) {
    const existingMsg = messages.value.find(m => m.id === `initial-prompt-${session.value.id}`)
    if (!existingMsg) {
      messages.value.push({
        id: `initial-prompt-${session.value.id}`,
        role: 'user',
        content: session.value.initialPrompt,
        timestamp: new Date().toISOString()
      })
    }
    setInitialPrompt(session.value.initialPrompt)
  }

  startWaitingTimer()

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
        const assistantMessages = parsedMessages.filter(msg =>
          msg.role === 'assistant' && !shouldFilterContent(msg.content)
        )
        messages.value.push(...assistantMessages)
        scrollToBottom()
      }

      await setupWebSocket(session.value.id)
    } else {
      stopWaitingTimer()
      messages.value.push({ id: Date.now(), role: 'system', content: 'Error: ' + (response.message || 'Failed to start session') })
      ElMessage.error(response.message || 'Failed to start session')
    }
  } catch (e) {
    stopWaitingTimer()
    console.error('Failed to start session:', e)
    messages.value.push({ id: Date.now(), role: 'system', content: 'Error: ' + (e.response?.data?.message || e.message || 'Failed to start session') })
    ElMessage.error(e.response?.data?.message || e.message || 'Failed to start session')
  } finally {
    isStarting.value = false
  }
}

const stopSession = async () => {
  if (!session.value) return

  emit('status-change', session.value.status)
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

  messages.value.push({
    id: Date.now(),
    role: 'user',
    content: input,
    timestamp: new Date().toISOString()
  })
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
      t('session.deleteConfirm', '确定要删除当前会话吗？删除后将无法恢复。'),
      t('common.confirm', '删除确认'),
      {
        confirmButtonText: t('common.delete', '删除'),
        cancelButtonText: t('common.cancel', '取消'),
        type: 'warning'
      }
    )

    const response = await fetch(`/api/sessions/${session.value.id}`, {
      method: 'DELETE'
    }).then(r => r.json())

    if (response.success) {
      ElMessage.success(t('messages.deleted', { name: t('session.title', '会话') }))
      disconnectWebSocket(session.value.id)
      setSession(null)
      messages.value = []
      streamingMessages.value = {}
      resetFilter()
      emit('session-deleted')
    } else {
      ElMessage.error(response.message || t('messages.deleteFailed', { name: t('session.title') }))
    }
  } catch (e) {
    if (e !== 'cancel') {
      console.error('Failed to delete session:', e)
      ElMessage.error(t('messages.deleteFailed', { name: t('session.title') }))
    }
  }
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollToBottom()
    }
  })
}

// Handle streaming chunks with content type differentiation
const streamingMessages = ref({})  // Track streaming messages by block key

const handleStreamingChunk = (data) => {
  const { contentType, content, blockIndex } = data

  if (contentType === 'thinking') {
    // For thinking content, append to or create a thinking message
    const blockKey = `thinking-${blockIndex}`
    const existingMsg = streamingMessages.value[blockKey]

    if (existingMsg) {
      // Append to existing thinking message
      const msgIndex = messages.value.findIndex(m => m.id === existingMsg.id)
      if (msgIndex !== -1) {
        messages.value[msgIndex].content += content
      }
    } else {
      // Create new thinking message
      const newMsg = {
        id: `${blockKey}-${Date.now()}`,
        role: 'assistant',
        content: content,
        contentType: 'thinking',
        timestamp: data.timestamp || new Date().toISOString()
      }
      messages.value.push(newMsg)
      streamingMessages.value[blockKey] = { id: newMsg.id }
    }
  } else if (contentType === 'text') {
    // For text content, append to the main assistant message
    const blockKey = `text-${blockIndex}`
    const existingMsg = streamingMessages.value[blockKey]

    stopWaitingTimer()

    if (shouldFilterContent(content)) {
      return
    }

    const cleanedContent = getContentWithoutInitialPrompt(content)

    if (existingMsg) {
      // Append to existing text message
      const msgIndex = messages.value.findIndex(m => m.id === existingMsg.id)
      if (msgIndex !== -1) {
        messages.value[msgIndex].content += cleanedContent || content
      }
    } else {
      // Create new text message
      const newMsg = {
        id: `${blockKey}-${Date.now()}`,
        role: 'assistant',
        content: cleanedContent || content,
        contentType: 'text',
        timestamp: data.timestamp || new Date().toISOString()
      }
      messages.value.push(newMsg)
      streamingMessages.value[blockKey] = { id: newMsg.id }
    }
  }

  scrollToBottom()
}

// Handle tool_use event from backend
const handleToolUse = (data) => {
  const { toolCallId, toolName, toolInput, blockIndex, timestamp } = data

  const newMsg = {
    id: `tool-use-${toolCallId || Date.now()}`,
    role: 'assistant',
    content: '',
    contentType: 'tool_use',
    toolCallId,
    toolName,
    toolInput: toolInput || {},
    timestamp: timestamp || new Date().toISOString()
  }
  messages.value.push(newMsg)

  // Track for potential updates
  const blockKey = `tool-use-${blockIndex || toolCallId}`
  streamingMessages.value[blockKey] = { id: newMsg.id, toolCallId }

  scrollToBottom()
}

// Handle tool_result event from backend
const handleToolResult = (data) => {
  const { toolUseId, content, isError, timestamp } = data

  // Find the corresponding tool_use message to link the result
  let linkedToolCallId = toolUseId
  for (const [key, value] of Object.entries(streamingMessages.value)) {
    if (value.toolCallId === toolUseId) {
      linkedToolCallId = value.toolCallId
      break
    }
  }

  const newMsg = {
    id: `tool-result-${toolUseId || Date.now()}`,
    role: 'user',
    content: content || '',
    contentType: 'tool_result',
    toolUseId: linkedToolCallId,
    toolIsError: isError || false,
    timestamp: timestamp || new Date().toISOString()
  }
  messages.value.push(newMsg)

  scrollToBottom()
}

// Handle permission_denial event from backend
const handlePermissionDenial = (data) => {
  const { resource, reason, timestamp } = data

  const newMsg = {
    id: `permission-${Date.now()}`,
    role: 'system',
    content: resource || '',
    contentType: 'permission_denied',
    resource,
    reason,
    timestamp: timestamp || new Date().toISOString()
  }
  messages.value.push(newMsg)

  stopWaitingTimer()
  scrollToBottom()
}

const setupWebSocket = async (sessionId) => {
  await connectWebSocket(sessionId, {
    onOutput: (data) => {
      // Handle message_start: clear streaming state for new messages in multi-turn conversations
      if (data.type === 'message_start') {
        streamingMessages.value = {}
        return
      }

      // Handle tool_use event
      if (data.type === 'tool_use') {
        handleToolUse(data)
        return
      }

      // Handle tool_result event
      if (data.type === 'tool_result') {
        handleToolResult(data)
        return
      }

      // Handle permission_denial event
      if (data.type === 'permission_denial') {
        handlePermissionDenial(data)
        return
      }

      console.log('Received output:', data)
      if (data.type === 'chunk') {
        // Check if this is streaming with contentType
        if (data.contentType) {
          handleStreamingChunk(data)
          return
        }

        // Legacy handling for non-streaming chunks
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
onMounted(async () => {
  console.log('[ChatBox] onMounted, initialSession:', props.initialSession?.id, 'task:', props.task?.id)
  if (session.value) {
    console.log('[ChatBox] Session already initialized, skipping')
    return
  }
  if (props.initialSession) {
    initializeSession(props.initialSession)
  } else {
    const activeSession = await loadActiveSession()
    if (!activeSession) {
      await loadLastHistorySession()
    }
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

  if (session.value) return

  if ((oldAgentId == null || oldAgentId === undefined) && newAgentId != null) {
    console.log('[ChatBox] Agent selected, creating session...')
    await createSession()
    return
  }

  if (oldAgentId && newAgentId !== oldAgentId && session.value) {
    await stopSession()
    setSession(null)
    messages.value = []
    streamingMessages.value = {}
    resetFilter()
  }
})

// Watch for initialSession changes
watch(() => props.initialSession, (newSession, oldSession) => {
  if (newSession) {
    if (!oldSession || oldSession.id !== newSession.id || messages.value.length === 0) {
      initializeSession(newSession, true)
    }
  }
}, { deep: true })

// Watch for task changes
watch(() => props.task, async (newTask, oldTask) => {
  console.log('[ChatBox] watch(props.task):', oldTask?.id, '->', newTask?.id)
  if (!newTask) return

  if (!oldTask || newTask.id !== oldTask.id) {
    messages.value = []
    streamingMessages.value = {}
    resetFilter()
    if (session.value) {
      disconnectWebSocket(session.value.id)
      setSession(null)
    }

    if (props.initialSession) {
      initializeSession(props.initialSession, true)
    } else {
      const activeSession = await loadActiveSession()
      if (!activeSession) {
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

.thinking-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.thinking-toggle-label {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}
</style>
