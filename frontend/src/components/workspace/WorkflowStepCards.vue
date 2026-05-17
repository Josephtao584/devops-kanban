<template>
  <template v-if="steps.length">
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
        v-for="(step, si) in steps"
        :key="step.id"
        class="agent-card-wrapper"
      >
        <div class="agent-step-index">{{ String(si + 1).padStart(2, '0') }}</div>
        <div
          class="agent-card"
          :class="[step.statusClass, { selected: selectedStepId === step.id }]"
          @click="handleStepClick(step)"
        >
          <div class="agent-card-top">
            <div class="agent-avatar">
              <span v-html="getStepRoleConfig(step).icon" class="agent-avatar-icon"></span>
            </div>
            <div class="agent-card-info">
              <div class="agent-card-name">{{ getStepAgentName(step) }}</div>
              <div v-if="getStepAgentLabel(step)" class="agent-card-executor">{{ getStepAgentLabel(step) }}</div>
            </div>
            <span class="agent-status-dot" :class="step.statusClass"></span>
          </div>
          <div class="agent-card-footer">
            <span class="agent-step-name" :title="step.name">{{ step.name }}</span>
            <span class="agent-step-status" :class="step.statusClass">{{ step.statusLabel }}</span>
          </div>
        </div>
      </div>
    </div>
  </template>
</template>

<script setup>
import { getRoleConfig } from '../../constants/agent.js'
import { useAgentStore } from '../../stores/agentStore.js'

const agentStore = useAgentStore()

const props = defineProps({
  steps: { type: Array, default: () => [] },
  selectedStepId: { type: [Number, String], default: null },
  timelineMeta: { type: Object, default: () => ({ startText: '', endText: '', durationText: '' }) }
})

const emit = defineEmits(['step-select'])

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

.agent-card.running {
  border-color: #f59e0b;
  background:
    linear-gradient(135deg, rgba(245, 158, 11, 0.14) 0%, rgba(245, 158, 11, 0.02) 70%),
    linear-gradient(180deg, #ffffff 0%, #fffdf7 100%);
}

.agent-card.suspended {
  border-color: #f59e0b;
  background:
    linear-gradient(135deg, rgba(245, 158, 11, 0.14) 0%, rgba(245, 158, 11, 0.02) 70%),
    linear-gradient(180deg, #ffffff 0%, #fffdf7 100%);
}

.agent-card.failed {
  border-color: rgba(239, 68, 68, 0.4);
  background:
    linear-gradient(135deg, rgba(239, 68, 68, 0.06) 0%, rgba(255, 255, 255, 0) 60%),
    linear-gradient(180deg, #ffffff 0%, #fefcfc 100%);
}

.agent-card.done {
  background:
    linear-gradient(135deg, rgba(37, 198, 201, 0.05) 0%, rgba(255, 255, 255, 0) 70%),
    linear-gradient(180deg, #fcfdfd 0%, #f7fafa 100%);
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

.agent-card.running .agent-avatar,
.agent-card.suspended .agent-avatar {
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
  border-color: transparent;
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
  background: #f59e0b;
  box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.5);
  animation: dot-running 1.6s ease-in-out infinite;
}

@keyframes dot-running {
  0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.55); }
  50% { box-shadow: 0 0 0 5px rgba(245, 158, 11, 0); }
}

.agent-status-dot.failed {
  background: var(--danger-strong);
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

.agent-card.running .agent-card-footer,
.agent-card.suspended .agent-card-footer {
  background: linear-gradient(180deg, rgba(245, 158, 11, 0.04), rgba(245, 158, 11, 0.10));
}

.agent-card.failed .agent-card-footer {
  background: linear-gradient(180deg, rgba(239, 68, 68, 0.03), rgba(239, 68, 68, 0.08));
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
.agent-step-status.running { color: #b45309; }
.agent-step-status.failed { color: var(--danger-strong); }
.agent-step-status.suspended { color: #b45309; }
</style>
