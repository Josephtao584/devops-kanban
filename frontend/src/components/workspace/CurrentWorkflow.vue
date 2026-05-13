<template>
  <div class="current-workflow-section" :class="{ 'is-embedded': embedded, 'is-collapsed': collapsed }">
    <div v-if="!embedded" class="panel-header">
      <h4>当前工作流</h4>
      <span v-if="workflowName" class="current-wf-badge">{{ workflowName }}</span>
      <span v-else-if="loading" class="current-wf-badge">加载中...</span>
    </div>

    <div class="workflow-timeline">
      <div v-if="!taskId" class="workflow-empty">请选择任务</div>
      <div v-else-if="loading" class="workflow-empty">加载中...</div>
      <div v-else-if="error" class="workflow-empty">{{ error }}</div>
      <div v-else-if="!steps.length" class="workflow-empty">暂无工作流运行</div>
      <template v-else>
        <!-- Timeline meta row: start / end / duration -->
        <div class="timeline-meta">
          <span class="timeline-meta-item">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="12" cy="12" r="9"></circle>
              <polyline points="12 7 12 12 15 14"></polyline>
            </svg>
            <span class="timeline-meta-label">开始</span>
            <span>{{ timelineMeta.startText || '--' }}</span>
          </span>
          <span class="timeline-meta-item">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span class="timeline-meta-label">完成</span>
            <span>{{ timelineMeta.endText || '--' }}</span>
          </span>
          <span class="timeline-meta-item">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span class="timeline-meta-label">用时</span>
            <span>{{ timelineMeta.durationText || '--' }}</span>
          </span>
        </div>

        <!-- Horizontal step timeline -->
        <div class="workflow-steps">
          <div
            v-for="(step, index) in steps"
            :key="step.id || index"
            class="workflow-step-h"
          >
            <div v-if="index > 0" class="step-connector-h" :class="{ active: step.statusClass === 'done' || step.statusClass === 'running' }"></div>
            <div class="step-node-wrap">
              <div
                class="step-node-h"
                :class="[step.statusClass, { selected: selectedStepId === step.id }]"
                @click="handleStepClick(step)"
              >
                <div class="step-indicator">
                  <svg v-if="step.statusClass === 'done'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <svg v-else-if="step.statusClass === 'running'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="spin-svg">
                    <line x1="12" y1="2" x2="12" y2="6"></line>
                    <line x1="12" y1="18" x2="12" y2="22"></line>
                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                    <line x1="2" y1="12" x2="6" y2="12"></line>
                    <line x1="18" y1="12" x2="22" y2="12"></line>
                    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                  </svg>
                  <svg v-else-if="step.statusClass === 'failed'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                  <span v-else class="step-index">{{ index + 1 }}</span>
                </div>
                <div class="step-content-h">
                  <span class="step-name-h">{{ step.name }}</span>
                  <span class="step-agent-h">{{ step.statusLabel }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <div class="quick-actions">
      <el-tooltip :content="startTooltip" :disabled="!startDisabled" placement="top">
        <button
          class="quick-action-btn"
          :disabled="startDisabled || actionLoading"
          @click="handleStart"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          启动
        </button>
      </el-tooltip>
      <el-tooltip content="切换工作流模板" placement="top">
        <button class="quick-action-btn" :disabled="actionLoading" @click="handleTemplate">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          模板
        </button>
      </el-tooltip>
      <el-tooltip :content="retryTooltip" :disabled="!retryDisabled" placement="top">
        <button
          class="quick-action-btn quick-action-retry"
          :disabled="retryDisabled || actionLoading"
          @click="handleRetry"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
          </svg>
          重试
        </button>
      </el-tooltip>
      <el-tooltip :content="cancelTooltip" :disabled="!cancelDisabled" placement="top">
        <button
          class="quick-action-btn quick-action-cancel"
          :disabled="cancelDisabled || actionLoading"
          @click="handleCancel"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          取消
        </button>
      </el-tooltip>
      <el-tooltip content="确认继续" placement="top">
        <button
          class="quick-action-btn quick-action-confirm"
          :disabled="confirmDisabled || actionLoading"
          @click="handleConfirm"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          确认
        </button>
      </el-tooltip>
      <el-tooltip v-if="pendingSplitCount > 0" :content="`${pendingSplitCount} 条 AI 拆分建议待确认`" placement="top">
        <button class="quick-action-btn quick-action-split" :disabled="actionLoading" @click="emit('show-split-suggestions')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93L12 22"></path>
            <path d="M8 6a4 4 0 0 1 4-4"></path>
            <circle cx="18" cy="18" r="3"></circle>
            <path d="M18 15v-3l2-2"></path>
          </svg>
          AI 拆分建议
          <span class="quick-action-badge">{{ pendingSplitCount }}</span>
        </button>
      </el-tooltip>
      <button class="quick-action-btn" :disabled="!taskId || actionLoading" @click="handleRefresh">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
        </svg>
        刷新
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getTask, startTask } from '../../api/task.js'
import { getWorkflowRun, cancelWorkflow, retryWorkflow } from '../../api/workflow.js'
import { useWorkflowRunPolling } from '../../composables/kanban/useWorkflowRunPolling.js'

