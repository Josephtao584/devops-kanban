<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    width="500px"
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
        <div
          v-for="step in run.steps"
          :key="step.step_id"
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
          <div class="step-time" v-if="step.completed_at">
            {{ formatTime(step.completed_at) }}
          </div>
        </div>
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
          :loading="cancelling"
        >
          取消工作流
        </el-button>
        <el-button size="small" @click="fetchRun" :loading="loading">
          刷新
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
  return `step-${step.status.toLowerCase()}`
}

function isStepRunning(step) {
  // A step is "running" if the workflow is running and this is the current step
  if (!run.value || run.value.status !== 'RUNNING') return false
  return step.status === 'PENDING' && run.value.current_step === step.step_id
}

function stepStatusText(step) {
  if (isStepRunning(step)) return '进行中'
  const texts = { PENDING: '待处理', COMPLETED: '已完成', FAILED: '失败' }
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

/* Steps */
.steps-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 6px;
  transition: background 0.2s;
}

.step-item:hover {
  background: var(--bg-tertiary, #f8fafc);
}

.step-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.step-pending .step-icon {
  background: rgba(107, 114, 128, 0.1);
  color: #6b7280;
}

.step-completed .step-icon {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.step-failed .step-icon {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.step-info {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.step-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary, #1e293b);
}

.step-status-text {
  font-size: 12px;
  color: var(--text-muted, #94a3b8);
}

.step-completed .step-status-text { color: #10b981; }
.step-failed .step-status-text { color: #ef4444; }

.step-time {
  font-size: 11px;
  color: var(--text-muted, #94a3b8);
  flex-shrink: 0;
}

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
