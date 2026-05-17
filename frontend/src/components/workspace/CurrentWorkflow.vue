<template>
  <div class="current-workflow-section" :class="{ 'is-embedded': embedded, 'is-collapsed': collapsed }">
    <div v-if="!embedded" class="panel-header">
      <h4>当前AgentTeam</h4>
      <span v-if="workflowName" class="current-wf-badge">{{ workflowName }}</span>
      <span v-else-if="loading" class="current-wf-badge">加载中...</span>
    </div>

    <div class="workflow-timeline">
      <div v-if="!taskId" class="workflow-empty">请选择任务</div>
      <div v-else-if="loading" class="workflow-empty">加载中...</div>
      <div v-else-if="error" class="workflow-empty">{{ error }}</div>
      <div v-else-if="!steps.length" class="workflow-empty">暂无AgentTeam运行</div>
      <WorkflowStepCards
        v-else
        :steps="steps"
        :selected-step-id="selectedStepId"
        :timeline-meta="timelineMeta"
        @step-select="handleStepClick"
      />
    </div>

    <WorkflowQuickActions
      :task-id="taskId"
      :action-loading="actionLoading"
      :start-disabled="startDisabled"
      :start-tooltip="startTooltip"
      :retry-disabled="retryDisabled"
      :retry-tooltip="retryTooltip"
      :cancel-disabled="cancelDisabled"
      :cancel-tooltip="cancelTooltip"
      :confirm-disabled="confirmDisabled"
      :confirm-tooltip="confirmTooltip"
      :has-split-step="hasSplitStep"
      :split-button-tooltip="splitButtonTooltip"
      :pending-split-count="pendingSplitCount"
      :auto-retry="autoRetry"
      @start="handleStart"
      @template="handleTemplate"
      @retry="handleRetry"
      @cancel="handleCancel"
      @confirm="handleConfirm"
      @refresh="handleRefresh"
      @show-split-suggestions="emit('show-split-suggestions')"
      @auto-retry-change="handleAutoRetryChange"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useTaskStore } from '../../stores/taskStore.js'
import { useWorkflowStore } from '../../stores/workflowStore.js'
import { useWorkflowRunPolling } from '../../composables/kanban/useWorkflowRunPolling.js'
import WorkflowQuickActions from './WorkflowQuickActions.vue'
import WorkflowStepCards from './WorkflowStepCards.vue'

const taskStore = useTaskStore()
const workflowStore = useWorkflowStore()

const props = defineProps({
  taskId: { type: Number, default: null },
  embedded: { type: Boolean, default: false },
  collapsed: { type: Boolean, default: false },
  pendingSplitCount: { type: Number, default: 0 }
})

const emit = defineEmits(['refresh', 'run-update', 'step-select', 'open-template', 'show-split-suggestions', 'confirm', 'workflow-completed', 'auto-retry-change'])

const task = ref(null)
const run = ref(null)
const loading = ref(false)
const error = ref(null)
const actionLoading = ref(false)
const selectedStepId = ref(null)
const autoRetry = ref(false)

const isWorkflowTerminal = computed(() => {
  const status = run.value?.status
  return status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED' || status === 'DONE'
})

async function fetchWorkflowRun() {
  if (!task.value?.workflow_run_id) return
  await loadRun(task.value.workflow_run_id)
}

const { startPolling, stopPolling } = useWorkflowRunPolling({
  fetchFn: fetchWorkflowRun,
  isTerminal: () => isWorkflowTerminal.value,
  interval: 5000,
})

const STATUS_CLASS = {
  DONE: 'done',
  COMPLETED: 'done',
  IN_PROGRESS: 'running',
  RUNNING: 'running',
  FAILED: 'failed',
  CANCELLED: 'failed',
  SUSPENDED: 'suspended',
  PENDING: 'pending'
}

const STATUS_LABEL = {
  DONE: '已完成',
  COMPLETED: '已完成',
  IN_PROGRESS: '执行中',
  RUNNING: '执行中',
  FAILED: '失败',
  CANCELLED: '已取消',
  SUSPENDED: '暂停',
  PENDING: '待执行'
}

const workflowName = computed(() => {
  return run.value?.workflow_template_snapshot?.name
    || run.value?.workflow_id
    || null
})

