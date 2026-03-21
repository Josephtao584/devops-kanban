<template>
  <div ref="containerRef" class="message-list-container">
    <!-- Empty state - No session and no workflow node -->
    <div v-if="!hasSession && !hasWorkflowNode" class="chat-empty">
      <div class="empty-icon">
        <el-icon :size="48"><ChatDotRound /></el-icon>
      </div>
      <p class="empty-text">{{ emptyTitle }}</p>
      <p class="empty-hint">{{ emptyHint }}</p>
    </div>

    <!-- Empty state - Workflow node with no messages -->
    <div v-else-if="hasWorkflowNode && messages.length === 0" class="chat-empty workflow-empty">
      <div class="empty-icon">
        <el-icon :size="48"><Document /></el-icon>
      </div>
      <p class="empty-text">{{ $t('chat.noMessages', 'No conversation yet') }}</p>
      <p class="empty-hint">{{ $t('chat.noMessagesHint', 'This node has no recorded conversation') }}</p>
    </div>

    <!-- Empty state - Ready to start -->
    <div v-else-if="!hasWorkflowNode && messages.length === 0" class="chat-empty">
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
        :class="`message-${msg.role}`"
      >
        <div class="message-header">
          <span class="message-role">{{ getRoleLabel(msg.role) }}</span>
          <span class="message-time">{{ formatTime(msg.timestamp) }}</span>
        </div>
        <div class="message-content" v-html="formatContent(msg.content)"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { ChatDotRound, ChatLineRound, Document } from '@element-plus/icons-vue'
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
  hasWorkflowNode: {
    type: Boolean,
    default: false
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
const isUnmounted = ref(false)

const getRoleLabel = (role) => {
  return role === 'user' ? t('chat.you', 'You') : t('chat.assistant', 'Assistant')
}

const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Format message content with basic markdown support
const formatContent = (content) => {
  if (!content) return ''

  // Escape HTML
  let formatted = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Bold text **text** or __text__
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  formatted = formatted.replace(/__(.*?)__/g, '<strong>$1</strong>')

  // Inline code `code`
  formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Code blocks ```code```
  formatted = formatted.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>')

  // Line breaks
  formatted = formatted.replace(/\n/g, '<br>')

  // Checkmarks
  formatted = formatted.replace(/✅/g, '<span class="check-icon">✅</span>')
  formatted = formatted.replace(/🔄/g, '<span class="loading-icon">🔄</span>')
  formatted = formatted.replace(/⏳/g, '<span class="pending-icon">⏳</span>')

  return formatted
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
  if (!isUnmounted.value) {
    scrollToBottom()
  }
})

onMounted(() => {
  scrollToBottom()
})

onUnmounted(() => {
  isUnmounted.value = true
})

// Expose scrollToBottom for parent components
defineExpose({ scrollToBottom })
</script>

<style scoped>
.message-list-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: var(--bg-primary, #ffffff);
}

.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted, #999999);
}

.empty-icon {
  margin-bottom: 16px;
  color: var(--text-muted, #999999);
}

.empty-text {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 8px;
  color: var(--text-secondary, #666666);
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
  background: var(--message-bg, #f3f4f6);
  color: var(--text-primary, #333333);
  border: 1px solid var(--border-color, #e0e0e0);
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
  color: var(--text-muted, #999999);
}

.message-role {
  font-weight: 600;
}

.message-time {
  opacity: 0.7;
}

.message-content {
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-content :deep(code) {
  background: rgba(0, 0, 0, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', 'Fira Code', monospace;
  font-size: 13px;
}

.message-content :deep(pre) {
  background: rgba(0, 0, 0, 0.05);
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 8px 0;
}

.message-content :deep(pre code) {
  background: transparent;
  padding: 0;
  font-size: 13px;
  line-height: 1.5;
}

.message-content :deep(strong) {
  font-weight: 600;
}

.message-content :deep(.check-icon) {
  color: #10b981;
}

.message-content :deep(.loading-icon) {
  color: #3b82f6;
  animation: spin 1s linear infinite;
}

.message-content :deep(.pending-icon) {
  color: #6b7280;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Workflow empty state */
.workflow-empty .empty-icon {
  color: var(--accent-color, #6366f1);
}
</style>
