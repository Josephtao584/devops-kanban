<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    width="600px"
    class="workflow-progress-dialog"
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

    <div v-else-if="run" class="progress-content">
      <!-- Overall status -->
      <div class="overall-status">
        <span class="run-status" :class="statusClass">
          {{ statusIcon }} {{ statusText }}
        </span>
        <span class="run-time" v-if="run.created_at">
          {{ formatTime(run.created_at) }}
        </span>
      </div>

      <!-- Steps -->
      <div class="steps-list">
        <template v-for="(step, index) in run.steps" :key="step.step_id">
          <div
            class="step-item"
            :class="stepStatusClass(step)"
          >
            <div class="step-icon">
              <span v-if="step.status === 'COMPLETED'">✓</span>
              <span v-else-if="step.status === 'FAILED'">✗</span>
              <el-icon v-else-if="isStepRunning(step)" class="is-loading"><Loading /></el-icon>
              <span v-else>○</span>
            </div>
            <div class="step-info">
              <span class="step-name">{{ step.name }}</span>
              <span class="step-status-text">{{ stepStatusText(step) }}</span>
            </div>
          </div>
          <!-- Arrow connector between steps -->
          <div v-if="index < run.steps.length - 1" class="step-connector" :class="getConnectorClass(step)">
            →
          </div>
        </template>
      </div>

      <!-- Result context (when completed) -->
      <div v-if="run.status === 'COMPLETED' && run.context?.approved !== undefined" class="result-section">
        <div class="result-badge" :class="run.context.approved ? 'approved' : 'rejected'">
          {{ run.context.approved ? '✓ 审查通过' : '✗ 审查未通过' }}
        </div>
        <p v-if="run.context.comments" class="result-comments">{{ run.context.comments }}</p>
      </div>

      <!-- Error context (when failed) -->
      <div v-if="run.status === 'FAILED' && run.context?.error" class="error-section">
        <p class="error-text">{{ run.context.error }}</p>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
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
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import { getWorkflowRun, cancelWorkflow } from '../api/workflow.js'

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
let pollTimer = null

const dialogTitle = computed(() => {
  return `工作流进度${props.taskTitle ? ' - ' + props.taskTitle : ''}`
})

const statusClass = computed(() => {
  if (!run.value) return ''
  return `status-${run.value.status.toLowerCase()}`
})

const statusIcon = computed(() => {
  if (!run.value) return ''
  const icons = { PENDING: '⏳', RUNNING: '▶', COMPLETED: '✓', FAILED: '✗', CANCELLED: '⊘' }
  return icons[run.value.status] || ''
})

const statusText = computed(() => {
  if (!run.value) return ''
  const texts = { PENDING: '等待中', RUNNING: '运行中', COMPLETED: '已完成', FAILED: '失败', CANCELLED: '已取消' }
  return texts[run.value.status] || run.value.status
})

const canCancel = computed(() => {
  return run.value && (run.value.status === 'RUNNING' || run.value.status === 'PENDING')
})

const isTerminal = computed(() => {
  return run.value && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(run.value.status)
})

function stepStatusClass(step) {
  // If this is the current running step, show as running even if status is PENDING
  if (isStepRunning(step)) {
    return 'step-running'
  }
  return `step-${step.status.toLowerCase()}`
}

function getConnectorClass(step) {
  // If current step is completed, connector is also "completed" style
  if (step.status === 'COMPLETED') return 'connector-completed'
  return 'connector-pending'
}

function isStepRunning(step) {
  return step.status === 'RUNNING'
}

function stepStatusText(step) {
  const texts = { PENDING: '待处理', RUNNING: '进行中', COMPLETED: '已完成', FAILED: '失败' }
  return texts[step.status] || step.status
}

function formatTime(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
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

      // If workflow just completed, emit event
      if (prevStatus && prevStatus !== 'COMPLETED' && run.value.status === 'COMPLETED') {
        emit('workflow-completed', run.value)
      }

      // Stop polling if terminal
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
  } catch (err) {
    console.error('Failed to cancel workflow:', err)
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

// Cleanup on unmount
onBeforeUnmount(() => {
  stopPolling()
})

// Reset when dialog reopens with different run
watch(() => props.workflowRunId, () => {
  run.value = null
  error.value = null
})
</script>

<style scoped>
.workflow-progress-dialog :deep(.el-dialog__body) {
  padding: 16px 20px;
}

.loading-state,
.error-state {
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

/* Overall status */
.overall-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-tertiary, #f1f5f9);
  border-radius: 8px;
  margin-bottom: 16px;
}

.run-status {
  font-weight: 600;
  font-size: 14px;
}

.run-status.status-pending { color: #6b7280; }
.run-status.status-running { color: #3b82f6; }
.run-status.status-completed { color: #10b981; }
.run-status.status-failed { color: #ef4444; }
.run-status.status-cancelled { color: #f59e0b; }

.run-time {
  font-size: 12px;
  color: var(--text-muted, #94a3b8);
}

/* Steps - Horizontal pipeline layout */
.steps-list {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 0;
  overflow-x: auto;
  padding: 8px 0;
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 8px;
  min-width: 100px;
  max-width: 140px;
  flex-shrink: 0;
  transition: all 0.2s;
  border: 2px solid transparent;
  background: #f8fafc;
}

.step-item:hover {
  background: #f1f5f9;
}

/* Step connector arrow */
.step-connector {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  font-size: 16px;
  flex-shrink: 0;
  align-self: center;
}

.connector-pending {
  color: #d1d5db;
}

.connector-completed {
  color: #10b981;
}

/* Step icon */
.step-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
}

/* Pending step */
.step-pending {
  border-color: #e5e7eb;
  background: #f9fafb;
}

.step-pending .step-icon {
  background: rgba(107, 114, 128, 0.1);
  color: #6b7280;
}

.step-pending .step-name {
  color: #6b7280;
}

/* Running step (current executing) */
.step-running {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.05);
  animation: pulse-border 2s infinite;
}

@keyframes pulse-border {
  0%, 100% { border-color: #3b82f6; box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
  50% { border-color: #60a5fa; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0); }
}

.step-running .step-icon {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.step-running .step-name {
  color: #3b82f6;
  font-weight: 600;
}

.step-running .step-status-text {
  color: #3b82f6;
}

/* Completed step */
.step-completed {
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.05);
}

.step-completed .step-icon {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.step-completed .step-name {
  color: #059669;
}

.step-completed .step-status-text {
  color: #10b981;
}

/* Failed step */
.step-failed {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.05);
}

.step-failed .step-icon {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.step-failed .step-name {
  color: #dc2626;
}

.step-failed .step-status-text {
  color: #ef4444;
}

.step-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
}

.step-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary, #1e293b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.step-status-text {
  font-size: 11px;
  color: var(--text-muted, #94a3b8);
}

.step-completed .step-status-text { color: #10b981; }
.step-running .step-status-text { color: #3b82f6; }
.step-failed .step-status-text { color: #ef4444; }

/* Result section */
.result-section {
  margin-top: 16px;
  padding: 12px;
  background: var(--bg-tertiary, #f8fafc);
  border-radius: 8px;
}

.result-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.result-badge.approved {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.result-badge.rejected {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.result-comments {
  margin-top: 8px;
  font-size: 13px;
  color: var(--text-secondary, #64748b);
}

/* Error section */
.error-section {
  margin-top: 16px;
  padding: 12px;
  background: rgba(239, 68, 68, 0.05);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
}

.error-text {
  font-size: 13px;
  color: #ef4444;
  margin: 0;
}

/* Footer */
.dialog-footer {
  display: flex;
  justify-content: space-between;
}
</style>
