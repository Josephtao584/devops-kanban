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
          v-for="line in currentOutput"
          :key="line.id"
          class="output-line"
          :class="[line.stream, { 'incomplete': !line.isComplete }]"
        >
          <span v-if="line.stream === 'stdin'" class="prompt">&gt;</span>
          <span class="line-content">{{ line.data }}</span>
          <span v-if="!line.isComplete" class="cursor">▊</span>
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
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { ArrowUp, ArrowDown, Close, VideoPause } from '@element-plus/icons-vue'
import { getSessionOutput } from '../api/session'
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
const isUnmounted = ref(false)

// Store outputs for each session
const sessionOutputs = ref({})

// Current session
const currentSession = computed(() => {
  return props.sessions.find(s => s.id === props.currentSessionId) || null
})

// Current session output
const currentOutput = computed(() => {
  if (!props.currentSessionId) return []
  const output = sessionOutputs.value[props.currentSessionId]
  return output?.lines || []
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
      await sendSessionInput(props.currentSessionId, input)
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

// Add output to a session (legacy method for compatibility)
const addOutput = (sessionId, line) => {
  if (!sessionOutputs.value[sessionId]) {
    sessionOutputs.value[sessionId] = {
      lines: [],
      currentLineId: null
    }
  }

  const output = sessionOutputs.value[sessionId]
  output.lines.push({
    id: `line-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    data: line.data,
    stream: line.stream || 'stdout',
    isComplete: true,
    timestamp: line.timestamp || Date.now()
  })
  scrollToBottom()
}

// Handle streaming chunks from WebSocket
const handleStreamChunk = (sessionId, chunk) => {
  if (!sessionOutputs.value[sessionId]) {
    sessionOutputs.value[sessionId] = {
      lines: [],
      currentLineId: null
    }
  }

  const output = sessionOutputs.value[sessionId]

  if (chunk.type === 'chunk') {
    let currentLine = output.lines.find(l => l.id === output.currentLineId)

    if (!currentLine || currentLine.isComplete) {
      // Create a new line
      currentLine = {
        id: `line-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        data: '',
        stream: chunk.stream,
        isComplete: false
      }
      output.lines.push(currentLine)
      output.currentLineId = currentLine.id
    }

    // Append content to current line
    currentLine.data += chunk.content
    currentLine.isComplete = chunk.isComplete

    if (chunk.isComplete) {
      output.currentLineId = null
    }

    scrollToBottom()
  } else if (chunk.type === 'message') {
    // Backward compatibility with old message format
    addOutput(sessionId, {
      data: chunk.content || chunk.data,
      stream: chunk.stream,
      timestamp: chunk.timestamp
    })
  }
}

// Clear output for a session
const clearOutput = (sessionId) => {
  sessionOutputs.value[sessionId] = {
    lines: [],
    currentLineId: null
  }
}

// Scroll to bottom
const scrollToBottom = () => {
  nextTick(() => {
    if (outputContainer.value && !isUnmounted.value) {
      outputContainer.value.scrollTop = outputContainer.value.scrollHeight
    }
  })
}

// Watch for session changes to subscribe to WebSocket
watch(() => props.currentSessionId, async (newId, oldId) => {
  console.log('[TerminalPanel] Session changed:', { oldId, newId })

  if (oldId) {
    // Unsubscribe from old session
    wsService.unsubscribeFromSession(oldId)
  }

  if (newId) {
    console.log('[TerminalPanel] Loading output for session:', newId)

    // Only load output if not already loaded (preserve existing output)
    const existingOutput = sessionOutputs.value[newId]
    if (!existingOutput || existingOutput.lines.length === 0) {
      try {
        const response = await getSessionOutput(newId)
        console.log('[TerminalPanel] Output response:', response)
        // Handle string output (split by newlines)
        const outputStr = response.data || response || ''
        if (typeof outputStr === 'string') {
          const lines = outputStr.split('\n').filter(l => l.trim())
          if (lines.length > 0) {
            sessionOutputs.value[newId] = {
              lines: lines.map((line, i) => ({
                id: `line-history-${i}`,
                data: line,
                stream: 'stdout',
                isComplete: true,
                timestamp: Date.now() + i
              })),
              currentLineId: null
            }
          }
        } else if (Array.isArray(outputStr)) {
          if (outputStr.length > 0) {
            sessionOutputs.value[newId] = {
              lines: outputStr.map((line, i) => ({
                id: `line-history-${i}`,
                data: line.data || line,
                stream: line.stream || 'stdout',
                isComplete: true,
                timestamp: line.timestamp || Date.now()
              })),
              currentLineId: null
            }
          }
        }
      } catch (e) {
        console.error('[TerminalPanel] Failed to load output:', e)
      }
    }

    // Connect WebSocket if not connected
    console.log('[TerminalPanel] WebSocket connected?', wsService.isConnected())
    if (!wsService.isConnected()) {
      try {
        console.log('[TerminalPanel] Connecting WebSocket...')
        await wsService.connect()
        console.log('[TerminalPanel] WebSocket connected successfully')
      } catch (e) {
        console.error('[TerminalPanel] Failed to connect WebSocket:', e)
      }
    }

    // Subscribe to output
    wsService.subscribeToOutput(newId, (data) => {
      handleStreamChunk(newId, data)
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

// Cleanup on unmount
onUnmounted(() => {
  isUnmounted.value = true
})
</script>

<style scoped>
.terminal-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  background: #1e1e1e;
  border-left: 1px solid #3d3d3d;
  transition: width 0.3s ease;
  z-index: 100;
  display: flex;
  flex-direction: column;
}

.terminal-panel.expanded {
  width: 400px;
}

.terminal-panel.minimized {
  width: 40px;
}

.terminal-header {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 0;
  background: #2d2d2d;
  border-bottom: 1px solid #3d3d3d;
}

.terminal-panel.minimized .terminal-header {
  height: 100%;
  justify-content: flex-start;
}

.session-tabs {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
  flex: 1;
  overflow-y: auto;
  padding: 4px;
}

.terminal-panel.minimized .session-tabs {
  padding: 4px 0;
}

.session-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: #3d3d3d;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.terminal-panel.minimized .session-tab {
  flex-direction: column;
  padding: 4px;
  gap: 2px;
}

.terminal-panel.minimized .task-name {
  display: none;
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
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
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
  flex-shrink: 0;
}

.close-btn:hover {
  color: #f56c6c;
}

.no-sessions {
  color: var(--text-muted);
  font-size: 12px;
  padding: 8px;
  text-align: center;
}

.terminal-panel.minimized .no-sessions {
  display: none;
}

.panel-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  padding: 4px 8px;
  border-top: 1px solid #3d3d3d;
}

.terminal-panel.minimized .panel-actions {
  flex-direction: column;
  border-top: none;
  padding: 4px 0;
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
  color: var(--text-muted);
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

.cursor {
  color: #409eff;
  animation: blink 1s infinite;
  margin-left: 2px;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.terminal-input {
  padding: 8px 12px;
  background: #2d2d2d;
  border-top: 1px solid #3d3d3d;
}

.terminal-input :deep(.el-input-group) {
  display: flex;
  border: 1px solid #3d3d3d;
  border-radius: 4px;
  overflow: hidden;
}

.terminal-input :deep(.el-input__wrapper) {
  background: #1e1e1e;
  box-shadow: none;
  border: none;
  border-radius: 0;
}

.terminal-input :deep(.el-input__inner) {
  color: #d4d4d4;
  font-family: 'Consolas', 'Monaco', monospace;
}

.terminal-input :deep(.el-input-group__append) {
  background: #3d3d3d;
  border: none;
  border-left: 1px solid #3d3d3d;
  border-radius: 0;
  box-shadow: none;
}

.terminal-input :deep(.el-input-group__append .el-button) {
  color: #d4d4d4;
  margin: 0;
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

/* Mobile responsive - switch to bottom panel on small screens */
@media (max-width: 768px) {
  .terminal-panel {
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100% !important;
    height: 300px;
    border-left: none;
    border-top: 1px solid #3d3d3d;
  }

  .terminal-panel.minimized {
    height: 40px;
    width: 100% !important;
  }

  .terminal-header {
    flex-direction: row;
    height: 40px;
    padding: 0 12px;
  }

  .terminal-panel.minimized .terminal-header {
    height: 40px;
  }

  .session-tabs {
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 0 4px;
  }

  .session-tab {
    flex-direction: row;
    padding: 6px 12px;
  }

  .terminal-panel.minimized .session-tab {
    flex-direction: row;
    padding: 6px 12px;
  }

  .terminal-panel.minimized .task-name {
    display: block;
  }

  .panel-actions {
    flex-direction: row;
    border-top: none;
    padding: 0 8px;
  }

  .no-sessions {
    display: block;
  }
}
</style>
