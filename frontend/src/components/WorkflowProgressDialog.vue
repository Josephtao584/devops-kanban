<template>
  <BaseDialog
    v-model="visible"
    :title="dialogTitle"
    width="960px"
    :body-padding="false"
    custom-class="workflow-progress-dialog"
    @close="handleClose"
    @opened="startPolling"
  >
    <div v-if="loading && !run" class="loading-state">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载中...</span>
    </div>

    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <el-button size="small" @click="fetchRun">重试</el-button>
    </div>

    <div v-else-if="run" class="progress-layout">
      <div class="progress-sidebar">
        <div class="overall-status">
          <span class="run-status" :class="statusClass">
            {{ statusIcon }} {{ statusText }}
          </span>
          <span class="run-time" v-if="run.created_at">
            {{ formatTime(run.created_at) }}
          </span>
        </div>

        <div class="steps-list">
          <template v-for="step in run.steps" :key="step.step_id">
            <div
              class="step-item"
              :class="[stepStatusClass(step), { selected: selectedStep?.step_id === step.step_id, clickable: !!step.session_id }]"
              :data-step-id="step.step_id"
              @click="handleSelectStep(step)"
            >
              <div class="step-icon">
                <span v-if="step.status === 'COMPLETED'">✓</span>
                <span v-else-if="step.status === 'FAILED'">✗</span>
                <span v-else-if="step.status === 'CANCELLED'">⊘</span>
                <el-icon v-else-if="isStepRunning(step)" class="is-loading"><Loading /></el-icon>
                <span v-else>○</span>
              </div>
              <div class="step-info">
                <span class="step-name">{{ step.name }}</span>
                <span class="step-status-text">{{ stepStatusText(step) }}</span>
                <span v-if="step.session_id" class="step-session-id">Session #{{ step.session_id }}</span>
              </div>
            </div>
          </template>
        </div>
      </div>

      <div class="progress-detail">
        <div v-if="run.status === 'COMPLETED' && run.context?.approved !== undefined" class="result-section">
          <div class="result-badge" :class="run.context.approved ? 'approved' : 'rejected'">
            {{ run.context.approved ? '✓ 审查通过' : '✗ 审查未通过' }}
          </div>
          <p v-if="run.context.comments" class="result-comments">{{ run.context.comments }}</p>
        </div>

        <div v-if="run.status === 'FAILED' && run.context?.error" class="error-section">
          <p class="error-text">{{ run.context.error }}</p>
        </div>

        <!-- AskUserQuestion suspended state -->
        <div v-if="run.status === 'SUSPENDED' && suspendedStep && isAskUserSuspended" class="suspend-section ask-user-section">
          <div class="suspend-header ask-user-header">
            <span>AI 提出了问题</span>
          </div>
          <div class="ask-user-questions">
            <div v-for="(q, idx) in suspendedStep.ask_user_question.questions" :key="idx" class="ask-user-question">
              <div v-if="q.header" class="ask-user-q-header">{{ q.header }}</div>
              <div class="ask-user-q-text">{{ q.question }}</div>
              <div v-if="q.options?.length" class="ask-user-options">
                <button
                  v-for="opt in q.options"
                  :key="opt.label"
                  class="ask-user-option-btn"
                  :class="{ selected: askUserAnswer === (opt.value || opt.label) }"
                  @click="askUserAnswer = opt.value || opt.label"
                >
                  {{ opt.label }}
                </button>
              </div>
              <div v-else class="ask-user-input">
                <textarea
                  v-model="askUserAnswer"
                  placeholder="请输入你的回答..."
                  rows="3"
                />
              </div>
            </div>
          </div>
          <div class="suspend-actions">
            <el-button type="primary" @click="handleAnswerSubmit" :disabled="!askUserAnswer">
              提交回答
            </el-button>
            <el-button @click="handleResume(false)">
              取消工作流
            </el-button>
          </div>
        </div>

        <!-- Confirmation suspended state (existing) -->
        <div v-else-if="run.status === 'SUSPENDED' && suspendedStep" class="suspend-section">
          <div class="suspend-header">
            <el-icon class="suspend-icon"><Loading /></el-icon>
            <span>步骤需要确认</span>
          </div>
          <div class="suspend-info">
            <div class="suspend-step-name">
              <strong>{{ suspendedStep.name }}</strong>
            </div>
            <div v-if="suspendedStep.suspend_reason" class="suspend-reason">
              {{ suspendedStep.suspend_reason }}
            </div>
            <div v-if="suspendedStep.summary" class="suspend-summary">
              <div class="summary-label">执行摘要：</div>
              <div class="summary-content">{{ suspendedStep.summary }}</div>
            </div>
          </div>
          <div class="suspend-actions">
            <el-button type="primary" @click="handleResume(true)">
              确认继续
            </el-button>
            <el-button type="danger" @click="handleResume(false)">
              取消工作流
            </el-button>
          </div>
        </div>

        <StepSessionPanel
          v-if="selectedStep?.session_id"
          :session-id="selectedStep.session_id"
          :step-name="selectedStep.name"
          :initial-message="askUserAnswer"
          :workflow-run-id="workflowRunId"
        />
        <div v-else class="detail-empty">当前步骤暂无会话记录</div>
      </div>
    </div>

    <template #footer>
      <el-button
        v-if="canCancel"
        type="danger"
        size="small"
        @click="handleCancel"
        :disabled="cancelling"
      >
        {{ cancelling ? '取消中...' : '取消工作流' }}
      </el-button>
      <el-button size="small" @click="fetchRun" :disabled="loading">
        {{ loading ? '刷新中...' : '刷新' }}
      </el-button>
    </template>
  </BaseDialog>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import BaseDialog from './BaseDialog.vue'
