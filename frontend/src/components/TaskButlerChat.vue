<template>
  <div class="task-butler-chat">
    <!-- 任务状态卡片 -->
    <div class="task-status-card">
      <div class="status-info">
        <span class="status-badge" :class="taskStatusClass">{{ taskStatusText }}</span>
        <span class="progress" v-if="workflowProgress > 0">{{ $t('butler.progressLabel') }}: {{ workflowProgress }}%</span>
      </div>
      <div class="quick-actions">
        <button
          v-for="action in quickActions"
          :key="action.id"
          class="quick-action-btn"
          :class="{ disabled: action.disabled }"
          :disabled="action.disabled"
          @click="handleQuickAction(action)"
          :title="action.label"
        >
          <svg v-if="action.icon === 'play'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          <svg v-else-if="action.icon === 'pause'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
          <svg v-else-if="action.icon === 'chart'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
          <svg v-else-if="action.icon === 'help'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          {{ action.label }}
        </button>
      </div>
    </div>

    <!-- 聊天区域 -->
    <div class="butler-messages" ref="messagesRef">
      <div v-for="msg in messages" :key="msg.id" class="message" :class="msg.role">
        <div class="message-avatar">
          <span v-if="msg.role === 'assistant'">🤖</span>
          <span v-else>👤</span>
        </div>
        <div class="message-content">
          <div class="message-text">{{ msg.content }}</div>
          <div class="message-time">{{ formatTime(msg.timestamp) }}</div>
        </div>
      </div>
      <div v-if="messages.length === 0" class="empty-messages">
        <p>{{ $t('butler.selectTaskHint') }}</p>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="butler-input">
      <input
        v-model="inputText"
        @keyup.enter="sendMessage"
        :placeholder="$t('butler.inputPlaceholder')"
        :disabled="!task"
      />
      <button @click="sendMessage" :disabled="!inputText.trim() || !task">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  getButlerWelcomeMessage,
  processButlerInput,
  getQuickActions,
  getWorkflowProgress,
  getResponseForAction
} from '../mock/butlerData'
import { getWorkflowByTask } from '../mock/workflowData'

const props = defineProps({
  task: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['control-workflow'])

const { t, locale } = useI18n()
const messages = ref([])
const inputText = ref('')
const messagesRef = ref(null)

// Get workflow for current task
const workflow = computed(() => {
  if (!props.task) return null
  return getWorkflowByTask(props.task.id)
})

// Calculate workflow progress
const workflowProgress = computed(() => {
  return getWorkflowProgress(workflow.value)
})

// Task status class
const taskStatusClass = computed(() => {
  if (!props.task) return 'status-unknown'
  const statusMap = {
    'TODO': 'status-todo',
    'IN_PROGRESS': 'status-in-progress',
    'DONE': 'status-done',
    'BLOCKED': 'status-blocked'
  }
  return statusMap[props.task.status] || 'status-unknown'
})

// Task status text
const taskStatusText = computed(() => {
  if (!props.task) return t('butler.selectTask')
  return t(`status.${props.task.status}`)
})

// Quick actions
const quickActions = computed(() => {
  return getQuickActions(props.task, workflow.value, locale.value)
})

// Format timestamp
const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString(locale.value === 'zh' ? 'zh-CN' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Scroll to bottom
const scrollToBottom = () => {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  })
}

// Send message
const sendMessage = () => {
  if (!inputText.value.trim() || !props.task) return

  const userMessage = {
    id: `user-${Date.now()}`,
    role: 'user',
    content: inputText.value.trim(),
    timestamp: new Date().toISOString()
  }

  messages.value.push(userMessage)
  inputText.value = ''
  scrollToBottom()

  // Process input and get response
  const result = processButlerInput(userMessage.content, props.task, workflow.value, locale.value)

  // Add assistant response with slight delay for natural feel
  setTimeout(() => {
    const assistantMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: result.response,
      timestamp: new Date().toISOString()
    }
    messages.value.push(assistantMessage)
    scrollToBottom()

    // Emit action if it's a control command
    if (['start', 'pause', 'continue', 'stop', 'retry'].includes(result.action)) {
      emit('control-workflow', {
        action: result.action,
        taskId: props.task.id
      })
    }
  }, 300)
}