const steps = computed(() => {
  const list = run.value?.steps || []
  const templateSteps = run.value?.workflow_template_snapshot?.steps || []
  const templateAgentMap = new Map()
  for (const ts of templateSteps) {
    if (ts.agentId != null) templateAgentMap.set(ts.id || ts.step_id, ts.agentId)
  }

  return list.map((step, index) => {
    const resolvedAgentId = step.agent_id
      ?? templateAgentMap.get(step.step_id)
      ?? null
    return {
      id: step.step_id || step.id || index,
      step_id: step.step_id,
      name: step.name || step.step_id || `步骤 ${index + 1}`,
      statusClass: STATUS_CLASS[step.status] || 'pending',
      statusLabel: STATUS_LABEL[step.status] || step.status || '待执行',
      session_id: step.session_id || null,
      provider_session_id: step.provider_session_id || null,
      status: step.status,
      assembled_prompt: step.assembled_prompt || '',
      agent_id: resolvedAgentId,
      raw: step
    }
  })
})

// Show the 拆分建议 button whenever the workflow includes a SPLIT_TASK step,
// even before any suggestions exist — user can click to manually trigger.
// Fall back to step name matching for legacy runs that don't carry step.type.
const hasSplitStep = computed(() => {
  const templateSteps = run.value?.workflow_template_snapshot?.steps || []
  if (templateSteps.some(s => s?.type === 'SPLIT_TASK')) return true
  const runSteps = run.value?.steps || []
  if (runSteps.some(s => s?.type === 'SPLIT_TASK')) return true
  // Legacy fallback: step name contains "拆分" / "split"
  return runSteps.some(s => {
    const name = (s?.name || '').toLowerCase()
    return name.includes('拆分') || name.includes('split')
  })
})

const splitButtonTooltip = computed(() => {
  if (props.pendingSplitCount > 0) return `${props.pendingSplitCount} 条拆分建议待确认`
  return '查看 / 编辑拆分建议'
})

