<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    width="960px"
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

        <StepSessionPanel
          v-if="selectedStep?.session_id"
          :session-id="selectedStep.session_id"
          :step-name="selectedStep.name"
        />
        <div v-else class="detail-empty">当前步骤暂无会话记录</div>
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
import StepSessionPanel from './workflow/StepSessionPanel.vue'

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
let pollTimer = null

const dialogTitle = computed(() => `工作流进度${props.taskTitle ? ' - ' + props.taskTitle : ''}`)

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

const canCancel = computed(() => run.value && (run.value.status === 'RUNNING' || run.value.status === 'PENDING'))
const isTerminal = computed(() => run.value && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(run.value.status))

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
  return `step-${String(step.status || '').toLowerCase()}`
}

function isStepRunning(step) {
  return step.status === 'RUNNING'
}

function stepStatusText(step) {
  const texts = { PENDING: '待处理', RUNNING: '进行中', COMPLETED: '已完成', FAILED: '失败', CANCELLED: '已取消' }
  return texts[step.status] || step.status
}

function formatTime(isoStr) {
  if (!isoStr) return ''
  return new Date(isoStr).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
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
})
</script>

<style scoped>
.workflow-progress-dialog :deep(.el-dialog__body) {
  padding: 16px 20px;
}

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

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
