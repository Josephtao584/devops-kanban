<template>
  <div class="terminal-panel" :class="{ expanded: isExpanded, minimized: !isExpanded }">
    <!-- Header with tabs -->
    <div class="terminal-header">
      <div class="session-tabs">
        <div
          v-for="session in sessions"
          :key="session.id"
          class="session-tab"
          :class="{ active: currentSessionId === session.id }"
          @click="switchSession(session.id)"
        >
          <span class="task-name">{{ session.taskTitle }}</span>
          <span class="session-status" :class="getStatusClass(session.status)">
            {{ session.status }}
          </span>
          <el-icon class="close-btn" @click.stop="$emit('close', session.id)">
            <Close />
          </el-icon>
        </div>
        <div v-if="sessions.length === 0" class="no-sessions">
          No active sessions
        </div>
      </div>
      <div class="panel-actions">
        <el-button size="small" text @click="toggleExpand">
          <el-icon>
            <component :is="isExpanded ? 'ArrowDown' : 'ArrowUp'" />
          </el-icon>
        </el-button>
        <el-button v-if="currentSession" size="small" text type="danger" @click="stopCurrentSession">
          <el-icon><VideoPause /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- Terminal body (only show when expanded) -->
    <div v-show="isExpanded" class="terminal-body" ref="terminalRef">
      <div v-if="!currentSession" class="terminal-placeholder">
        <p>Select or start a session to view output</p>
      </div>
      <div v-else class="output-container" ref="outputContainer">
        <div
          v-for="(line, index) in currentOutput"
          :key="index"
          class="output-line"
          :class="line.stream"
        >
          <span v-if="line.stream === 'stdin'" class="prompt">&gt;</span>
          <span class="line-content">{{ line.data }}</span>
        </div>
        <div v-if="currentOutput.length === 0" class="empty-output">
          <p>Waiting for output...</p>
        </div>
      </div>
    </div>

    <!-- Input area (only show when expanded and session is running) -->
    <div v-show="isExpanded && currentSession" class="terminal-input">
      <el-input
        v-model="inputText"
        placeholder="Type to send input..."
        :disabled="!isSessionRunning"
        @keyup.enter="sendInput"
      >
        <template #prefix>
          <span class="input-prompt">&gt;</span>
        </template>
        <template #append>
          <el-button :disabled="!inputText.trim() || !isSessionRunning" @click="sendInput">
            Send
          </el-button>
        </template>
      </el-input>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { ArrowUp, ArrowDown, Close, VideoPause } from '@element-plus/icons-vue'
import sessionApi from '../api/session'
import wsService from '../services/websocket'

const props = defineProps({
  sessions: {
    type: Array,
    default: () => []
  },
  currentSessionId: {
    type: [Number, String],
    default: null
  }
})

const emit = defineEmits(['close', 'switch', 'stop', 'input'])

const isExpanded = ref(true)
const inputText = ref('')
const terminalRef = ref(null)
const outputContainer = ref(null)

// Store outputs for each session
const sessionOutputs = ref({})

// Current session
const currentSession = computed(() => {
  return props.sessions.find(s => s.id === props.currentSessionId) || null
})

// Current session output
const currentOutput = computed(() => {
  if (!props.currentSessionId) return []
  return sessionOutputs.value[props.currentSessionId] || []
})

// Check if current session is running
const isSessionRunning = computed(() => {
  return currentSession.value?.status === 'RUNNING' || currentSession.value?.status === 'IDLE'
})

// Get status class
const getStatusClass = (status) => {
  if (!status) return ''
  return `status-${status.toLowerCase()}`
}

// Toggle expand
const toggleExpand = () => {
  isExpanded.value = !isExpanded.value
}

// Switch session
const switchSession = (sessionId) => {
  emit('switch', sessionId)
}

// Send input
const sendInput = async () => {
  if (!inputText.value.trim() || !props.currentSessionId) return

  const input = inputText.value.trim()
  inputText.value = ''

  // Add to local output immediately
  addOutput(props.currentSessionId, {
    data: input,
    stream: 'stdin',
    timestamp: Date.now()
  })

  try {
    if (wsService.isConnected()) {
      wsService.sendInput(props.currentSessionId, input)
    } else {
      await sessionApi.sendInput(props.currentSessionId, input)
    }
  } catch (e) {
    console.error('Failed to send input:', e)
  }
}

// Stop current session
const stopCurrentSession = () => {
  if (currentSession.value) {
    emit('stop', currentSession.value.id)
  }
}

// Add output to a session
const addOutput = (sessionId, line) => {
  if (!sessionOutputs.value[sessionId]) {
    sessionOutputs.value[sessionId] = []
  }
  sessionOutputs.value[sessionId].push(line)
  scrollToBottom()
}

// Clear output for a session
const clearOutput = (sessionId) => {
  sessionOutputs.value[sessionId] = []
}

// Scroll to bottom
const scrollToBottom = () => {
  nextTick(() => {
    if (outputContainer.value) {
      outputContainer.value.scrollTop = outputContainer.value.scrollHeight
    }
  })
}