const props = defineProps({
  taskId: { type: Number, default: null },
  embedded: { type: Boolean, default: false },
  collapsed: { type: Boolean, default: false },
  pendingSplitCount: { type: Number, default: 0 }
})

const emit = defineEmits(['refresh', 'run-update', 'step-select', 'open-template', 'show-split-suggestions', 'confirm'])

const task = ref(null)
const run = ref(null)
const loading = ref(false)
const error = ref(null)
const actionLoading = ref(false)
const selectedStepId = ref(null)

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
  return list.map((step, index) => ({
    id: step.step_id || step.id || index,
    step_id: step.step_id,
    name: step.name || step.step_id || `步骤 ${index + 1}`,
    statusClass: STATUS_CLASS[step.status] || 'pending',
    statusLabel: STATUS_LABEL[step.status] || step.status || '待执行',
    session_id: step.session_id || null,
    provider_session_id: step.provider_session_id || null,
    status: step.status,
    assembled_prompt: step.assembled_prompt || '',
    agent_id: step.agent_id || null,
    raw: step
  }))
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
  if (task.value.workflow_run_id && !isTerminal.value) return '工作流已在运行'
  return ''
})

const retryDisabled = computed(() => {
  if (!run.value) return true
  return runStatus.value !== 'FAILED' && runStatus.value !== 'CANCELLED'
})
const retryTooltip = computed(() => {
  if (!run.value) return '暂无工作流运行'
  if (!retryDisabled.value) return ''
  return '仅失败或已取消的工作流可重试'
})

const cancelDisabled = computed(() => {
  if (!run.value) return true
  return isTerminal.value
})
const cancelTooltip = computed(() => {
  if (!run.value) return '暂无工作流运行'
  if (isTerminal.value) return '工作流已结束'
  return ''
})

