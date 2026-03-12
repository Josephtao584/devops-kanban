<template>
  <div class="global-task-butler">
    <!-- Project Statistics Overview -->
    <div class="stats-overview">
      <div
        class="stat-item"
        v-for="stat in taskStats"
        :key="stat.status"
        :class="'stat-' + stat.status.toLowerCase()"
        @click="handleStatClick(stat.status)"
      >
        <span class="stat-count">{{ stat.count }}</span>
        <span class="stat-label">{{ stat.label }}</span>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="quick-actions">
      <button
        v-for="action in quickActions"
        :key="action.id"
        class="quick-action-btn"
        @click="handleQuickAction(action)"
        :title="action.label"
      >
        <svg v-if="action.icon === 'chart'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="20" x2="18" y2="10"></line>
          <line x1="12" y1="20" x2="12" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="14"></line>
        </svg>
        <svg v-else-if="action.icon === 'list'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="8" y1="6" x2="21" y2="6"></line>
          <line x1="8" y1="12" x2="21" y2="12"></line>
          <line x1="8" y1="18" x2="21" y2="18"></line>
          <line x1="3" y1="6" x2="3.01" y2="6"></line>
          <line x1="3" y1="12" x2="3.01" y2="12"></line>
          <line x1="3" y1="18" x2="3.01" y2="18"></line>
        </svg>
        <svg v-else-if="action.icon === 'progress'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <svg v-else-if="action.icon === 'play'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        <svg v-else-if="action.icon === 'help'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <svg v-else-if="action.icon === 'calendar'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <svg v-else-if="action.icon === 'lightbulb'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18h6"></path>
          <path d="M10 22h4"></path>
          <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"></path>
        </svg>
        {{ action.label }}
      </button>
    </div>

    <!-- Chat Messages Area -->
    <div class="butler-messages" ref="messagesRef">
      <div v-for="msg in messages" :key="msg.id" class="message" :class="msg.role">
        <div class="message-avatar">
          <span v-if="msg.role === 'assistant'">☁️</span>
          <span v-else>👤</span>
        </div>
        <div class="message-content">
          <div class="message-text" v-html="formatMessage(msg.content)"></div>
          <!-- Task list with clickable items -->
          <div v-if="msg.tasks && msg.tasks.length > 0" class="task-list">
            <div
              v-for="task in msg.tasks"
              :key="task.id"
              class="task-item"
              @click="selectTask(task)"
            >
              <span class="task-icon">{{ getTaskStatusIcon(task.status) }}</span>
              <span class="task-title">{{ task.title }}</span>
              <span class="task-status-badge" :class="'status-' + task.status.toLowerCase()">
                {{ task.status }}
              </span>
            </div>
          </div>
          <div class="message-time">{{ formatTime(msg.timestamp) }}</div>
        </div>
      </div>
      <div v-if="messages.length === 0" class="empty-messages">
        <p>{{ $t('globalButler.welcomeHint') }}</p>
      </div>
    </div>

    <!-- Input Area -->
    <div class="butler-input">
      <input
        v-model="inputText"
        @keyup.enter="sendMessage"
        :placeholder="$t('globalButler.inputPlaceholder')"
      />
      <button @click="sendMessage" :disabled="!inputText.trim()">
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
  getProjectStats,
  getGlobalButlerWelcomeMessage,
  getGlobalQuickActions,
  processGlobalButlerInput
} from '../mock/butlerData'

const props = defineProps({
  tasks: {
    type: Array,
    default: () => []
  },
  projectId: {
    type: [Number, String],
    default: null
  }
})

const emit = defineEmits(['select-task', 'control-workflow'])

const { t, locale } = useI18n()
const messages = ref([])
const inputText = ref('')
const messagesRef = ref(null)

// Task statistics
const taskStats = computed(() => {
  const stats = getProjectStats(props.tasks, locale.value)
  return [
    { status: 'TODO', count: stats.TODO, label: t('status.TODO') },
    { status: 'IN_PROGRESS', count: stats.IN_PROGRESS, label: t('status.IN_PROGRESS') },
    { status: 'DONE', count: stats.DONE, label: t('status.DONE') },
    { status: 'BLOCKED', count: stats.BLOCKED, label: t('status.BLOCKED') }
  ]
})

// Quick actions
const quickActions = computed(() => {
  return getGlobalQuickActions(props.tasks, locale.value)
})

// Get task status icon
const getTaskStatusIcon = (status) => {
  const icons = {
    'TODO': '📋',
    'IN_PROGRESS': '🔄',
    'DONE': '✅',
    'BLOCKED': '🚫',
    'CANCELLED': '❌'
  }
  return icons[status] || '📋'
}

