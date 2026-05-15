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

        <!-- Agent roster -->
        <div class="agent-roster">
          <div
            v-for="step in steps"
            :key="step.id"
            class="agent-card"
            :class="[step.statusClass, { selected: selectedStepId === step.id }]"
            @click="handleStepClick(step)"
          >
            <!-- Agent identity header -->
            <div class="agent-card-header">
              <div
                class="agent-avatar"
                :style="{ background: getStepRoleConfig(step).gradient }"
              >
                <span v-html="getStepRoleConfig(step).icon" class="agent-avatar-icon"></span>
              </div>
              <div class="agent-card-info">
                <span class="agent-card-name">{{ getStepAgentName(step) }}</span>
                <span class="agent-card-executor">{{ getStepAgentLabel(step) || '—' }}</span>
              </div>
              <span class="agent-status-badge" :class="step.statusClass">
                {{ step.statusLabel }}
              </span>
            </div>

            <!-- Step name -->
            <div class="agent-step-name-row">
              <span class="agent-step-status-dot" :class="step.statusClass"></span>
              <span class="agent-step-name">{{ step.name }}</span>
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
      <el-tooltip content="切换AgentTeam模板" placement="top">
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
      <el-tooltip v-if="hasSplitStep" :content="splitButtonTooltip" placement="top">
        <button class="quick-action-btn quick-action-split" :disabled="actionLoading" @click="emit('show-split-suggestions')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3l1.6 4.6a3 3 0 0 0 1.8 1.8L20 11l-4.6 1.6a3 3 0 0 0-1.8 1.8L12 19l-1.6-4.6a3 3 0 0 0-1.8-1.8L4 11l4.6-1.6a3 3 0 0 0 1.8-1.8z"></path>
            <path d="M19 3v3"></path>
            <path d="M20.5 4.5h-3"></path>
            <path d="M5 18v3"></path>
            <path d="M6.5 19.5h-3"></path>
          </svg>
          拆分建议
          <span v-if="pendingSplitCount > 0" class="quick-action-badge">{{ pendingSplitCount }}</span>
        </button>
      </el-tooltip>
      <button class="quick-action-btn" :disabled="!taskId || actionLoading" @click="handleRefresh">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
        </svg>
        刷新
      </button>
      <label class="quick-action-btn quick-action-autoretry" :title="autoRetry ? '已开启自动重试：AgentTeam失败时将自动重新执行' : '已关闭自动重试'">
        <input type="checkbox" v-model="autoRetry" class="autoretry-check" />
        <span class="autoretry-box"></span>
        <span class="autoretry-label">自动重试</span>
      </label>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getTask, startTask } from '../../api/task.js'
import { getWorkflowRun, cancelWorkflow, retryWorkflow } from '../../api/workflow.js'
import { useWorkflowRunPolling } from '../../composables/kanban/useWorkflowRunPolling.js'
import { getRoleConfig } from '../../constants/agent.js'
import { useAgentStore } from '../../stores/agentStore.js'

const agentStore = useAgentStore()

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

watch(autoRetry, (enabled) => {
  emit('auto-retry-change', enabled)
})

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

function resolveAgentInfo(agentId) {
  if (!agentId) return null
  const agent = agentStore.agents.find(a => a.id === agentId || String(a.id) === String(agentId))
  if (!agent) return null
  const roleConfig = getRoleConfig(agent.role || 'BACKEND_DEV')
  return { agent, roleConfig }
}

const EXECUTOR_LABEL = { CLAUDE_CODE: 'Claude Code', OPEN_CODE: 'OpenCode' }

function getStepAgentLabel(step) {
  if (!step.agent_id) return ''
  const info = resolveAgentInfo(step.agent_id)
  return info?.agent.executorType ? EXECUTOR_LABEL[info.agent.executorType] || info.agent.executorType : ''
}

function getStepAgentName(step) {
  if (!step.agent_id) return '未分配'
  const info = resolveAgentInfo(step.agent_id)
  return info?.agent.name || '未分配'
}

function getStepRoleConfig(step) {
  if (!step.agent_id) return getRoleConfig('BACKEND_DEV')
  const info = resolveAgentInfo(step.agent_id)
  return info?.roleConfig || getRoleConfig('BACKEND_DEV')
}

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

/* Agent Roster Container */
.agent-roster {
  display: flex;
  gap: 0;
  overflow-x: auto;
  padding: 8px 0 12px;
  align-items: stretch;
}

.agent-roster::-webkit-scrollbar {
  height: 4px;
}
.agent-roster::-webkit-scrollbar-track {
  background: transparent;
}
.agent-roster::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 2px;
}