import { getWorkflowRun, cancelWorkflow, resumeWorkflow } from '../api/workflow.js'
import StepSessionPanel from './workflow/StepSessionPanel.vue'
import { ElMessageBox, ElMessage } from 'element-plus'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  taskId: {
    type: [Number, String],
    default: null
  },
  workflowRunId: {
    type: [Number, String],
    default: null
  },
  taskTitle: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue', 'workflow-completed'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const run = ref(null)
const loading = ref(false)
const error = ref(null)
const cancelling = ref(false)
const selectedStepId = ref(null)
const selectionMode = ref('auto')
const askUserAnswer = ref('')
let pollTimer = null

const dialogTitle = computed(() => `工作流进度${props.taskTitle ? ' - ' + props.taskTitle : ''}`)

const statusClass = computed(() => {
  if (!run.value) return ''
  return `status-${run.value.status.toLowerCase()}`
})

const statusIcon = computed(() => {
  if (!run.value) return ''
  const icons = { PENDING: '⏳', RUNNING: '▶', SUSPENDED: '⏸', COMPLETED: '✓', FAILED: '✗', CANCELLED: '⊘' }
  return icons[run.value.status] || ''
})

const statusText = computed(() => {
  if (!run.value) return ''
  const texts = { PENDING: '等待中', RUNNING: '运行中', SUSPENDED: '等待确认', COMPLETED: '已完成', FAILED: '失败', CANCELLED: '已取消' }
  return texts[run.value.status] || run.value.status
})

const canCancel = computed(() => run.value && (run.value.status === 'RUNNING' || run.value.status === 'PENDING' || run.value.status === 'SUSPENDED'))
const isTerminal = computed(() => run.value && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(run.value.status))

// Find suspended step info
const suspendedStep = computed(() => {
  if (!run.value?.steps?.length || run.value.status !== 'SUSPENDED') return null
  return run.value.steps.find((step) => step.status === 'SUSPENDED') || null
})

const isAskUserSuspended = computed(() => {
  return suspendedStep.value?.ask_user_question?.questions?.length > 0
})

const selectedStep = computed(() => {
  if (!run.value?.steps?.length) return null
  return run.value.steps.find((step) => step.step_id === selectedStepId.value) || null
})

function pickDefaultStep(steps = []) {
  return steps.find((step) => step.status === 'RUNNING')
    || [...steps].reverse().find((step) => step.session_id)
    || steps[0]
    || null
}

