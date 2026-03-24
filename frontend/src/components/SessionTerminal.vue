<template>
  <div class="session-terminal">
    <!-- Header with status -->
    <div class="terminal-header">
      <div class="status-indicator">
        <span
          class="status-dot"
          :class="statusClass"
        ></span>
        <span class="status-text">{{ statusText }}</span>
        <span v-if="session?.branch" class="branch-info">
          <Folder />
          {{ session.branch }}
        </span>
        <span v-if="session?.claudeSessionId" class="claude-session-id">
          <Key />
          <span class="id-text">{{ session.claudeSessionId }}</span>
        </span>
      </div>
      <div class="control-buttons">
        <el-button
          v-if="!session || session.status === 'CREATED' || session.status === 'STOPPED'"
          type="success"
          size="small"
          :loading="isStarting"
          :disabled="!session"
          @click="startSession"
        >
          Start
        </el-button>
        <el-button
          v-if="session && (session.status === 'RUNNING' || session.status === 'IDLE')"
          type="danger"
          size="small"
          :loading="isStopping"
          @click="stopSession"
        >
          Stop
        </el-button>
        <el-button
          v-if="session && session.status === 'STOPPED'"
          type="primary"
          size="small"
          :loading="isContinuing"
          @click="continueSession"
        >
          Continue
        </el-button>
        <el-button
          v-if="session"
          type="info"
          size="small"
          :disabled="session.status === 'RUNNING' || session.status === 'IDLE'"
          @click="clearOutput"
        >
          Clear
        </el-button>
      </div>
    </div>

    <!-- Task summary -->
    <div class="task-summary" v-if="task">
      <div class="task-summary-header">
        <span class="task-title">{{ task.title }}</span>
        <div class="task-meta">
          <el-tag :type="statusTagType" size="small">{{ taskStatusText }}</el-tag>
          <el-tag :type="priorityTagType" size="small">{{ taskPriorityText }}</el-tag>
        </div>
      </div>
      <div class="task-description" v-if="task.description">
        {{ task.description }}
      </div>
    </div>

    <!-- Terminal output -->
    <div ref="outputContainer" class="terminal-output">
      <div v-if="!session" class="terminal-placeholder">
        <el-empty description="No active session" :image-size="60">
          <template #description>
            <p>Select an agent and create a session to start</p>
          </template>
        </el-empty>
      </div>
      <div v-else-if="outputLines.length === 0" class="terminal-placeholder">
        <p>实时输出已迁移到 workflow step 会话面板；这里暂不展示历史输出。</p>
      </div>
      <div v-else>
        <div
          v-for="(line, index) in outputLines"
          :key="index"
          class="output-line"
          :class="line.stream"
        >
          <span v-if="line.stream === 'stdin'" class="prompt">$ </span>
          <span class="line-content">{{ line.data }}</span>
        </div>
      </div>
    </div>

    <!-- Input area -->
    <div class="terminal-input" v-if="session && (session.status === 'RUNNING' || session.status === 'IDLE')">
      <el-input
        v-model="inputText"
        placeholder="Type your message and press Enter..."
        :disabled="!isConnected"
        @keyup.enter="sendInput"
      >
        <template #prefix>
          <span class="input-prompt">&gt;</span>
        </template>
        <template #append>
          <el-button :disabled="!inputText.trim()" @click="sendInput">
            Send
          </el-button>
        </template>
      </el-input>
    </div>

    <!-- Input area for stopped session (Continue mode) -->
    <div class="terminal-input continue-mode" v-if="session && session.status === 'STOPPED'">
      <el-input
        v-model="inputText"
        placeholder="Type a message to continue the session with --resume..."
        @keyup.enter="continueSession"
      >
        <template #prefix>
          <span class="input-prompt">&gt;</span>
        </template>
        <template #append>
          <el-button type="primary" :disabled="!inputText.trim()" @click="continueSession">
            Continue
          </el-button>
        </template>
      </el-input>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Folder, Key } from '@element-plus/icons-vue'
