<template>
  <template v-if="timeline.length">
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
      <template v-for="(item, idx) in timeline" :key="item.kind === 'separator' ? `sep-${item.runId}` : `step-${item.runId}-${item.step.id}-${idx}`">
        <div
          v-if="item.kind === 'separator'"
          class="run-separator"
          data-test="run-separator"
        >
          <div class="run-separator-arrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 14l-4-4 4-4"></path>
              <path d="M5 10h11a4 4 0 0 1 0 8h-1"></path>
            </svg>
          </div>
          <div class="run-separator-text">
            {{
              t('workflow.loopSeparator', {
                fromStep: separatorFromStepName(item),
                failedStep: separatorFailedStepName(item)
              })
            }}
            <el-tooltip
              v-if="item.loopFailureContext?.error"
              :content="item.loopFailureContext.error"
              placement="top"
            >
              <span class="run-separator-info" aria-label="loop failure error">i</span>
            </el-tooltip>
          </div>
        </div>
        <div v-else class="agent-card-wrapper">
          <div class="agent-step-index">{{ formatStepIndex(item) }}</div>
          <div
            class="agent-card"
            :class="[item.step.statusClass, { selected: selectedStepId === item.step.id }]"
            data-test="step-card"
            @click="handleStepClick(item.step)"
          >
            <div class="agent-card-top">
              <div class="agent-avatar">
                <span v-html="getStepRoleConfig(item.step).icon" class="agent-avatar-icon"></span>
              </div>
              <div class="agent-card-info">
                <div class="agent-card-name">{{ getStepAgentName(item.step) }}</div>
                <div v-if="getStepAgentLabel(item.step)" class="agent-card-executor">{{ getStepAgentLabel(item.step) }}</div>
              </div>
              <span class="agent-status-dot" :class="item.step.statusClass"></span>
            </div>
            <div class="agent-card-footer">
              <span class="agent-step-name" :title="item.step.name">{{ item.step.name }}</span>
              <span class="agent-step-status" :class="item.step.statusClass">{{ item.step.statusLabel }}</span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </template>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { getRoleConfig } from '../../constants/agent.js'
import { getExecutorLabel } from '../../constants/executor.js'
import { useAgentStore } from '../../stores/agentStore.js'

const { t } = useI18n()
const agentStore = useAgentStore()

const props = defineProps({
  // Legacy single-run input (still supported for callers that haven't switched).
  steps: { type: Array, default: () => [] },
  // New input: list of runs ordered chronologically.
  runs: { type: Array, default: () => [] },
  selectedStepId: { type: [Number, String], default: null },
  timelineMeta: { type: Object, default: () => ({ startText: '', endText: '', durationText: '' }) }
})

const emit = defineEmits(['step-select'])