/* Connector between cards */
.agent-card-wrapper {
  display: flex;
  align-items: stretch;
  flex-shrink: 0;
}

.agent-card-wrapper + .agent-card-wrapper::before {
  content: '';
  width: 28px;
  flex-shrink: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='20' viewBox='0 0 28 20'%3E%3Cpath d='M0 10h20M16 5l5 5-5 5' stroke='%23d7e6de' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
  position: relative;
  z-index: 1;
}

.agent-card-wrapper.has-done + .agent-card-wrapper::before {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='20' viewBox='0 0 28 20'%3E%3Cpath d='M0 10h20M16 5l5 5-5 5' stroke='%2325C6C9' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
}

.agent-card-wrapper.has-running + .agent-card-wrapper::before {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='20' viewBox='0 0 28 20'%3E%3Cpath d='M0 10h20M16 5l5 5-5 5' stroke='%2325C6C9' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3Ccircle cx='10' cy='10' r='2' fill='%2325C6C9'%3E%3Canimate attributeName='cx' values='2;26;2' dur='2s' repeatCount='indefinite'/%3E%3Canimate attributeName='opacity' values='1;0;1' dur='2s' repeatCount='indefinite'/%3E%3C/circle%3E%3C/svg%3E");
}

/* Agent Card */
.agent-card {
  min-width: 140px;
  max-width: 160px;
  flex-shrink: 0;
  border-radius: 14px;
  border: 1.5px solid var(--border-color);
  background: var(--bg-primary);
  overflow: hidden;
  transition: all 0.3s ease;
  scroll-snap-align: start;
  cursor: pointer;
  position: relative;
}

.agent-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(37, 198, 201, 0.12);
  border-color: var(--accent-color);
}

.agent-card.selected {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px rgba(37, 198, 201, 0.2);
}

.agent-card.running {
  border-color: var(--accent-color);
  animation: card-glow 2s ease-in-out infinite;
}

@keyframes card-glow {
  0%, 100% { box-shadow: 0 0 8px rgba(37, 198, 201, 0.15); }
  50% { box-shadow: 0 0 20px rgba(37, 198, 201, 0.3), 0 0 40px rgba(37, 198, 201, 0.1); }
}

.agent-card.done {
  opacity: 0.75;
}

.agent-card.failed {
  border-color: var(--danger-strong);
}

/* Agent Card Header */
.agent-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 10px 8px;
}

.agent-avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 18px;
  line-height: 1;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: relative;
}

.agent-card.running .agent-avatar {
  animation: avatar-pulse 2s ease-in-out infinite;
}

@keyframes avatar-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}

.agent-avatar-icon {
  font-style: normal;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
}

.agent-card-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.agent-card-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.agent-card-executor {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Agent Status Badge */
.agent-status-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 999px;
  white-space: nowrap;
  flex-shrink: 0;
}

.agent-status-badge.done {
  background: var(--done-soft);
  color: var(--done-strong);
}
.agent-status-badge.running {
  background: var(--in-progress-soft);
  color: var(--in-progress-strong);
}
.agent-status-badge.failed {
  background: var(--danger-soft);
  color: var(--danger-strong);
}
.agent-status-badge.suspended {
  background: var(--warning-soft);
  color: var(--warning-strong);
}
.agent-status-badge.pending {
  background: var(--neutral-soft);
  color: var(--neutral-strong);
}

/* Step name row */
.agent-step-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px 8px;
  border-top: 1px solid var(--border-color);
}

.agent-step-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.agent-step-status-dot.done {
  background: var(--accent-color);
}
.agent-step-status-dot.running {
  background: #fbbf24;
  animation: dot-pulse 1.2s ease-in-out infinite;
}
.agent-step-status-dot.failed {
  background: #ef4444;
}
.agent-step-status-dot.suspended {
  background: #d97706;
}
.agent-step-status-dot.pending {
  background: var(--text-muted);
  opacity: 0.4;
}

@keyframes dot-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.5); }
}

.agent-step-name {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

.quick-action-autoretry {
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
  user-select: none;
}

.quick-action-autoretry:hover {
  background: var(--bg-secondary);
}

.autoretry-check {
  display: none;
}

.autoretry-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: 1.5px solid var(--border-color);
  border-radius: 3px;
  background: var(--bg-primary);
  transition: all 0.15s;
  flex-shrink: 0;
}

.autoretry-check:checked + .autoretry-box {
  background: var(--accent-color);
  border-color: var(--accent-color);
}

.autoretry-check:checked + .autoretry-box::after {
  content: '✓';
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.autoretry-label {
  font-size: 12px;
  font-weight: 600;
}
</style>