import { useSessionManager } from '../composables/useSessionManager'
import { useWebSocketConnection } from '../composables/useWebSocketConnection'
import { useMessageFilter } from '../composables/useMessageFilter'
import { getActiveSessionByTask } from '../api/session'

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

const emit = defineEmits(['session-created', 'session-stopped', 'status-change'])

// Use composables for state management
const {
  session,
  isStarting,
  isStopping,
  createSession,
  startSession: startSessionAction,
  stopSession: stopSessionAction,
  continueSession: continueSessionAction,
  setSession,
  clearSession
} = useSessionManager()

const {
  isConnected,
  connect,
  disconnect,
  sendInput: sendWsInput
} = useWebSocketConnection()

const {
  initialPrompt,
  setInitialPrompt,
  shouldFilterContent,
  resetFilter
} = useMessageFilter()

// Local state
const outputLines = ref([])
const inputText = ref('')
const isContinuing = ref(false)
const outputContainer = ref(null)

// Computed
const statusClass = computed(() => {
  if (!session.value) return 'status-none'
  const status = session.value.status?.toLowerCase()
  if (status === 'running') return 'status-running'
  if (status === 'idle') return 'status-idle'
  if (status === 'stopped') return 'status-stopped'
  if (status === 'error') return 'status-error'
  return 'status-created'
})

