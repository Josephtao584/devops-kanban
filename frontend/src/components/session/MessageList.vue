<template>
  <div ref="containerRef" class="message-list-container">
    <!-- Empty state - No session -->
    <div v-if="!hasSession" class="chat-empty">
      <div class="empty-icon">
        <el-icon :size="48"><ChatDotRound /></el-icon>
      </div>
      <p class="empty-text">{{ emptyTitle }}</p>
      <p class="empty-hint">{{ emptyHint }}</p>
    </div>

    <!-- Empty state - Ready to start -->
    <div v-else-if="messages.length === 0" class="chat-empty">
      <div class="empty-icon">
        <el-icon :size="48"><ChatLineRound /></el-icon>
      </div>
      <p class="empty-text">{{ readyTitle }}</p>
      <p class="empty-hint">{{ readyHint }}</p>
    </div>

    <!-- Messages -->
    <div v-else class="messages-list">
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="message"
        :class="getMessageClasses(msg)"
      >
        <!-- Tool Use Message -->
        <template v-if="msg.contentType === 'tool_use'">
          <div class="message-header">
            <span class="message-role">
              <span class="tool-icon">🔧</span>
              {{ getToolLabel(msg.toolName) }}
            </span>
            <span class="message-time">{{ formatTime(msg.timestamp) }}</span>
          </div>
          <div class="tool-input">
            <div v-if="msg.toolInput" class="tool-params">
              <div v-for="(value, key) in getDisplayToolInput(msg)" :key="key" class="tool-param">
                <span class="param-key">{{ key }}:</span>
                <span class="param-value">{{ formatToolValue(value) }}</span>
              </div>
            </div>
          </div>
        </template>

        <!-- Tool Result Message -->
        <template v-else-if="msg.contentType === 'tool_result'">
          <div class="message-header">
            <span class="message-role">
              <span v-if="msg.toolIsError" class="result-icon error">❌</span>
              <span v-else class="result-icon success">✅</span>
              {{ msg.toolIsError ? 'Error' : 'Result' }}
            </span>
            <span class="message-time">{{ formatTime(msg.timestamp) }}</span>
          </div>
          <div class="tool-result" :class="{ 'tool-error': msg.toolIsError }">
            <pre>{{ truncateContent(msg.content, 500) }}</pre>
          </div>
        </template>

        <!-- Permission Denied Message -->
        <template v-else-if="msg.contentType === 'permission_denied'">
          <div class="message-header">
            <span class="message-role">
              <span class="denied-icon">🚫</span>
              Permission Denied
            </span>
            <span class="message-time">{{ formatTime(msg.timestamp) }}</span>
          </div>
          <div class="permission-denied">
            <div class="denied-resource">{{ msg.resource || msg.content }}</div>
            <div v-if="msg.reason" class="denied-reason">{{ msg.reason }}</div>
          </div>
        </template>

        <!-- Regular Text/Thinking Message -->
        <template v-else>
          <div class="message-header">
            <span class="message-role">
              <span v-if="msg.contentType === 'thinking'" class="thinking-icon">💭</span>
              {{ getRoleLabel(msg.role, msg.contentType) }}
            </span>
            <span class="message-time">{{ formatTime(msg.timestamp) }}</span>
          </div>
          <div class="message-content">{{ msg.content }}</div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted } from 'vue'
import { ChatDotRound, ChatLineRound } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  messages: {
    type: Array,
    default: () => []
  },
  hasSession: {
    type: Boolean,
    default: false
  },
  showThinking: {
    type: Boolean,
    default: true
  },
  emptyTitle: {
    type: String,
    default: 'No active session'
  },
  emptyHint: {
    type: String,
    default: 'Select an agent and start a session to begin'
  },
  readyTitle: {
    type: String,
    default: 'Ready to chat'
  },
  readyHint: {
    type: String,
    default: 'Click "Start" to begin the conversation'
  },
  autoScroll: {
    type: Boolean,
    default: true
  }
})

const { t } = useI18n()
const containerRef = ref(null)

const getMessageClasses = (msg) => {
  const classes = [`message-${msg.role}`]
  if (msg.contentType === 'thinking') {
    classes.push('message-thinking')
  } else if (msg.contentType === 'tool_use') {
    classes.push('message-tool-use')
  } else if (msg.contentType === 'tool_result') {
    classes.push('message-tool-result')
  } else if (msg.contentType === 'permission_denied') {
    classes.push('message-permission-denied')
  }
  return classes
}

const getRoleLabel = (role, contentType) => {
  if (role === 'user') {
    return t('chat.you', 'You')
  }
  if (contentType === 'thinking') {
    return t('chat.thinking', 'Thinking')
  }
  return t('chat.assistant', 'Assistant')
}

const getToolLabel = (toolName) => {
  const toolLabels = {
    'Bash': 'Terminal',
    'Read': 'Read File',
    'Edit': 'Edit File',
    'Write': 'Write File',
    'Glob': 'Find Files',
    'Grep': 'Search',
    'TaskCreate': 'Create Task',
    'TaskUpdate': 'Update Task',
    'TaskList': 'List Tasks',
    'TaskGet': 'Get Task',
    'TaskOutput': 'Task Output',
    'TaskStop': 'Stop Task',
    'AskUserQuestion': 'Ask User',
    'EnterPlanMode': 'Plan Mode',
    'ExitPlanMode': 'Exit Plan',
    'Skill': 'Skill',
    'Agent': 'Agent',
    'WebSearch': 'Web Search',
    'NotebookEdit': 'Edit Notebook'
  }
  return toolLabels[toolName] || toolName || 'Tool'
}

