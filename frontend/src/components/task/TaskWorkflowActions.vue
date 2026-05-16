<template>
  <div class="workflow-section quick-actions">
    <button class="quick-action-btn" :disabled="!canStartTask" @click.stop="emit('start')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
      启动
    </button>
    <button class="quick-action-btn" @click.stop="emit('configure')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
      模板
    </button>
    <button class="quick-action-btn" :disabled="worktreeNotCreated" @click.stop="emit('quick-edit')" title="Quick Edit">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
      编辑
    </button>
    <button class="quick-action-btn" @click.stop="emit('merge')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="18" r="3"></circle>
        <circle cx="6" cy="6" r="3"></circle>
        <circle cx="18" cy="6" r="3"></circle>
        <path d="M6 9v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V9"></path>
        <line x1="12" cy="15" x2="12" y2="15"></line>
      </svg>
      合入
    </button>
    <button v-if="hasWorkflowRunId" class="quick-action-btn" :disabled="refreshLoading" @click.stop="emit('refresh')" title="刷新状态">
      <span class="workflow-refresh-icon" :class="{ 'is-loading': refreshLoading }">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
        </svg>
      </span>
      刷新
    </button>
    <button
      v-if="(workflowStatus === 'running' || workflowStatus === 'suspended') && hasWorkflowRunId"
      class="quick-action-btn quick-action-cancel"
      :disabled="cancelLoading"
      @click.stop="emit('cancel')"
      title="取消AgentTeam"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
      取消
    </button>
    <button
      v-if="workflowStatus === 'suspended' && hasWorkflowRunId && !isAskUserSuspended"
      class="quick-action-btn quick-action-resume"
      :disabled="resumeLoading"
      @click.stop="emit('resume')"
      title="确认继续"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      确认继续
    </button>
    <button
      v-if="(workflowStatus === 'failed' || workflowStatus === 'cancelled') && hasWorkflowRunId"
      class="quick-action-btn quick-action-retry"
      :disabled="retryLoading"
      @click.stop="emit('retry')"
      title="重试AgentTeam"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
      </svg>
      重试
    </button>
    <el-checkbox
      v-if="hasWorkflowRunId && !isWorkflowTerminal"
      :model-value="pollingEnabled"
      class="auto-refresh-checkbox"
      size="small"
      @update:model-value="emit('auto-refresh-change', $event)"
    >
      自动刷新
    </el-checkbox>
  </div>
</template>

<script setup>
const emit = defineEmits([
  'start', 'configure', 'quick-edit', 'merge',
  'refresh', 'cancel', 'resume', 'retry', 'auto-refresh-change'
])

const props = defineProps({
  canStartTask: { type: Boolean, default: true },
  worktreeNotCreated: { type: Boolean, default: false },
  hasWorkflowRunId: { type: Boolean, default: false },
  refreshLoading: { type: Boolean, default: false },
  cancelLoading: { type: Boolean, default: false },
  retryLoading: { type: Boolean, default: false },
  resumeLoading: { type: Boolean, default: false },
  workflowStatus: { type: String, default: 'pending' },
  isAskUserSuspended: { type: Boolean, default: false },
  isWorkflowTerminal: { type: Boolean, default: false },
  pollingEnabled: { type: Boolean, default: true }
})
</script>
