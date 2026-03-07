<template>
  <div class="task-history">
    <div class="history-header">
      <h4>{{ $t('task.sessionHistory', 'Session History') }}</h4>
      <el-button
        v-if="sessions.length > 0"
        type="primary"
        size="small"
        link
        @click="$emit('refresh')"
        :loading="loading"
      >
        <el-icon><Refresh /></el-icon>
      </el-button>
    </div>

    <div v-if="loading && sessions.length === 0" class="history-loading">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>{{ $t('common.loading') }}</span>
    </div>

    <div v-else-if="sessions.length === 0" class="history-empty">
      <p>{{ $t('task.noSessions', 'No session history') }}</p>
    </div>

    <div v-else class="history-list">
      <div
        v-for="session in sessions"
        :key="session.id"
        class="history-item"
        :class="{ active: activeSessionId === session.id }"
        @click="$emit('select', session)"
      >
        <div class="session-info">
          <span class="session-status" :class="getStatusClass(session.status)">
            {{ session.status }}
          </span>
          <span class="session-time">{{ formatTime(session.startedAt) }}</span>
        </div>
        <div class="session-meta">
          <span v-if="session.claudeSessionId" class="session-id">
            {{ session.claudeSessionId.substring(0, 8) }}...
          </span>
          <span v-if="session.worktreePath" class="worktree-name">
            {{ getWorktreeName(session.worktreePath) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Refresh, Loading } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { SESSION_STATUS } from '../../constants/session'

const props = defineProps({
  sessions: {
    type: Array,
    default: () => []
  },
  activeSessionId: {
    type: [Number, String],
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  }
})

defineEmits(['select', 'refresh'])

const { t } = useI18n()

const getStatusClass = (status) => {
  const statusMap = {
    [SESSION_STATUS.RUNNING]: 'status-running',
    [SESSION_STATUS.IDLE]: 'status-idle',
    [SESSION_STATUS.STOPPED]: 'status-stopped',
    [SESSION_STATUS.ERROR]: 'status-error',
    [SESSION_STATUS.COMPLETED]: 'status-completed',
    [SESSION_STATUS.CREATED]: 'status-created'
  }
  return statusMap[status] || 'status-unknown'
}

const formatTime = (timestamp) => {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getWorktreeName = (path) => {
  if (!path) return ''
  const parts = path.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || path
}
</script>

<style scoped>
.task-history {
  border-top: 1px solid var(--border-color, #262626);
  padding-top: 12px;
  margin-top: 12px;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.history-header h4 {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary, #9ca3af);
  font-weight: 500;
}

.history-loading,
.history-empty {
  text-align: center;
  padding: 20px;
  color: var(--text-muted, #6b7280);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.history-item {
  padding: 10px 12px;
  background: var(--bg-tertiary, #242424);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.history-item:hover {
  background: var(--hover-bg, #2a2a2a);
}

.history-item.active {
  border-color: var(--accent-color, #6366f1);
  background: var(--accent-light, rgba(99, 102, 241, 0.1));
}

.session-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.session-status {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
}

.session-status.status-running {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.session-status.status-stopped,
.session-status.status-completed {
  background: rgba(107, 114, 128, 0.15);
  color: #6b7280;
}

.session-status.status-error {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.session-time {
  font-size: 11px;
  color: var(--text-muted, #6b7280);
}

.session-meta {
  display: flex;
  gap: 8px;
  font-size: 10px;
  color: var(--text-muted, #6b7280);
  font-family: monospace;
}
</style>
