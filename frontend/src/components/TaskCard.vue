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
        v-if="task.external_url"
        :href="task.external_url"
        target="_blank"
        class="github-link"
        @click.stop
      >
        <el-tag :type="sourceTagType" size="small">
          {{ sourceName }}
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

const sourceTagType = computed(() => getSourceTagType(props.task.source))
const sourceName = computed(() => getSourceName(props.task.source))

const getSourceTagType = (source) => {
  const types = {
    REQUIREMENT: 'warning',
    TICKET: 'info',
    JIRA: 'danger',
    MANUAL: 'success'
  }
  return types[source] || 'info'
}

const getSourceName = (source) => {
  const names = {
    REQUIREMENT: '需求池',
    TICKET: '工单系统',
    JIRA: 'Jira',
    MANUAL: '手动'
  }
  return names[source] || source || '外部'
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