function syncSelectedStep() {
  const steps = run.value?.steps || []
  const currentStep = steps.find((step) => step.step_id === selectedStepId.value)

  if (selectionMode.value === 'manual' && currentStep) {
    return
  }

  const nextStep = pickDefaultStep(steps)
  selectedStepId.value = nextStep?.step_id || null
  selectionMode.value = 'auto'
}

function handleSelectStep(step) {
  selectedStepId.value = step.step_id
  selectionMode.value = 'manual'
}

function stepStatusClass(step) {
  if (isStepRunning(step)) return 'step-running'
  if (step.status === 'SUSPENDED') return 'step-suspended'
  return `step-${String(step.status || '').toLowerCase()}`
}

function isStepRunning(step) {
  return step.status === 'RUNNING'
}

function stepStatusText(step) {
  const texts = { PENDING: '待处理', RUNNING: '进行中', SUSPENDED: '等待确认', COMPLETED: '已完成', FAILED: '失败', CANCELLED: '已取消' }
  return texts[step.status] || step.status
}

function formatTime(isoStr) {
  if (!isoStr) return ''
  return new Date(isoStr).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function isResumableRun(runData) {
  return runData?.status === 'SUSPENDED' && Array.isArray(runData.steps) && runData.steps.some((step) => step.status === 'SUSPENDED')
}

async function handleAnswerSubmit() {
  if (!askUserAnswer.value?.trim() || !props.workflowRunId) return
  try {
    const response = await resumeWorkflow(props.workflowRunId, {
      approved: true,
      ask_user_answer: askUserAnswer.value.trim(),
    })
    if (response.success) {
      ElMessage.success('回答已提交')
      askUserAnswer.value = ''
      await fetchRun()
    } else {
      ElMessage.error(response.message || '提交失败')
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.message || err.message || '提交失败')
  }
}

async function handleResume(approved) {
  if (!props.workflowRunId) return

  try {
    const { value: comment } = await ElMessageBox.prompt(
      approved ? '确认继续执行工作流？' : '确认取消工作流？',
      approved ? '确认继续' : '确认取消',
      {
        confirmButtonText: approved ? '确认继续' : '确认取消',
        cancelButtonText: '返回',
        inputPlaceholder: '可输入备注（可选）',
        type: 'info'
      }
    ).catch(() => ({ value: null }))

    if (comment === null && !approved) return

    const latest = await getWorkflowRun(props.workflowRunId)
    if (!latest.success) {
      ElMessage.error(latest.message || '获取工作流状态失败')
      return
    }

    run.value = latest.data
    syncSelectedStep()

    if (approved && !isResumableRun(latest.data)) {
      ElMessage.warning('当前工作流还未进入可继续状态，请刷新后重试')
      return
    }

    const resumeData = { approved, comment: comment || undefined }
    const response = await resumeWorkflow(props.workflowRunId, resumeData)

    if (response.success) {
      ElMessage.success(approved ? '工作流已继续执行' : '工作流已取消')
      await fetchRun()
    } else {
      ElMessage.error(response.message || '操作失败')
    }
  } catch (err) {
    if (err === 'cancel' || err === 'close') return
    ElMessage.error(err.response?.data?.message || err.message || '操作失败')
  }
}

async function fetchRun() {
  if (!props.workflowRunId) return
  loading.value = true
  error.value = null
  try {
    const response = await getWorkflowRun(props.workflowRunId)
    if (response.success) {
      const prevStatus = run.value?.status
      run.value = response.data
      syncSelectedStep()
      if (prevStatus && prevStatus !== 'COMPLETED' && run.value.status === 'COMPLETED') {
        emit('workflow-completed', run.value)
      }
      if (isTerminal.value) {
        stopPolling()
      }
    } else {
      error.value = response.message || '获取工作流状态失败'
    }
  } catch (err) {
    error.value = err.response?.data?.message || err.message || '网络错误'
  } finally {
    loading.value = false
  }
}

async function handleCancel() {
  if (!props.workflowRunId) return
  cancelling.value = true
  try {
    await cancelWorkflow(props.workflowRunId)
    await fetchRun()
  } finally {
    cancelling.value = false
  }
}

function startPolling() {
  fetchRun()
  stopPolling()
  pollTimer = setInterval(() => {
    if (!isTerminal.value) {
      fetchRun()
    } else {
      stopPolling()
    }
  }, 3000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function handleClose() {
  stopPolling()
  emit('update:modelValue', false)
}

onBeforeUnmount(() => {
  stopPolling()
})

watch(() => props.workflowRunId, () => {
  run.value = null
  error.value = null
  selectedStepId.value = null
  selectionMode.value = 'auto'
  askUserAnswer.value = ''
})

watch(suspendedStep, (newStep) => {
  if (newStep?.ask_user_question) {
    askUserAnswer.value = ''
  }
})
</script>

<style scoped>
.loading-state,
.error-state,
.detail-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 0;
  color: var(--text-muted, #94a3b8);
}

.error-state {
  flex-direction: column;
  color: #ef4444;
}

.progress-layout {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 16px;
  min-height: 420px;
}

.progress-sidebar,
.progress-detail {
  min-width: 0;
}

.overall-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-tertiary, #f1f5f9);
  border-radius: 8px;
  margin-bottom: 16px;
}

.run-status { font-weight: 600; font-size: 14px; }
.run-status.status-pending { color: #6b7280; }
.run-status.status-running { color: #3b82f6; }
.run-status.status-suspended { color: #f59e0b; }
.run-status.status-completed { color: #10b981; }
.run-status.status-failed { color: #ef4444; }
.run-status.status-cancelled { color: #f59e0b; }
.run-time { font-size: 12px; color: var(--text-muted, #94a3b8); }

.steps-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.step-item {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #fff;
}

.step-item.step-suspended {
  border-color: #f59e0b;
  background: #fffbeb;
}

.step-item.step-suspended .step-icon {
  color: #f59e0b;
}

.step-item.clickable {
  cursor: pointer;
}

.step-item.selected {
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.15);
  background: #eff6ff;
}

.step-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #f8fafc;
}

.step-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.step-name { font-size: 13px; font-weight: 600; color: #0f172a; }
.step-status-text { font-size: 12px; color: #64748b; }
.step-session-id { font-size: 11px; color: #25C6C9; font-weight: 500; margin-left: 6px; }

.suspend-section {
  background: #fffbeb;
  border: 1px solid #fbbf24;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.suspend-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #d97706;
  margin-bottom: 12px;
}

.suspend-icon {
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.suspend-info {
  margin-bottom: 16px;
}

.suspend-step-name {
  font-size: 14px;
  margin-bottom: 8px;
}

.suspend-reason {
  font-size: 13px;
  color: #92400e;
  background: #fef3c7;
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 8px;
}

.suspend-summary {
  margin-top: 12px;
}

.summary-label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}

.summary-content {
  font-size: 13px;
  color: #374151;
  background: #f9fafb;
  padding: 8px 12px;
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}

.suspend-actions {
  display: flex;
  gap: 12px;
}

.ask-user-section {
  background: #eff6ff;
  border-color: #93c5fd;
}

.ask-user-header {
  color: #1d4ed8;
}

.ask-user-questions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.ask-user-q-header {
  font-size: 13px;
  font-weight: 600;
  color: #1e40af;
  margin-bottom: 4px;
}

.ask-user-q-text {
  font-size: 14px;
  color: #1e3a5f;
  line-height: 1.6;
}

.ask-user-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.ask-user-option-btn {
  padding: 6px 16px;
  border-radius: 8px;
  border: 2px solid #93c5fd;
  background: #fff;
  color: #1d4ed8;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.ask-user-option-btn:hover {
  background: #dbeafe;
}

.ask-user-option-btn.selected {
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
}

.ask-user-input textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #93c5fd;
  border-radius: 8px;
  font-size: 13px;
  resize: vertical;
  outline: none;
}

.ask-user-input textarea:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}
</style>
