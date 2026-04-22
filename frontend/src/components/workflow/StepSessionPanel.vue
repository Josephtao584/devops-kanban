<template>
  <div class="step-session-panel step-session-panel--chat" :class="{ 'step-session-panel--no-header': !showHeader }">
    <div v-if="showHeader" class="panel-header">
      <div class="panel-heading">
        <div class="panel-title-row">
          <div>
            <div class="panel-title">{{ stepName || '步骤会话' }}</div>
          </div>
          <div class="panel-status" :class="statusClass">{{ sessionStatusText }}</div>
        </div>
      </div>
    </div>

    <div v-if="!sessionId" class="panel-state panel-empty">
      <div class="panel-state-title">暂无会话记录</div>
      <div class="panel-state-text">当前步骤还没有生成可查看的执行会话。</div>
    </div>
    <div v-else-if="error" class="panel-state panel-error">
      <div class="panel-state-title">加载失败</div>
      <div class="panel-state-text">{{ error.message || error }}</div>
    </div>
    <div v-else-if="isLoading" class="panel-state panel-loading">
      <div class="panel-state-title">加载中...</div>
      <div class="panel-state-text">正在获取会话事件。</div>
    </div>
    <div v-else-if="events.length === 0" class="panel-state panel-empty">
      <div class="panel-state-title">暂无事件</div>
      <div class="panel-state-text">这里会显示该步骤的执行输出和对话记录。</div>
    </div>
    <div v-else class="panel-events-wrapper">
      <div v-if="showPrompt && props.assembledPrompt" class="prompt-panel">
        <div class="prompt-panel-header">
          <span class="prompt-panel-title">{{ $t('chat.promptContent') }}</span>
          <el-button size="small" text @click="copyPrompt">{{ $t('chat.copy') }}</el-button>
        </div>
        <div class="prompt-panel-content">
          <pre>{{ props.assembledPrompt }}</pre>
        </div>
      </div>
      <div ref="eventsContainer" class="panel-events panel-events--chat">
        <template v-for="event in displayedEvents" :key="event.id ?? event.seq">
          <!-- Interactive AskUserQuestion rendering -->
          <div v-if="event.kind === 'ask_user'" class="event-ask-user-panel">
            <div class="event-ask-user-header">AI 提问</div>
            <div class="event-ask-user-question">
              <div v-if="event.payload?.ask_user_question?.questions?.[0]?.header" class="event-ask-user-q-header">
                {{ event.payload.ask_user_question.questions[0].header }}
              </div>
              <div class="event-ask-user-q-text">
                {{ event.payload.ask_user_question.questions[0]?.question || event.content }}
              </div>
              <div v-if="event.payload?.ask_user_question?.questions?.[0]?.options?.length" class="event-ask-user-options">
                <button
                  v-for="opt in event.payload.ask_user_question.questions[0].options"
                  :key="opt.label"
                  class="event-ask-user-option-btn"
                  @click="fillAnswer(opt.value || opt.label)"
                >
                  {{ opt.label }}
                </button>
              </div>
            </div>
          </div>
          <!-- All other events use SessionEventRenderer -->
          <SessionEventRenderer
            v-else
            :event="event"
          />
        </template>
      </div>
      <div class="panel-toolbar">
        <el-button
          size="small"
          :type="showPrompt ? 'primary' : 'default'"
          plain
          @click="togglePrompt"
          :disabled="!props.assembledPrompt"
        >
          {{ showPrompt ? $t('chat.collapsePrompt') : $t('chat.viewPrompt') }}
        </el-button>
        <label class="auto-scroll-check" @click.prevent="toggleAutoScroll">
          <span class="check-box" :class="{ checked: autoScrollEnabled }">
            <svg v-if="autoScrollEnabled" width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2.5 2.5L8 3" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <span class="check-label">自动滚动</span>
        </label>
        <label class="auto-scroll-check" @click.prevent="hideToolMessages = !hideToolMessages">
          <span class="check-box" :class="{ checked: hideToolMessages }">
            <svg v-if="hideToolMessages" width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2.5 2.5L8 3" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <span class="check-label">隐藏工具消息</span>
        </label>
        <label class="auto-scroll-check" @click.prevent="hideThinkingMessages = !hideThinkingMessages">
          <span class="check-box" :class="{ checked: hideThinkingMessages }">
            <svg v-if="hideThinkingMessages" width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2.5 2.5L8 3" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <span class="check-label">隐藏思考过程</span>
        </label>
      </div>
    </div>

    <div v-if="sessionId && canInput" class="panel-input">
      <div class="panel-input-shell">
        <input
          ref="messageInput"
          v-model="message"
          @keyup.enter="sendMessage"
          placeholder="继续追问或补充要求..."
          :disabled="isBusy || isSending"
        />
        <button @click="sendMessage" :disabled="!message.trim() || isBusy || isSending">
          {{ isBusy ? '处理中...' : (isSending ? '发送中...' : '发送') }}
        </button>
      </div>
    </div>
    <div v-else-if="sessionId" class="panel-readonly-hint">
      当前步骤暂不支持继续输入，请查看执行结果或切换到可交互步骤。
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import SessionEventRenderer from '../session/SessionEventRenderer.vue'
import { useSessionEvents } from '../../composables/useSessionEvents.js'
import { SESSION_INPUT_STATUSES, SESSION_BUSY_STATUSES } from '../../constants/session.js'
import { getSession, continueSession } from '../../api/session.js'
import { ElMessage } from 'element-plus'