const STATUS_CLASS = {
  DONE: 'done',
  COMPLETED: 'done',
  IN_PROGRESS: 'running',
  RUNNING: 'running',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
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

function decorateStep(rawStep, index, run) {
  // Steps coming from CurrentWorkflow.vue are already decorated; runs from the
  // /runs?task_id=X endpoint contain the raw entity shape, so we normalize here
  // to a unified rendering shape.
  if (rawStep && typeof rawStep.statusClass === 'string') {
    return rawStep
  }
  const step = rawStep || {}
  // Pre-assigned agent from the template snapshot. Lets us show the assigned
  // agent on PENDING steps before any session exists, and on every iteration
  // of a loop. Falls back to the runtime session-bound agent_id when the
  // template snapshot isn't available (legacy runs).
  const templateSteps = run?.workflow_template_snapshot?.steps || []
  const templateStep = templateSteps.find(
    (s) => s.id === step.step_id || s.step_id === step.step_id
  )
  const assignedAgentId = templateStep?.agentId ?? step.agent_id ?? null
  return {
    id: step.step_id || step.id || index,
    step_id: step.step_id || null,
    name: step.name || step.step_id || `步骤 ${index + 1}`,
    statusClass: STATUS_CLASS[step.status] || 'pending',
    statusLabel: STATUS_LABEL[step.status] || step.status || '待执行',
    session_id: step.session_id || null,
    provider_session_id: step.provider_session_id || null,
    status: step.status,
    assembled_prompt: step.assembled_prompt || '',
    agent_id: assignedAgentId,
    raw: step
  }
}

const timeline = computed(() => {
  const items = []
  if (Array.isArray(props.runs) && props.runs.length) {
    // Build the loop chain: walk back from the latest run via parent_run_id.
    // Only runs reachable from the latest run via parent_run_id are rendered.
    // Unrelated runs (e.g. earlier cancelled or independently restarted runs)
    // are excluded so the panel doesn't stack disconnected step lists.
    const byId = new Map(props.runs.map((r) => [r.id, r]))
    const latest = props.runs[props.runs.length - 1]
    const chain = []
    const seen = new Set()
    let cursor = latest
    while (cursor && !seen.has(cursor.id)) {
      seen.add(cursor.id)
      chain.unshift(cursor) // earliest first
      if (cursor.parent_run_id == null) break
      const parent = byId.get(cursor.parent_run_id)
      if (!parent) break
      cursor = parent
    }

    chain.forEach((run, runIdx) => {
      if (runIdx > 0 && run.parent_run_id != null) {
        const parentRun = byId.get(run.parent_run_id)
        items.push({
          kind: 'separator',
          runId: run.id,
          iteration: run.iteration,
          loopedFromStepId: run.looped_from_step_id,
          loopFailureContext: run.loop_failure_context,
          prevRunId: run.parent_run_id,
          prevSteps: Array.isArray(parentRun?.steps) ? parentRun.steps : []
        })
      }
      const runSteps = Array.isArray(run.steps) ? run.steps : []
      runSteps.forEach((step, index) => {
        if (step?.status === 'SKIPPED') return
        items.push({
          kind: 'step',
          runId: run.id,
          iteration: run.iteration,
          stepIndex: index,
          step: decorateStep(step, index, run)
        })
      })
    })
    return items
  }

  // Legacy single-run path: render the prepared `steps` array.
  const legacy = Array.isArray(props.steps) ? props.steps : []
  legacy.forEach((step, index) => {
    items.push({
      kind: 'step',
      runId: null,
      iteration: 1,
      stepIndex: index,
      step: decorateStep(step, index)
    })
  })
  return items
})

function formatStepIndex(item) {
  return String((item.stepIndex ?? 0) + 1).padStart(2, '0')
}

function separatorFromStepName(item) {
  if (!item.loopedFromStepId) return t('workflow.loopSeparatorUnknownStep')
  const fromStep = item.prevSteps.find((s) => s.step_id === item.loopedFromStepId)
  return fromStep?.name || item.loopedFromStepId
}

function separatorFailedStepName(item) {
  const failedId = item.loopFailureContext?.failed_step_id
  if (!failedId) return t('workflow.loopSeparatorUnknownStep')
  const failedStep = item.prevSteps.find((s) => s.step_id === failedId)
  return failedStep?.name || failedId
}

function resolveAgentInfo(agentId) {
  if (!agentId) return null
  const agent = agentStore.agents.find(a => a.id === agentId || String(a.id) === String(agentId))
  if (!agent) return null
  const roleConfig = getRoleConfig(agent.role || 'BACKEND_DEV')
  return { agent, roleConfig }
}

function getStepAgentLabel(step) {
  if (!step.agent_id) return ''
  const info = resolveAgentInfo(step.agent_id)
  return getExecutorLabel(info?.agent?.executorType)
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

function handleStepClick(step) {
  emit('step-select', step)
}
</script>

<style scoped>
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
  gap: 16px;
  overflow-x: auto;
  padding: 4px 2px 10px;
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

.agent-card-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.agent-card-wrapper + .agent-card-wrapper::before {
  content: '';
  position: absolute;
  left: -16px;
  top: 50%;
  width: 16px;
  height: 1px;
  background: var(--border-color);
}

.run-separator {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px dashed #c7d2fe;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(99, 102, 241, 0.02));
  color: #4338ca;
  font-size: 11.5px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
  align-self: center;
}

.run-separator-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #6366f1;
  flex-shrink: 0;
}

.run-separator-text {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.run-separator-info {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #6366f1;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  font-family: serif;
  cursor: help;
}

.agent-step-index {
  position: absolute;
  top: -2px;
  left: 12px;
  font-size: 10px;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.08em;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  background: var(--bg-primary);
  padding: 0 4px;
  z-index: 2;
  pointer-events: none;
}

/* Agent Card */
.agent-card {
  position: relative;
  width: 200px;
  flex-shrink: 0;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background:
    linear-gradient(135deg, rgba(37, 198, 201, 0.04) 0%, rgba(255, 255, 255, 0) 60%),
    linear-gradient(180deg, #ffffff 0%, #fcfdfd 100%);
  overflow: hidden;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
  cursor: pointer;
  display: flex;
  flex-direction: column;
}

.agent-card:hover {
  border-color: var(--accent-color);
  box-shadow: 0 4px 12px rgba(37, 198, 201, 0.10);
  transform: translateY(-1px);
}

.agent-card.selected {
  background:
    linear-gradient(135deg, rgba(37, 198, 201, 0.10) 0%, rgba(37, 198, 201, 0.02) 60%),
    linear-gradient(180deg, #ffffff 0%, #fcfdfd 100%);
}

/* Card top: avatar + name/executor + status dot in one row */
.agent-card-top {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
}

.agent-avatar {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.agent-card.selected .agent-avatar {
  background: var(--accent-color-soft);
  color: var(--accent-color-strong);
  border-color: transparent;
}

.agent-avatar-icon {
  display: inline-flex;
  width: 16px;
  height: 16px;
}

.agent-avatar-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.agent-card-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.agent-card-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.01em;
  line-height: 1.3;
}

.agent-card-executor {
  font-size: 11.5px;
  color: var(--text-muted);
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

/* Status dot (top-right, very subtle) */
.agent-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.agent-status-dot.done {
  background: var(--accent-color);
}

.agent-status-dot.running {
  background: #10b981;
  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5);
  animation: dot-running 1.6s ease-in-out infinite;
}

@keyframes dot-running {
  0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.55); }
  50% { box-shadow: 0 0 0 5px rgba(16, 185, 129, 0); }
}

.agent-status-dot.failed {
  background: var(--danger-strong);
}

.agent-status-dot.cancelled {
  background: var(--text-muted);
}

.agent-status-dot.suspended {
  background: #f59e0b;
}

.agent-status-dot.pending {
  background: transparent;
  border: 1px solid var(--border-color);
}

/* Card footer: step name + status */
.agent-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 14px;
  border-top: 1px solid var(--border-color);
  background: linear-gradient(180deg, rgba(37, 198, 201, 0.025), rgba(37, 198, 201, 0.06));
}

.agent-step-name {
  font-size: 10.5px;
  font-weight: 500;
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.agent-step-status {
  font-size: 9.5px;
  font-weight: 600;
  color: var(--text-muted);
  white-space: nowrap;
  letter-spacing: 0.02em;
}

.agent-step-status.done { color: var(--accent-color-strong); }
.agent-step-status.running { color: #10b981; }
.agent-step-status.failed { color: var(--danger-strong); }
.agent-step-status.cancelled { color: var(--text-muted); }
.agent-step-status.suspended { color: #b45309; }
</style>