// Watch for session changes to subscribe to WebSocket
watch(() => props.currentSessionId, async (newId, oldId) => {
  if (oldId) {
    // Unsubscribe from old session
    wsService.unsubscribeFromSession(oldId)
  }

  if (newId) {
    // Load existing output
    try {
      const response = await sessionApi.getOutput(newId)
      // Handle string output (split by newlines)
      const outputStr = response.data || response || ''
      if (typeof outputStr === 'string') {
        const lines = outputStr.split('\n').filter(l => l.trim())
        sessionOutputs.value[newId] = lines.map((line, i) => ({
          data: line,
          stream: 'stdout',
          timestamp: Date.now() + i
        }))
      } else if (Array.isArray(outputStr)) {
        sessionOutputs.value[newId] = outputStr.map(line => ({
          data: line.data || line,
          stream: line.stream || 'stdout',
          timestamp: line.timestamp || Date.now()
        }))
      }
    } catch (e) {
      console.error('Failed to load output:', e)
    }

    // Connect WebSocket if not connected
    if (!wsService.isConnected()) {
      try {
        await wsService.connect()
      } catch (e) {
        console.error('Failed to connect WebSocket:', e)
      }
    }

    // Subscribe to output
    wsService.subscribeToOutput(newId, (data) => {
      if (data.type === 'output') {
        addOutput(newId, {
          data: data.data,
          stream: data.stream,
          timestamp: data.timestamp
        })
      }
    })

    // Subscribe to status
    wsService.subscribeToStatus(newId, (data) => {
      if (data.type === 'status') {
        // Update session status - emit to parent
        emit('switch', newId) // Trigger parent to refresh
      }
    })

    scrollToBottom()
  }
}, { immediate: true })

// Watch for sessions being removed
watch(() => props.sessions, (newSessions, oldSessions) => {
  const oldIds = new Set(oldSessions?.map(s => s.id) || [])
  const newIds = new Set(newSessions?.map(s => s.id) || [])

  // Clean up outputs for removed sessions
  oldIds.forEach(id => {
    if (!newIds.has(id)) {
      delete sessionOutputs.value[id]
      wsService.unsubscribeFromSession(id)
    }
  })
}, { deep: true })

// Expose methods
defineExpose({
  addOutput,
  clearOutput
})
</script>

<style scoped>
.terminal-panel {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #1e1e1e;
  border-top: 1px solid #3d3d3d;
  transition: height 0.3s ease;
  z-index: 100;
}

.terminal-panel.expanded {
  height: 300px;
}

.terminal-panel.minimized {
  height: 40px;
}

.terminal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 40px;
  padding: 0 12px;
  background: #2d2d2d;
  border-bottom: 1px solid #3d3d3d;
}

.session-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  overflow-x: auto;
}

.session-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #3d3d3d;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.session-tab:hover {
  background: #4d4d4d;
}

.session-tab.active {
  background: var(--el-color-primary);
}

.task-name {
  font-size: 12px;
  color: #d4d4d4;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-status {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  text-transform: uppercase;
}

.status-running {
  background: #67c23a;
  color: white;
}

.status-idle {
  background: #e6a23c;
  color: white;
}

.status-stopped {
  background: #909399;
  color: white;
}

.status-created {
  background: #409eff;
  color: white;
}

.status-error {
  background: #f56c6c;
  color: white;
}

.close-btn {
  font-size: 14px;
  color: #909399;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #f56c6c;
}

.no-sessions {
  color: #666;
  font-size: 12px;
  padding: 0 12px;
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.panel-actions .el-button {
  color: #909399;
}

.panel-actions .el-button:hover {
  color: #d4d4d4;
}

.terminal-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.output-container {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.5;
}

.terminal-placeholder,
.empty-output {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #666;
}

.output-line {
  margin-bottom: 2px;
  word-break: break-all;
}

.output-line.stdout {
  color: #d4d4d4;
}

.output-line.stderr {
  color: #f56c6c;
}

.output-line.stdin {
  color: #67c23a;
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
  background: #2d2d2d;
  border-top: 1px solid #3d3d3d;
}

.terminal-input :deep(.el-input__wrapper) {
  background: #1e1e1e;
  box-shadow: none;
  border: 1px solid #3d3d3d;
}

.terminal-input :deep(.el-input__inner) {
  color: #d4d4d4;
  font-family: 'Consolas', 'Monaco', monospace;
}

.terminal-input :deep(.el-input-group__append) {
  background: #3d3d3d;
  border-color: #3d3d3d;
}

.terminal-input :deep(.el-input-group__append .el-button) {
  color: #d4d4d4;
}

.input-prompt {
  color: #67c23a;
  font-family: monospace;
  font-weight: bold;
}

/* Scrollbar styling */
.output-container::-webkit-scrollbar {
  width: 8px;
}

.output-container::-webkit-scrollbar-track {
  background: #1e1e1e;
}

.output-container::-webkit-scrollbar-thumb {
  background: #3d3d3d;
  border-radius: 4px;
}

.output-container::-webkit-scrollbar-thumb:hover {
  background: #4d4d4d;
}
</style>
