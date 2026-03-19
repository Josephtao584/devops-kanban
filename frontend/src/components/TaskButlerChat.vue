<template>
  <div class="task-butler-chat">
    <!-- 任务状态卡片 -->
    <div class="task-status-card">
      <div class="status-info">
        <span class="status-badge" :class="taskStatusClass">{{ taskStatusText }}</span>
        <span class="progress" v-if="task && task.workflow_run_id">
          {{ $t('workflow.viewWorkflow', '工作流') }} #{{ task.workflow_run_id }}
        </span>
        <button
          class="workflow-btn"
          :class="{ disabled: !task?.workflow_run_id }"
          :disabled="!task?.workflow_run_id"
          @click="handleViewProgress"
          :title="$t('workflow.viewWorkflow', '查看工作流进度')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
        </button>
      </div>
      <div class="quick-actions">
        <button
          v-for="action in quickActions"
          :key="action.id"
          class="quick-action-btn"
          :class="{ disabled: action.disabled, loading: action.loading }"
          :disabled="action.disabled || action.loading"
          @click="handleQuickAction(action)"
          :title="action.label"
        >
          <svg v-if="action.icon === 'play'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
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
          <svg v-else-if="action.icon === 'lightbulb'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18h6"></path>
            <path d="M10 22h4"></path>
            <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"></path>
          </svg>
          <svg v-else-if="action.icon === 'brain'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2a5 5 0 0 0-5 5v2a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5z"></path>
            <path d="M12 22c-4 0-7-3-7-7V9c0-1 1-2 2-2h10c1 0 2 1 2 2v6c0 4-3 7-7 7z"></path>
            <path d="M8 11h8"></path>
            <path d="M8 15h8"></path>
          </svg>
          <svg v-else-if="action.icon === 'compare'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
            <path d="M3 3v18"></path>
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
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { startTask } from '../api/task.js'
import {
  getButlerWelcomeMessage,
  processButlerInput,
  getResponseForAction,
  getQuickActions
} from '../mock/butlerData'

const props = defineProps({
  task: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['control-workflow', 'view-workflow', 'task-started', 'view-progress', 'show-diff'])

const { t } = useI18n()

const messages = ref([])
const inputText = ref('')
const messagesRef = ref(null)
const starting = ref(false)

// Check if task can be started
const canStart = computed(() => {
  return props.task && props.task.status === 'TODO' && !starting.value
})

// Check if task has a workflow to view
const hasWorkflow = computed(() => {
  return props.task && props.task.workflow_run_id
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

// Quick actions - use getQuickActions from butlerData
const quickActions = computed(() => {
  return getQuickActions(props.task, null)
})

// Handle view progress button click
const handleViewProgress = () => {
  if (hasWorkflow.value) {
    emit('view-progress', {
      taskId: props.task.id,
      workflowRunId: props.task.workflow_run_id
    })
  }
}

// Format timestamp
const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', {
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

// Add assistant message with delay
const addAssistantMessage = (content, delay = 300) => {
  setTimeout(() => {
    messages.value.push({
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content,
      timestamp: new Date().toISOString()
    })
    scrollToBottom()
  }, delay)
}

// Start task via real API
const doStartTask = async () => {
  if (!canStart.value) return

  starting.value = true

  try {
    const response = await startTask(props.task.id)
    if (response.success) {
      emit('task-started', response.data)
    } else {
      addAssistantMessage(`❌ 启动失败: ${response.message || '未知错误'}`)
    }
  } catch (error) {
    const msg = error.message || '网络错误'
    addAssistantMessage(`❌ 启动失败: ${msg}`)
  } finally {
    starting.value = false
  }
}

// Send message
const sendMessage = () => {
  if (!inputText.value.trim() || !props.task) return

  const input = inputText.value.trim()

  messages.value.push({
    id: `user-${Date.now()}`,
    role: 'user',
    content: input,
    timestamp: new Date().toISOString()
  })
  inputText.value = ''
  scrollToBottom()

  // Check for start command
  if (input.includes('启动') || input.includes('开始')) {
    if (canStart.value) {
      doStartTask()
      return
    }
  }

  // Check for progress command
  if (input.includes('进度') || input.includes('状态')) {
    if (hasWorkflow.value) {
      addAssistantMessage('正在打开工作流进度面板...')
      handleViewProgress()
      return
    }
  }

  // Fall back to mock butler responses for other interactions
  const result = processButlerInput(input, props.task, null)
  addAssistantMessage(result.response)

  // Emit control actions for non-start actions
  if (['pause', 'continue', 'stop', 'retry'].includes(result.action)) {
    emit('control-workflow', {
      action: result.action,
      taskId: props.task.id
    })
  }
}

// Handle quick action button click
const handleQuickAction = (action) => {
  if (action.disabled || action.loading || !props.task) return

  if (action.action === 'start') {
    doStartTask()
    return
  }

  if (action.action === 'progress') {
    handleViewProgress()
    return
  }

  // Other actions: add to chat and use mock response
  messages.value.push({
    id: `user-${Date.now()}`,
    role: 'user',
    content: action.label,
    timestamp: new Date().toISOString()
  })
  scrollToBottom()

  // Get response for action
  const result = getResponseForAction(action.action, props.task, null)

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

    // Emit show-diff event for diff action
    if (action.action === 'diff') {
      emit('show-diff', {
        taskId: props.task.id,
        projectId: props.task.project_id,
        worktreeBranch: props.task.worktree_branch
      })
    }
  }, 300)
}

// Watch for task changes
watch(() => props.task, (newTask, oldTask) => {
  if (newTask && (!oldTask || newTask.id !== oldTask.id)) {
    messages.value = []
    const welcomeMsg = getButlerWelcomeMessage(newTask.title)
    messages.value.push(welcomeMsg)
    scrollToBottom()
  } else if (!newTask) {
    messages.value = []
  }
}, { immediate: true })

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

.workflow-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-primary, #ffffff);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #6366f1;
  margin-left: auto;
}

.workflow-btn:hover:not(.disabled) {
  background: var(--bg-tertiary, #f1f5f9);
  border-color: #6366f1;
}

.workflow-btn.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  color: var(--text-muted, #94a3b8);
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

.quick-action-btn:hover:not(.disabled):not(.loading) {
  background: var(--bg-tertiary, #f1f5f9);
  border-color: var(--primary-color, #6366f1);
}

.quick-action-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.quick-action-btn.loading {
  opacity: 0.7;
  cursor: wait;
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