const { t } = useI18n()

const props = defineProps({
  sessionId: {
    type: Number,
    default: null
  },
  stepName: {
    type: String,
    default: ''
  },
  showHeader: {
    type: Boolean,
    default: true
  },
  initialMessage: {
    type: String,
    default: ''
  },
  assembledPrompt: {
    type: String,
    default: ''
  }
})

const { events, isLoading, error, loadInitial, startPolling, stopPolling } = useSessionEvents()
const message = ref('')
const isSending = ref(false)
const sessionStatus = ref('')
const eventsContainer = ref(null)
const autoScrollEnabled = ref(true)
const hideToolMessages = ref(true)
const hideThinkingMessages = ref(true)
const messageInput = ref(null)
const showPrompt = ref(false)

function togglePrompt() {
  showPrompt.value = !showPrompt.value
}

async function copyPrompt() {
  try {
    await navigator.clipboard.writeText(props.assembledPrompt)
    ElMessage.success(t('chat.copySuccess'))
  } catch {
    ElMessage.error(t('chat.copyFailed'))
  }
}

const displayedEvents = computed(() => {
  let result = events.value
  if (hideToolMessages.value) {
    result = result.filter(e => e.kind !== 'tool_call' && e.kind !== 'tool_result')
  }
  if (hideThinkingMessages.value) {
    result = result.filter(e => !e.isThinking)
  }
  return result
})

const canInput = computed(() => SESSION_INPUT_STATUSES.includes(sessionStatus.value))
const isBusy = computed(() => SESSION_BUSY_STATUSES.includes(sessionStatus.value))
const statusClass = computed(() => `status-${(sessionStatus.value || 'pending').toLowerCase()}`)
const sessionStatusText = computed(() => {
  const texts = {
    PENDING: '待开始',
    RUNNING: '进行中',
    STOPPED: '已暂停',
    SUSPENDED: '等待确认',
    COMPLETED: '已完成',
    FAILED: '失败',
    CANCELLED: '已取消'
  }
  return texts[sessionStatus.value] || sessionStatus.value || '待开始'
})

function scrollToBottom() {
  nextTick(() => {
    if (eventsContainer.value && autoScrollEnabled.value) {
      eventsContainer.value.scrollTop = eventsContainer.value.scrollHeight
    }
  })
}

function toggleAutoScroll() {
  autoScrollEnabled.value = !autoScrollEnabled.value
  if (autoScrollEnabled.value) {
    scrollToBottom()
  }
}

async function fetchSessionStatus() {
  if (!props.sessionId) {
    sessionStatus.value = ''
    return
  }
  try {
    const response = await getSession(props.sessionId)
    sessionStatus.value = response.data?.status || ''
  } catch (err) {
    console.error('Failed to fetch session status:', err)
    sessionStatus.value = ''
  }
}

async function sendMessage() {
  if (!message.value.trim() || isSending.value || !props.sessionId) return

  const text = message.value.trim()
  isSending.value = true
  try {
    await continueSession(props.sessionId, text)
    message.value = ''
    await fetchSessionStatus()
    scrollToBottom()
    startPollingWithStatusCheck()
  } catch (err) {
    console.error('Failed to send message:', err)
    ElMessage.error('发送失败: ' + (err.message || err))
  } finally {
    isSending.value = false
  }
}

function startPollingWithStatusCheck() {
  startPolling(props.sessionId, () => false)
}

async function setupSession() {
  stopPolling()

  if (!props.sessionId) {
    sessionStatus.value = ''
    return
  }

  await fetchSessionStatus()
  await loadInitial(props.sessionId)
  scrollToBottom()
  startPollingWithStatusCheck()
}

function fillAnswer(text) {
  message.value = text
  nextTick(() => {
    messageInput.value?.focus()
  })
}

watch(events, () => {
  scrollToBottom()
}, { deep: true })

