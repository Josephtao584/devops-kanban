<template>
  <div class="session-header" :title="tooltipContent">
    <!-- Worktree info on separate line -->
    <div v-if="worktreeName" class="worktree-row">
      <span class="worktree-label">{{ $t('git.worktree', 'Worktree') }}:</span>
      <span class="worktree-badge" :title="worktreePath">
        {{ worktreeName }}
      </span>
    </div>
    <!-- Title and status row -->
    <div class="header-row">
      <div class="header-left">
        <span class="header-title">{{ title }}</span>
        <StatusBadge :status="status" :text="statusText" />
      </div>
      <div class="header-actions">
        <slot name="actions"></slot>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import StatusBadge from '../common/StatusBadge.vue'

const { t } = useI18n()

const props = defineProps({
  title: {
    type: String,
    default: 'Agent Chat'
  },
  status: {
    type: String,
    default: ''
  },
  statusText: {
    type: String,
    default: ''
  },
  sessionId: {
    type: String,
    default: ''
  },
  worktreePath: {
    type: String,
    default: ''
  }
})

const worktreeName = computed(() => {
  if (!props.worktreePath) return ''
  const parts = props.worktreePath.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || props.worktreePath
})

const tooltipContent = computed(() => {
  const parts = []
  if (props.sessionId) parts.push(`Session: ${props.sessionId}`)
  if (props.worktreePath) parts.push(`Worktree: ${props.worktreePath}`)
  return parts.join('\n')
})
</script>

<style scoped>
.session-header {
  display: flex;
  flex-direction: column;
  background: var(--panel-bg, #171717);
  border-bottom: 1px solid var(--border-color, #262626);
}

.worktree-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-tertiary, #1a1a1a);
  border-bottom: 1px solid var(--border-color, #262626);
}

.worktree-label {
  font-size: 11px;
  color: var(--text-muted, #888);
  white-space: nowrap;
}

.worktree-badge {
  font-size: 11px;
  color: var(--text-secondary, #aaa);
  background: var(--bg-secondary, #262626);
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.header-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-primary, #f0f0f0);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-actions {
  display: flex;
  gap: 8px;
}
</style>