// Handle quick action button click
const handleQuickAction = (action) => {
  if (action.disabled || !props.task) return

  // Add user action message
  const userMessage = {
    id: `user-${Date.now()}`,
    role: 'user',
    content: action.label,
    timestamp: new Date().toISOString()
  }
  messages.value.push(userMessage)
  scrollToBottom()

  // Get response for action
  const result = getResponseForAction(action.action, props.task, workflow.value, locale.value)

  // Add assistant response
  setTimeout(() => {
    const assistantMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: result.response,
      timestamp: new Date().toISOString()
    }
    messages.value.push(assistantMessage)
    scrollToBottom()

    // Emit action if it's a control command
    if (['start', 'pause', 'continue', 'stop', 'retry'].includes(action.action)) {
      emit('control-workflow', {
        action: action.action,
        taskId: props.task.id
      })
    }
  }, 300)
}

// Watch for task changes
watch(() => props.task, (newTask, oldTask) => {
  // Clear messages when task changes
  if (newTask && (!oldTask || newTask.id !== oldTask.id)) {
    messages.value = []

    // Add welcome message for new task
    const welcomeMsg = getButlerWelcomeMessage(newTask.title, locale.value)
    messages.value.push(welcomeMsg)
    scrollToBottom()
  } else if (!newTask) {
    // Clear messages when no task selected
    messages.value = []
  }
}, { immediate: true })

// Watch for locale changes
watch(locale, (newLocale) => {
  // Update welcome message if task is selected
  if (props.task && messages.value.length > 0 && messages.value[0].id === 'welcome') {
    messages.value[0] = getButlerWelcomeMessage(props.task.title, newLocale)
  }
})

// Expose methods
defineExpose({
  sendMessage,
  clearMessages: () => { messages.value = [] }
})
</script>

<style scoped>
.task-butler-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background-color: var(--bg-secondary, #f8fafc);
}

/* Task Status Card */
.task-status-card {
  padding: 12px 16px;
  flex-shrink: 0;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.08));
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.status-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.status-badge.status-todo {
  background: rgba(107, 114, 128, 0.15);
  color: #6b7280;
}

.status-badge.status-in-progress {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.status-badge.status-done {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.status-badge.status-blocked {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.status-badge.status-unknown {
  background: rgba(107, 114, 128, 0.15);
  color: #6b7280;
}

.progress {
  font-size: 12px;
  color: var(--text-secondary, #64748b);
  font-weight: 500;
}

.quick-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.quick-action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-primary, #ffffff);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-primary, #1e293b);
  cursor: pointer;
  transition: all 0.2s ease;
}

.quick-action-btn:hover:not(.disabled) {
  background: var(--bg-tertiary, #f1f5f9);
  border-color: var(--primary-color, #6366f1);
}

.quick-action-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Messages Area */
.butler-messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message {
  display: flex;
  gap: 10px;
  max-width: 90%;
}

.message.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message.assistant {
  align-self: flex-start;
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
  background: var(--bg-tertiary, #f1f5f9);
}

.message.user .message-avatar {
  background: rgba(59, 130, 246, 0.1);
}

.message.assistant .message-avatar {
  background: rgba(99, 102, 241, 0.1);
}

.message-content {
  padding: 10px 14px;
  border-radius: 12px;
  max-width: 100%;
}

.message.user .message-content {
  background: var(--primary-color, #6366f1);
  color: white;
  border-bottom-right-radius: 4px;
}

.message.assistant .message-content {
  background: var(--bg-tertiary, #f1f5f9);
  color: var(--text-primary, #1e293b);
  border-bottom-left-radius: 4px;
}

.message-text {
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-time {
  font-size: 10px;
  opacity: 0.7;
  margin-top: 4px;
  text-align: right;
}

.message.assistant .message-time {
  color: var(--text-muted, #94a3b8);
}

.empty-messages {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted, #94a3b8);
  font-size: 14px;
}

/* Input Area */
.butler-input {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  flex-shrink: 0;
  background: var(--bg-primary, #ffffff);
  border-top: 1px solid var(--border-color, #e2e8f0);
}

.butler-input input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 8px;
  font-size: 13px;
  background: var(--bg-secondary, #f8fafc);
  color: var(--text-primary, #1e293b);
  transition: border-color 0.2s ease;
}

.butler-input input:focus {
  outline: none;
  border-color: var(--primary-color, #6366f1);
}

.butler-input input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.butler-input button {
  padding: 10px 14px;
  background: var(--primary-color, #6366f1);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.butler-input button:hover:not(:disabled) {
  background: var(--primary-hover, #4f46e5);
}

.butler-input button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