const confirmDisabled = computed(() => {
  if (!run.value) return true
  return runStatus.value !== 'SUSPENDED'
})
const confirmTooltip = computed(() => {
  if (!run.value) return '暂无工作流运行'
  if (runStatus.value === 'SUSPENDED') return ''
  return '仅暂停状态的工作流可确认'
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

function handleTemplate() {
  emit('open-template', 'switch')
}

async function loadTask(id) {
  if (!id) {
    task.value = null
    return null
  }
  try {
    const resp = await getTask(id)
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
    const resp = await getWorkflowRun(runId)
    if (resp?.success) {
      run.value = resp.data || null
    } else {
      run.value = null
      error.value = resp?.message || '加载工作流失败'
    }
  } catch (e) {
    run.value = null
    error.value = e?.message || '加载工作流失败'
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
    const resp = await retryWorkflow(runId)
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
    const resp = await cancelWorkflow(runId)
    if (resp?.success) {
      ElMessage.success('工作流已取消')
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

watch(isWorkflowTerminal, (terminal) => {
  if (terminal) {
    stopPolling()
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

.timeline-meta {
  display: flex;
  align-items: center;
  gap: 18px;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.timeline-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.timeline-meta-item svg {
  color: var(--accent-color);
  flex-shrink: 0;
}

.timeline-meta-label {
  color: var(--text-muted);
  margin-right: 2px;
}

.workflow-steps {
  display: flex;
  align-items: center;
  gap: 0;
  overflow-x: auto;
  padding: 2px 0;
}

.workflow-step-h {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.step-connector-h {
  width: 40px;
  height: 2px;
  background: var(--border-color);
  margin: 0 8px;
  flex-shrink: 0;
  transition: background 0.2s;
}

.step-connector-h.active {
  background: var(--accent-color);
}

.step-node-wrap {
  position: relative;
  display: inline-block;
}

.step-node-h {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px 4px 4px;
  border-radius: 999px;
  background: transparent;
  white-space: nowrap;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background 0.15s ease, box-shadow 0.15s ease;
}

.step-node-h:hover {
  background: var(--bg-secondary);
}

.step-node-h.selected {
  background: var(--bg-secondary);
  box-shadow: inset 0 0 0 1px var(--accent-color);
}

.step-indicator {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--bg-secondary);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  border: 1.5px solid var(--border-color);
}

.step-node-h.done .step-indicator {
  background: var(--accent-color);
  color: #fff;
  border-color: var(--accent-color);
}

.step-node-h.running .step-indicator {
  background: #fff;
  color: var(--accent-color);
  border-color: var(--accent-color);
}

.step-node-h.failed .step-indicator {
  background: #ef4444;
  color: #fff;
  border-color: #ef4444;
}

.step-node-h.suspended .step-indicator {
  background: #fff;
  color: #d97706;
  border-color: #d97706;
  animation: pulse-suspend 2s ease-in-out infinite;
}

.step-node-h.suspended {
  background: #fffbeb;
  border-color: #fbbf24;
}

@keyframes pulse-suspend {
  0%, 100% { box-shadow: 0 0 0 0 rgba(217, 119, 6, 0.3); }
  50% { box-shadow: 0 0 0 4px rgba(217, 119, 6, 0); }
}

.step-index {
  display: inline-block;
  line-height: 1;
}

.spin-svg {
  animation: spin 1.2s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.step-content-h {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.step-name-h {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.step-agent-h {
  font-size: 11px;
  color: var(--text-muted);
}

.step-node-h.done .step-agent-h {
  color: var(--accent-color);
}

.step-node-h.failed .step-agent-h {
  color: #ef4444;
}

.step-node-h.suspended .step-agent-h {
  color: #d97706;
}

.quick-actions {
  display: flex;
  gap: 8px;
  padding: 10px 20px;
  flex-shrink: 0;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.quick-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.quick-action-btn:hover:not(:disabled) {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: #fff;
}

.quick-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.quick-action-btn.quick-action-cancel {
  color: #dc2626;
  border-color: #fecaca;
  background: #fef2f2;
}

.quick-action-btn.quick-action-cancel:hover:not(:disabled) {
  background: #dc2626;
  border-color: #dc2626;
  color: #fff;
}

.quick-action-btn.quick-action-split {
  color: var(--accent-color-strong, #25c6c9);
  border-color: var(--accent-color-soft, rgba(37, 198, 201, 0.3));
  background: var(--accent-color-soft, rgba(37, 198, 201, 0.08));
}

.quick-action-btn.quick-action-split:hover:not(:disabled) {
  background: var(--accent-color, #25c6c9);
  border-color: var(--accent-color, #25c6c9);
  color: #fff;
}

.quick-action-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 5px;
  margin-left: 4px;
  font-size: 10px;
  font-weight: 700;
  background: currentColor;
  color: #fff !important;
  border-radius: 8px;
}

.quick-action-btn.quick-action-split .quick-action-badge {
  background: var(--accent-color, #25c6c9);
  color: #fff !important;
}

.quick-action-btn.quick-action-retry {
  color: #059669;
  border-color: #a7f3d0;
  background: #ecfdf5;
}

.quick-action-btn.quick-action-retry:hover:not(:disabled) {
  background: #059669;
  border-color: #059669;
  color: #fff;
}

.quick-action-btn.quick-action-confirm {
  color: #d97706;
  border-color: #fde68a;
  background: #fffbeb;
}

.quick-action-btn.quick-action-confirm:hover:not(:disabled) {
  background: #d97706;
  border-color: #d97706;
  color: #fff;
}
</style>