// Format timestamp
const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString(locale.value === 'zh' ? 'zh-CN' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Format message content (basic markdown-like formatting)
const formatMessage = (content) => {
  if (!content) return ''
  return content
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
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
  if (!inputText.value.trim()) return

  const userMessage = {
    id: `user-${Date.now()}`,
    role: 'user',
    content: inputText.value.trim(),
    timestamp: new Date().toISOString()
  }

  messages.value.push(userMessage)
  const userInput = inputText.value
  inputText.value = ''
  scrollToBottom()

  // Process input and get response
  const result = processGlobalButlerInput(userInput, props.tasks, locale.value)

  // Add assistant response with slight delay for natural feel
  setTimeout(() => {
    const assistantMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: result.response,
      timestamp: new Date().toISOString(),
      tasks: result.tasks || null
    }
    messages.value.push(assistantMessage)
    scrollToBottom()

    // Emit actions based on result
    if (result.action === 'start' && result.taskId) {
      emit('control-workflow', {
        action: 'start',
        taskId: result.taskId
      })
    } else if (result.action === 'pause' && result.taskId) {
      emit('control-workflow', {
        action: 'pause',
        taskId: result.taskId
      })
    } else if (result.action === 'batch-start' && result.taskIds) {
      // For batch start, we emit multiple events
      result.taskIds.forEach(taskId => {
        emit('control-workflow', {
          action: 'start',
          taskId: taskId
        })
      })
    }
  }, 300)
}

// Handle quick action button click
const handleQuickAction = (action) => {
  const userMessage = {
    id: `user-${Date.now()}`,
    role: 'user',
    content: action.label,
    timestamp: new Date().toISOString()
  }
  messages.value.push(userMessage)
  scrollToBottom()

  // Process the action
  const result = processGlobalButlerInput(action.action, props.tasks, locale.value)

  setTimeout(() => {
    const assistantMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: result.response,
      timestamp: new Date().toISOString(),
      tasks: result.tasks || null
    }
    messages.value.push(assistantMessage)
    scrollToBottom()
  }, 300)
}

// Handle stat click
const handleStatClick = (status) => {
  const statusFilter = {
    'TODO': 'todo',
    'IN_PROGRESS': 'in progress',
    'DONE': 'done',
    'BLOCKED': 'blocked'
  }
  const filter = statusFilter[status] || status
  const actionKey = status.toLowerCase().replace('_', '-')
  handleQuickAction({ action: `list-${actionKey}`, label: filter })
}

// Select task
const selectTask = (task) => {
  emit('select-task', task)
}

// Initialize with welcome message
onMounted(() => {
  const welcomeMsg = getGlobalButlerWelcomeMessage(props.tasks, locale.value)
  messages.value.push(welcomeMsg)
  scrollToBottom()
})

// Watch for tasks changes to update welcome message
watch(() => props.tasks, (newTasks) => {
  // Update welcome message if it exists
  if (messages.value.length > 0 && messages.value[0].id === 'welcome-global') {
    messages.value[0] = getGlobalButlerWelcomeMessage(newTasks, locale.value)
  }
}, { deep: true })

// Watch for locale changes
watch(locale, (newLocale) => {
  if (messages.value.length > 0 && messages.value[0].id === 'welcome-global') {
    messages.value[0] = getGlobalButlerWelcomeMessage(props.tasks, newLocale)
  }
})

// Expose methods
defineExpose({
  sendMessage,
  clearMessages: () => {
    messages.value = []
    const welcomeMsg = getGlobalButlerWelcomeMessage(props.tasks, locale.value)
    messages.value.push(welcomeMsg)
  }
})
</script>

<style scoped>
.global-task-butler {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background-color: var(--bg-secondary, #f8fafc);
}

/* Stats Overview */
.stats-overview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 12px 16px;
  flex-shrink: 0;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.08));
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 4px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.stat-item:hover {
  background: rgba(255, 255, 255, 0.5);
  transform: translateY(-1px);
}

.stat-count {
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
}

.stat-label {
  font-size: 10px;
  color: var(--text-secondary, #64748b);
  margin-top: 4px;
}

.stat-todo .stat-count { color: #6b7280; }
.stat-in_progress .stat-count { color: #3b82f6; }
.stat-done .stat-count { color: #10b981; }
.stat-blocked .stat-count { color: #ef4444; }

/* Quick Actions */
.quick-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 16px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
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

.quick-action-btn:hover {
  background: var(--bg-tertiary, #f1f5f9);
  border-color: var(--primary-color, #6366f1);
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
  background: rgba(139, 92, 246, 0.1);
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
  word-break: break-word;
}

.message-text :deep(strong) {
  font-weight: 600;
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

/* Task List in Messages */
.task-list {
  margin-top: 10px;
  border-top: 1px solid var(--border-color, #e2e8f0);
  padding-top: 10px;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  margin: 4px 0;
  background: var(--bg-primary, #ffffff);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.task-item:hover {
  background: rgba(99, 102, 241, 0.1);
  transform: translateX(2px);
}

.task-icon {
  font-size: 14px;
}

.task-title {
  flex: 1;
  font-size: 12px;
  color: var(--text-primary, #1e293b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-status-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.task-status-badge.status-todo {
  background: rgba(107, 114, 128, 0.15);
  color: #6b7280;
}

.task-status-badge.status-in_progress {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.task-status-badge.status-done {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.task-status-badge.status-blocked {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
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