const getDisplayToolInput = (msg) => {
  if (!msg.toolInput) return {}

  // For certain tools, show only relevant fields
  if (msg.toolName === 'Bash') {
    return { command: msg.toolInput.command || msg.toolInput.description }
  }
  if (msg.toolName === 'Read') {
    return { file: msg.toolInput.file_path }
  }
  if (msg.toolName === 'Edit') {
    return {
      file: msg.toolInput.file_path,
      replace: truncateContent(msg.toolInput.old_string, 50)
    }
  }
  if (msg.toolName === 'Write') {
    return { file: msg.toolInput.file_path }
  }
  if (msg.toolName === 'Glob') {
    return { pattern: msg.toolInput.pattern }
  }
  if (msg.toolName === 'Grep') {
    return { pattern: msg.toolInput.pattern, path: msg.toolInput.path }
  }

  return msg.toolInput
}

const formatToolValue = (value) => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return truncateContent(value, 100)
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const truncateContent = (content, maxLength = 500) => {
  if (!content) return ''
  const str = String(content)
  if (str.length <= maxLength) return str
  return str.substring(0, maxLength) + '...'
}

const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const scrollToBottom = () => {
  if (containerRef.value && props.autoScroll) {
    nextTick(() => {
      containerRef.value.scrollTop = containerRef.value.scrollHeight
    })
  }
}

// Auto-scroll when messages change
watch(() => props.messages.length, () => {
  scrollToBottom()
})

onMounted(() => {
  scrollToBottom()
})

// Expose scrollToBottom for parent components
defineExpose({ scrollToBottom })
</script>

<style scoped>
.message-list-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: var(--bg-primary, #1e1e2e);
}

.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted, #6b7280);
}

.empty-icon {
  margin-bottom: 16px;
  color: var(--text-muted, #6b7280);
}

.empty-text {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 8px;
  color: var(--text-secondary, #9ca3af);
}

.empty-hint {
  font-size: 13px;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message {
  padding: 10px 14px;
  border-radius: 12px;
  max-width: 85%;
}

.message-user {
  align-self: flex-end;
  background: var(--accent-color, #6366f1);
  color: white;
  margin-left: auto;
}

.message-assistant {
  align-self: flex-start;
  background: var(--message-bg, #2a2a3e);
  color: var(--text-primary, #e0e0e0);
  border: 1px solid var(--border-color, #3a3a4e);
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  font-size: 11px;
}

.message-user .message-header {
  color: rgba(255, 255, 255, 0.7);
}

.message-assistant .message-header {
  color: var(--text-muted, #9ca3af);
}

.message-role {
  font-weight: 600;
}

.message-time {
  opacity: 0.7;
}

.message-content {
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Thinking message styles */
.message-thinking {
  background: var(--thinking-bg, #2a3a2a) !important;
  border: 1px solid var(--thinking-border, #3a5a3a) !important;
  color: var(--thinking-text, #8ab87a);
  font-size: 13px;
}

.message-thinking .message-role {
  color: var(--thinking-text, #8ab87a);
}

.thinking-icon {
  margin-right: 4px;
}

/* Tool use message styles */
.message-tool-use {
  background: var(--tool-use-bg, #2a3a4a) !important;
  border: 1px solid var(--tool-use-border, #3a5a7a) !important;
  color: var(--tool-use-text, #9ac8ea);
  font-size: 13px;
}

.message-tool-use .message-role {
  color: var(--tool-use-text, #9ac8ea);
}

.tool-icon {
  margin-right: 4px;
}

.tool-input {
  margin-top: 4px;
}

.tool-params {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tool-param {
  display: flex;
  gap: 6px;
  font-size: 12px;
}

.param-key {
  color: var(--text-muted, #9ca3af);
  font-weight: 500;
  min-width: 60px;
}

.param-value {
  color: var(--text-primary, #e0e0e0);
  word-break: break-all;
}

/* Tool result message styles */
.message-tool-result {
  background: var(--tool-result-bg, #2a2a3e) !important;
  border: 1px solid var(--border-color, #3a3a4e) !important;
  color: var(--text-primary, #e0e0e0);
  font-size: 12px;
}

.tool-result pre {
  margin: 4px 0 0 0;
  padding: 8px;
  background: var(--bg-secondary, #252535);
  border-radius: 6px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}

.tool-error pre {
  background: var(--error-bg, #3a2a2a);
  border: 1px solid var(--error-border, #5a3a3a);
}

.result-icon {
  margin-right: 4px;
}

.result-icon.error {
  color: #f87171;
}

.result-icon.success {
  color: #4ade80;
}

/* Permission denied message styles */
.message-permission-denied {
  background: var(--warning-bg, #3a3a2a) !important;
  border: 1px solid var(--warning-border, #5a5a3a) !important;
  color: var(--warning-text, #fcd34d);
  font-size: 13px;
}

.message-permission-denied .message-role {
  color: var(--warning-text, #fcd34d);
}

.denied-icon {
  margin-right: 4px;
}

.permission-denied {
  margin-top: 4px;
}

.denied-resource {
  font-weight: 500;
  color: var(--text-primary, #e0e0e0);
}

.denied-reason {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-muted, #9ca3af);
}
</style>
