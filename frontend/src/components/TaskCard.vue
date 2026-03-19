<template>
  <el-card
    class="task-card"
    :class="[statusClass, { 'is-running': isRunning }]"
    shadow="hover"
    @click="$emit('click')"
  >
    <template #header>
      <div class="task-header">
        <div class="header-left">
          <el-tag :type="priorityTagType" size="small" effect="dark">
            {{ priorityLabel }}
          </el-tag>
          <span v-if="task.externalId" class="external-id">#{{ task.externalId }}</span>
          <el-tooltip
            :content="task.autoTransitionEnabled !== false ? '自动流转已启用' : '自动流转已禁用'"
            placement="top"
          >
            <el-icon
              class="auto-transition-icon"
              :class="{ 'disabled': task.autoTransitionEnabled === false }"
              @click.stop="$emit('toggle-auto-transition', task)"
            >
              <Refresh />
            </el-icon>
          </el-tooltip>
        </div>
      </div>
    </template>

    <div class="task-title-row">
      <h4 class="task-title">{{ task.title || $t('task.untitled') }}</h4>
      <a
        v-if="task.source === 'GITHUB' && task.external_url"
        :href="task.external_url"
        target="_blank"
        class="github-link"
        @click.stop
      >
        <el-tag type="success" size="small">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 4px;">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          GitHub
        </el-tag>
      </a>
    </div>
    <p v-if="task.description" class="task-description">{{ truncatedDescription }}</p>

    <template #footer>
      <div class="task-footer">
        <span v-if="task.assignee" class="assignee">
          <el-avatar :size="18" class="avatar">
            {{ task.assignee.charAt(0).toUpperCase() }}
          </el-avatar>
          <span class="assignee-name">{{ task.assignee }}</span>
        </span>
        <div class="footer-actions">
          <span v-if="task.syncedAt" class="sync-info">
            <el-icon><Clock /></el-icon>
            {{ formatTime(task.syncedAt) }}
          </span>
          <el-button
            v-if="!isRunning"
            type="primary"
            size="small"
            circle
            @click.stop="$emit('run', task)"
            title="Run with AI"
          >
            <el-icon><VideoPlay /></el-icon>
          </el-button>
          <el-icon v-else class="running-indicator"><Loading /></el-icon>
        </div>
      </div>
    </template>
  </el-card>
</template>

<script setup>
import { computed } from 'vue'
import { Clock, VideoPlay, Loading, Refresh } from '@element-plus/icons-vue'

const props = defineProps({
  task: {
    type: Object,
    required: true
  },
  isRunning: {
    type: Boolean,
    default: false
  }
})

defineEmits(['click', 'run', 'toggle-auto-transition'])

const statusClass = computed(() => {
  return `status-${(props.task.status || 'TODO').toLowerCase()}`
})

const priorityTagType = computed(() => {
  const types = {
    LOW: 'info',
    MEDIUM: 'primary',
    HIGH: 'warning',
    CRITICAL: 'danger'
  }
  return types[props.task.priority] || 'primary'
})

const priorityLabel = computed(() => {
  const labels = {
    LOW: 'Low',
    MEDIUM: 'Med',
    HIGH: 'High',
    CRITICAL: 'Crit'
  }
  return labels[props.task.priority] || 'Med'
})

const truncatedDescription = computed(() => {
  if (!props.task.description) return ''
  return props.task.description.length > 100
    ? props.task.description.substring(0, 100) + '...'
    : props.task.description
})

const formatTime = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString().substring(0, 5)
}

const getSourceTagType = (source) => {
  const types = {
    GITHUB: 'warning',
    GITLAB: 'info',
    JIRA: 'danger',
    MANUAL: 'success'
  }
  return types[source] || 'info'
}

const getSourceName = (source) => {
  const names = {
    GITHUB: 'GitHub',
    GITLAB: 'GitLab',
    JIRA: 'Jira',
    MANUAL: '手动'
  }
  return names[source] || source
}
</script>

<style scoped>
.task-card {
  margin-bottom: 8px;
  cursor: pointer;
  border-left: 4px solid #ccc;
  background: #fff;
  transition: all 0.3s ease;
  border-radius: 8px;
}

.task-card.status-todo {
  border-left-color: #6b7280;
  background: linear-gradient(135deg, #f9fafb 0%, #fff 100%);
}

.task-card.status-todo:hover {
  box-shadow: 0 4px 12px rgba(107, 114, 128, 0.2);
  transform: translateY(-2px);
}

.task-card.status-in_progress {
  border-left-color: #3b82f6;
  background: linear-gradient(135deg, #eff6ff 0%, #fff 100%);
}

.task-card.status-in_progress:hover {
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
  transform: translateY(-2px);
}

.task-card.status-done {
  border-left-color: #10b981;
  background: linear-gradient(135deg, #ecfdf5 0%, #fff 100%);
}

.task-card.status-done:hover {
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
  transform: translateY(-2px);
}

.task-card :deep(.el-card__header) {
  padding: 10px 14px;
}

.task-card :deep(.el-card__body) {
  padding: 10px 14px;
}

.task-card :deep(.el-card__footer) {
  padding: 8px 14px;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.running-indicator {
  color: var(--el-color-primary);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.task-card.is-running {
  border-left-color: #3b82f6;
  background: linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
}

.task-card.is-running:hover {
  transform: translateY(-2px);
}

.external-id {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.task-title {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.task-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.github-link {
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}

.github-link:hover {
  opacity: 0.8;
}

.task-description {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}

.task-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.assignee {
  display: flex;
  align-items: center;
  gap: 4px;
}

.avatar {
  background: var(--el-color-primary);
}

.assignee-name {
  margin-left: 4px;
}

.sync-info {
  display: flex;
  align-items: center;
  gap: 4px;
  font-style: italic;
}

.auto-transition-icon {
  font-size: 14px;
  color: var(--el-color-primary);
  cursor: pointer;
  transition: opacity 0.2s;
}

.auto-transition-icon.disabled {
  color: var(--el-text-color-placeholder);
  opacity: 0.5;
}

.auto-transition-icon:hover {
  opacity: 0.8;
}
</style>