function formatDateTime(input) {
  if (!input) return ''
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDuration(ms) {
  if (!ms || ms < 0) return ''
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const parts = []
  if (hours) parts.push(`${hours}小时`)
  if (minutes) parts.push(`${minutes}分`)
  parts.push(`${seconds}秒`)
  return parts.join('')
}

const timelineMeta = computed(() => {
  const r = run.value
  if (!r) return { startText: '', endText: '', durationText: '' }
  // Start time: prefer run-level started_at, else earliest step started_at, else created_at.
  const stepStarts = (r.steps || []).map(s => s.started_at).filter(Boolean)
  const startRaw = r.started_at || r.start_time
    || (stepStarts.length ? stepStarts.sort()[0] : null)
    || r.created_at
  // End time: prefer run-level completed_at, else last step's completed_at when the run is terminal.
  const isTerminalStatus = ['COMPLETED', 'DONE', 'FAILED', 'CANCELLED'].includes(r.status)
  const stepEnds = (r.steps || []).map(s => s.completed_at).filter(Boolean)
  const endRaw = r.completed_at || r.ended_at || r.finished_at || r.end_time
    || (isTerminalStatus && stepEnds.length ? stepEnds.sort().slice(-1)[0] : null)
  const startText = formatDateTime(startRaw)
  const endText = formatDateTime(endRaw)
  let durationText = ''
  if (startRaw && endRaw) {
    durationText = formatDuration(new Date(endRaw).getTime() - new Date(startRaw).getTime())
  }
  return { startText, endText, durationText }
})

const runStatus = computed(() => run.value?.status || null)
const isTerminal = computed(() => {
  const s = runStatus.value
  return s === 'COMPLETED' || s === 'FAILED' || s === 'CANCELLED'
})

const startDisabled = computed(() => {
  if (!task.value) return true
  return Boolean(task.value.workflow_run_id) && !isTerminal.value
})
const startTooltip = computed(() => {
  if (!task.value) return '请选择任务'
  if (task.value.workflow_run_id && !isTerminal.value) return 'AgentTeam已在运行'
  return ''
})

const retryDisabled = computed(() => {
  if (!run.value) return true
  return runStatus.value !== 'FAILED' && runStatus.value !== 'CANCELLED'
})
const retryTooltip = computed(() => {
  if (!run.value) return '暂无AgentTeam运行'
  if (!retryDisabled.value) return ''
  return '仅失败或已取消的AgentTeam可重试'
})

const cancelDisabled = computed(() => {
  if (!run.value) return true
  return isTerminal.value
})
const cancelTooltip = computed(() => {
  if (!run.value) return '暂无AgentTeam运行'
  if (isTerminal.value) return 'AgentTeam已结束'
  return ''
})

const confirmDisabled = computed(() => {
  if (!run.value) return true
  return runStatus.value !== 'SUSPENDED'
})
const confirmTooltip = computed(() => {
  if (!run.value) return '暂无AgentTeam运行'
  if (runStatus.value === 'SUSPENDED') return ''
  return '仅暂停状态的AgentTeam可确认'
})

function handleConfirm() {
  if (confirmDisabled.value) return
  emit('confirm', {
    workflowRunId: task.value?.workflow_run_id,
    taskId: props.taskId,
  })
}

function handleStepClick(step) {
  selectedStepId.value = step.id
  emit('step-select', step)
}

function handleAutoRetryChange(enabled) {
  autoRetry.value = enabled
}

function handleTemplate() {
  emit('open-template', 'switch')
}

async function loadTask(id) {
  if (!id) {
    task.value = null
    return null
  }
  try {
    const resp = await taskStore.getTask(id)
    if (resp?.success) {
      task.value = resp.data || null
      return task.value
    }
  } catch (e) {}
  return null
}

async function loadRun(runId) {
  if (!runId) {
    run.value = null
    return
  }
  try {
    const resp = await workflowStore.getWorkflowRun(runId)
    if (resp?.success) {
      run.value = resp.data || null
    } else {
      run.value = null
      error.value = resp?.message || '加载AgentTeam失败'
    }
  } catch (e) {
    run.value = null
    error.value = e?.message || '加载AgentTeam失败'
  }
}

async function load() {
  error.value = null
  run.value = null
  stopPolling()
  if (!props.taskId) {
    task.value = null
    return
  }
  loading.value = true
  try {
    const t = await loadTask(props.taskId)
    if (t?.workflow_run_id) {
      await loadRun(t.workflow_run_id)
      if (!isWorkflowTerminal.value) {
        startPolling()
      }
    }
  } finally {
    loading.value = false
  }
}

async function handleStart() {
  if (!props.taskId) return
  // Always go through the parent to open the workflow start editor:
  // - If task has no template, parent shows template picker first.
  // - Otherwise parent loads the configured template and opens the editor for review.
  emit('open-template', task.value?.auto_execute_template_id ? 'start-with-template' : 'start')
}

async function handleRetry() {
  const runId = task.value?.workflow_run_id
  if (!runId) return
  actionLoading.value = true
  try {
    const resp = await workflowStore.retryWorkflow(runId)
    if (resp?.success) {
      ElMessage.success('已发起重试')
      await load()
      emit('refresh')
    } else {
      ElMessage.error(resp?.message || '重试失败')
    }
  } catch (e) {
    ElMessage.error(e?.message || '重试失败')
  } finally {
    actionLoading.value = false
  }
}

async function handleCancel() {
  const runId = task.value?.workflow_run_id
  if (!runId) return
  actionLoading.value = true
  try {
    const resp = await workflowStore.cancelWorkflow(runId)
    if (resp?.success) {
      ElMessage.success('AgentTeam已取消')
      await load()
      emit('refresh')
    } else {
      ElMessage.error(resp?.message || '取消失败')
    }
  } catch (e) {
    ElMessage.error(e?.message || '取消失败')
  } finally {
    actionLoading.value = false
  }
}

async function handleRefresh() {
  await load()
  emit('refresh')
}

watch(run, (newRun) => {
  emit('run-update', newRun)
}, { immediate: true })

watch(() => props.taskId, () => {
  selectedStepId.value = null
  load()
}, { immediate: true })

watch(isWorkflowTerminal, (terminal, prevTerminal) => {
  if (terminal && !prevTerminal) {
    stopPolling()
    emit('workflow-completed')
  }
})

defineExpose({ workflowName })
</script>

<style scoped>
.current-workflow-section {
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  flex-shrink: 0;
}

.current-workflow-section.is-embedded {
  background: transparent;
}

.panel-header {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  background: var(--bg-primary);
}

.panel-header h4 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 0.02em;
}

.current-wf-badge {
  font-size: 11px;
  color: var(--accent-color);
  background: var(--accent-color-soft);
  padding: 2px 8px;
  border-radius: 10px;
  margin-left: auto;
}

.workflow-timeline {
  padding: 12px 20px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.workflow-empty {
  padding: 12px 4px;
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
}
</style>
