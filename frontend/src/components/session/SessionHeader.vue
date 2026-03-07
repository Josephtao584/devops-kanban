<template>
  <div class="session-header">
    <div class="header-left">
      <span class="header-title">{{ title }}</span>
      <StatusBadge :status="status" :text="statusText" />
      <span v-if="sessionId" class="session-id">
        Session: {{ sessionId }}
      </span>
      <span v-if="worktreePath" class="worktree-info" :title="worktreePath">
        <el-icon style="width: 12px; height: 12px;"><Folder /></el-icon>
        {{ worktreeName }}
      </span>
    </div>
    <div class="header-actions">
      <slot name="actions"></slot>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Folder } from '@element-plus/icons-vue'
import StatusBadge from '../common/StatusBadge.vue'

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
</script>

<style scoped>
.session-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--panel-bg, #171717);
  border-bottom: 1px solid var(--border-color, #262626);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
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

.session-id {
  font-size: 11px;
  color: var(--text-muted, #6b7280);
  font-family: monospace;
  background: var(--bg-tertiary, #242424);
  padding: 2px 6px;
  border-radius: 4px;
}

.worktree-info {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-muted, #6b7280);
  font-family: monospace;
  background: var(--bg-tertiary, #242424);
  padding: 2px 6px;
  border-radius: 4px;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-actions {
  display: flex;
  gap: 8px;
}
</style>