const statusText = computed(() => {
  if (!session.value) return 'No Session'
  return session.value.status || 'Unknown'
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

// Add output line with filtering using composable
const addOutputLine = (data, stream, timestamp) => {
  const lines = data.split('\n')
  lines.forEach(line => {
    if (line.trim() && !shouldFilterContent(line)) {
      outputLines.value.push({
        data: line,
        stream,
        timestamp
      })
    }
  })
}

// Methods
const loadActiveSession = async () => {
  try {
    const response = await getActiveSessionByTask(props.task.id)
    console.log('Load active session response:', response)
    if (response.success && response.data) {
      setSession(response.data)
      // Store initial prompt for filtering
      if (response.data.initialPrompt) {
        setInitialPrompt(response.data.initialPrompt)
        console.log('Initial prompt set for filtering:', initialPrompt.value.substring(0, 50) + '...')
      }
      // Connect WebSocket if session is running
      if (['RUNNING', 'IDLE'].includes(response.data.status)) {
        connectWebSocket()
      }
    }
  } catch (e) {
    console.error('Failed to load active session:', e)
  }
}

const createSessionAndStart = async () => {
  if (!props.agentId) {
    ElMessage.warning('Please select an agent first')
    return null
  }

  const createdSession = await createSession(props.task.id, props.agentId)
  if (createdSession) {
    emit('session-created', createdSession)
    connectWebSocket()
  }
  return createdSession
}

const startSession = async () => {
  if (!session.value) {
    session.value = await createSessionAndStart()
    if (!session.value) return
  }

  // Use composable's startSession with callback
  const started = await startSessionAction((status) => {
    emit('status-change', status)
  })

  if (started) {
    // Refresh initial prompt from session
    if (session.value.initialPrompt) {
      setInitialPrompt(session.value.initialPrompt)
    }

    // Connect WebSocket after session starts
    await connectWebSocket()

    // If no output yet, show waiting message
    if (outputLines.value.length === 0) {
      outputLines.value.push({
        data: 'Session started. Waiting for output...',
        stream: 'stdout',
        timestamp: Date.now()
      })
    }
  } else {
    outputLines.value.push({
      data: 'Error: Failed to start session',
      stream: 'stderr',
      timestamp: Date.now()
    })
  }
}

const stopSession = async () => {
  if (!session.value) return

  const stopped = await stopSessionAction(
    (status) => emit('status-change', status),
    () => emit('session-stopped')
  )

  if (!stopped) {
    ElMessage.error('Failed to stop session')
  }
}


const continueSession = async () => {
  if (!inputText.value.trim() || !session.value) return

  const input = inputText.value.trim()
  inputText.value = ''

  isContinuing.value = true
  outputLines.value.push({
    data: 'Continuing session...',
    stream: 'stdout',
    timestamp: Date.now()
  })

  const continued = await continueSessionAction(input, (status) => {
    emit('status-change', status)
  })

  if (continued) {
    outputLines.value.push({
      data: '--- Session resumed ---',
      stream: 'stdout',
      timestamp: Date.now()
    })
    await connectWebSocket()
  } else {
    outputLines.value.push({
      data: 'Error: Failed to continue session',
      stream: 'stderr',
      timestamp: Date.now()
    })
  }

  isContinuing.value = false
}
const sendInput = async () => {
  if (!inputText.value.trim() || !session.value) return

  const input = inputText.value.trim()
  inputText.value = ''

  // Try WebSocket first
  if (isConnected.value) {
    sendWsInput(session.value.id, input)
  } else {
    // Fallback - send via API would need to be added here if needed
    ElMessage.warning('Not connected, input may not work')
  }
}

const clearOutput = () => {
  outputLines.value = []
  resetFilter()
}

const scrollToBottom = () => {
  nextTick(() => {
    if (outputContainer.value) {
      outputContainer.value.scrollTop = outputContainer.value.scrollHeight
    }
  })
}

const connectWebSocket = async () => {
  if (!session.value) return

  // Prevent duplicate connection
  if (isConnected.value) {
    console.log('WebSocket already connected for session', session.value.id)
    return
  }

  const connected = await connect(session.value.id, {
    onOutput: (data) => {
      console.log('Received output:', data)
      if (data.type === 'chunk') {
        addOutputLine(data.content, data.stream, data.timestamp)
        scrollToBottom()
      }
    },
    onStatus: (data) => {
      console.log('Received status:', data)
      if (data.type === 'status' && session.value) {
        // Only update RUNNING and IDLE states to keep input area visible
        if (['RUNNING', 'IDLE'].includes(data.status)) {
          session.value.status = data.status
          emit('status-change', data.status)
        }
      }
      if (data.type === 'exit') {
        if (session.value && data.exitCode !== undefined) {
          session.value.status = data.status
          emit('status-change', data.status)
        }
      }
    }
  })

  if (!connected) {
    console.warn('WebSocket connection failed')
  }
}

const disconnectWebSocket = () => {
  if (session.value) {
    disconnect(session.value.id)
  }
}

// Lifecycle
onMounted(() => {
  // Use initialSession from parent if provided, otherwise load from API
  if (props.initialSession) {
    setSession(props.initialSession)
    // Store initial prompt for filtering
    if (props.initialSession.initialPrompt) {
      setInitialPrompt(props.initialSession.initialPrompt)
    }
    // Connect WebSocket if session is running
    if (['RUNNING', 'IDLE'].includes(props.initialSession.status)) {
      connectWebSocket()
    }
  } else {
    loadActiveSession()
  }
})

onUnmounted(() => {
  disconnectWebSocket()
})

// Watch for agent changes
watch(() => props.agentId, async (newAgentId, oldAgentId) => {
  if (oldAgentId && newAgentId !== oldAgentId && session.value) {
    // Agent changed, stop current session
    await stopSession()
    clearSession()
    outputLines.value = []
    resetFilter()
  }
})

// Watch for initialSession changes from parent
watch(() => props.initialSession, (newSession) => {
  if (newSession) {
    setSession(newSession)
    // Store initial prompt for filtering
    if (newSession.initialPrompt) {
      setInitialPrompt(newSession.initialPrompt)
    }
    // Connect WebSocket if session is running and not already connected
    if (['RUNNING', 'IDLE'].includes(newSession.status) && !isConnected.value) {
      connectWebSocket()
    }
  }
}, { deep: true })

// Auto-scroll when output changes
watch(outputLines, () => {
  scrollToBottom()
}, { deep: true })

// Expose methods for parent component
defineExpose({
  createSession: createSessionAndStart,
  startSession,
  stopSession,
  continueSession,
  clearOutput,
  session
})
</script>

<style scoped>
.session-terminal {
  display: flex;
  flex-direction: column;
  height: 400px;
  background-color: var(--bg-secondary);
  border-radius: 8px;
  overflow: hidden;
}

.terminal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.status-none { background: #666; }
.status-created { background: #409eff; }
.status-running { background: #86efac; animation: pulse 1s infinite; }
.status-idle { background: #fcd34d; }
.status-stopped { background: #909399; }
.status-error { background: #f87171; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.status-text {
  color: var(--text-secondary);
  font-size: 12px;
  font-family: monospace;
}

.branch-info {
  color: #67c23a;
  font-size: 11px;
  font-family: monospace;
  margin-left: 12px;
  padding: 2px 6px;
  background: rgba(103, 194, 58, 0.1);
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.branch-info :deep(.el-icon) {
  font-size: 12px;
}

.claude-session-id {
  color: #909399;
  font-size: 11px;
  font-family: monospace;
  margin-left: 12px;
  padding: 2px 6px;
  background: rgba(144, 147, 153, 0.1);
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.claude-session-id :deep(.el-icon) {
  font-size: 12px;
}

.control-buttons {
  display: flex;
  gap: 8px;
}

/* Task summary styles */
.task-summary {
  padding: 10px 12px;
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

.terminal-output {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.5;
}

.terminal-placeholder {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: var(--text-muted);
}

.terminal-placeholder :deep(.el-empty__description p) {
  color: var(--text-muted);
}

.output-line {
  margin-bottom: 2px;
  word-break: break-all;
}

.output-line.stdout {
  color: var(--text-primary);
}

.output-line.stderr {
  color: #f56c6c;
}

.output-line.stdin {
  color: #67c23a;
}

.history-indicator {
  color: var(--text-secondary);
  font-style: italic;
  margin-bottom: 8px;
  padding: 4px 8px;
  background: rgba(144, 147, 153, 0.1);
  border-radius: 4px;
}

.prompt {
  color: #409eff;
  margin-right: 4px;
}

.line-content {
  white-space: pre-wrap;
}

.terminal-input {
  padding: 8px 12px;
  background-color: var(--bg-tertiary);
  border-top: 1px solid var(--border-color);
}

.terminal-input :deep(.el-input__wrapper) {
  background-color: var(--bg-secondary);
  box-shadow: none;
  border: 1px solid var(--border-color);
}

.terminal-input :deep(.el-input__inner) {
  color: var(--text-primary);
  font-family: 'Consolas', 'Monaco', monospace;
}

.terminal-input :deep(.el-input-group__append) {
  background-color: var(--bg-tertiary);
  border-color: var(--border-color);
}

.input-prompt {
  color: #67c23a;
  font-family: monospace;
  font-weight: bold;
}

/* Continue mode styling */
.terminal-input.continue-mode {
  background-color: var(--bg-tertiary);
  border-top: 1px solid var(--border-color);
}

.terminal-input.continue-mode :deep(.el-input__wrapper) {
  background-color: var(--bg-secondary);
  box-shadow: none;
  border: 1px solid var(--border-color);
}

.terminal-input.continue-mode :deep(.el-input__inner) {
  color: var(--text-primary);
  font-family: 'Consolas', 'Monaco', monospace;
}

.terminal-input.continue-mode :deep(.el-input-group__append) {
  background-color: var(--bg-tertiary);
  border-color: var(--border-color);
}

.terminal-input.continue-mode :deep(.el-button) {
  background: #67c23a;
  border-color: #67c23a;
  color: white;
}

.terminal-input.continue-mode :deep(.el-button:hover) {
  background: #85cf62;
  border-color: #85cf62;
}

/* Scrollbar styling */
.terminal-output::-webkit-scrollbar {
  width: 8px;
}

.terminal-output::-webkit-scrollbar-track {
  background: var(--bg-primary);
}

.terminal-output::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
}

.terminal-output::-webkit-scrollbar-thumb:hover {
  background: var(--border-hover);
}
</style>