let statusPollTimer = null
function startStatusPolling() {
  stopStatusPolling()
  statusPollTimer = setInterval(async () => {
    if (props.sessionId && (sessionStatus.value === 'RUNNING' || sessionStatus.value === 'ASK_USER')) {
      await fetchSessionStatus()
    }
  }, 2000)
}

function stopStatusPolling() {
  if (statusPollTimer) {
    clearInterval(statusPollTimer)
    statusPollTimer = null
  }
}

watch(
  () => props.sessionId,
  () => {
    setupSession()
    startStatusPolling()
  },
  { immediate: true }
)

watch(
  () => props.initialMessage,
  (newVal) => {
    if (newVal) {
      message.value = newVal
      nextTick(() => {
        messageInput.value?.focus()
      })
    }
  },
  { immediate: false }
)

onBeforeUnmount(() => {
  stopPolling()
  stopStatusPolling()
})
</script>

<style scoped>
.step-session-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  height: 100%;
  padding: 16px 18px 18px;
  background: #fafafa;
}

.step-session-panel--chat {
  background: linear-gradient(180deg, #f8fafc 0%, rgba(37, 198, 201, 0.04) 100%);
}

.step-session-panel--no-header {
  gap: 10px;
  padding-top: 12px;
}

.panel-header {
  flex-shrink: 0;
}

.panel-heading {
  display: flex;
  flex-direction: column;
}

.panel-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.panel-title {
  font-size: 18px;
  font-weight: 600;
  line-height: 1.35;
  color: #111827;
}

.panel-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}

.panel-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  background: #eceff3;
  color: #4b5563;
}

.panel-status.status-running {
  background: #e8f1ff;
  color: #2563eb;
}

.panel-status.status-completed {
  background: #eaf8f1;
  color: #059669;
}

.panel-status.status-failed,
.panel-status.status-cancelled {
  background: #fdecec;
  color: #dc2626;
}

.panel-status.status-stopped {
  background: #fff4e5;
  color: #d97706;
}

.panel-status.status-suspended {
  background: #fef3c7;
  color: #f59e0b;
}

.panel-state {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 4px;
  min-height: 160px;
  padding: 18px 20px;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #ffffff;
}

.panel-state-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.panel-state-text {
  font-size: 13px;
  line-height: 1.6;
  color: #6b7280;
}

.panel-error {
  border-color: #fecaca;
  background: #fff7f7;
}

.panel-loading .panel-state-title,
.panel-loading .panel-state-text {
  color: #4b5563;
}

.panel-events {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 4px 0;
}

.panel-events--chat {
  gap: 16px;
  padding: 8px 6px 14px;
}

.panel-input {
  flex-shrink: 0;
  padding-top: 8px;
}

.panel-input-shell {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
  background: #ffffff;
}

.panel-input input {
  flex: 1;
  min-width: 0;
  padding: 10px 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: #111827;
}

.panel-input input::placeholder {
  color: #9ca3af;
}

.panel-input button {
  padding: 9px 14px;
  border: none;
  border-radius: 12px;
  background: #111827;
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.15s ease;
}

.panel-input button:hover:not(:disabled) {
  opacity: 0.88;
}

.panel-input button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.panel-events-wrapper {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.panel-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 6px 4px 0;
  gap: 12px;
}

.auto-scroll-check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
  font-size: 13px;
  color: #6b7280;
}

.auto-scroll-check:hover {
  color: #374151;
}

.check-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: 2px solid #d1d5db;
  border-radius: 3px;
  background: #ffffff;
  transition: all 0.15s ease;
}

.check-box.checked {
  background: #25C6C9;
  border-color: #25C6C9;
}

.check-label {
  line-height: 1;
}

.prompt-panel {
  flex-shrink: 0;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #ffffff;
  margin-bottom: 8px;
  overflow: hidden;
}

.prompt-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.prompt-panel-title {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.prompt-panel-content {
  max-height: 400px;
  overflow: auto;
  padding: 12px;
}

.prompt-panel-content pre {
  margin: 0;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: #1e293b;
}

.event-ask-user-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid #93c5fd;
  background: #eff6ff;
}

.event-ask-user-header {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #2563eb;
}

.event-ask-user-question {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.event-ask-user-q-header {
  font-size: 13px;
  font-weight: 600;
  color: #1e40af;
}

.event-ask-user-q-text {
  font-size: 13px;
  color: #1e40af;
  line-height: 1.6;
  white-space: pre-wrap;
}

.event-ask-user-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.event-ask-user-option-btn {
  display: inline-block;
  padding: 4px 12px;
  border: 1px solid #93c5fd;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.event-ask-user-option-btn:hover {
  background: #bfdbfe;
  border-color: #60a5fa;
}

.event-ask-user-option-btn.selected {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}
</style>

