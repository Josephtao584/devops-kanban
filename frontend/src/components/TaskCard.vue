<template>
  <el-card
    class="task-card"
    :class="[priorityClass, { 'is-running': isRunning }]"
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
        <div class="header-actions">
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

    <h4 class="task-title">{{ task.title }}</h4>
    <p v-if="task.description" class="task-description">{{ truncatedDescription }}</p>

    <template #footer>
      <div class="task-footer">
        <span v-if="task.assignee" class="assignee">
          <el-avatar :size="18" class="avatar">
            {{ task.assignee.charAt(0).toUpperCase() }}
          </el-avatar>
          <span class="assignee-name">{{ task.assignee }}</span>
        </span>
        <span v-if="task.syncedAt" class="sync-info">
          <el-icon><Clock /></el-icon>
          {{ formatTime(task.syncedAt) }}
        </span>
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

const priorityClass = computed(() => {
  return `priority-${(props.task.priority || 'MEDIUM').toLowerCase()}`
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
</script>

<style scoped>
.task-card {
  margin-bottom: 8px;
  cursor: pointer;
  border-left: 3px solid #ccc;
  background: #fff;
}

.task-card.priority-critical {
  border-left-color: var(--el-color-danger);
}

.task-card.priority-high {
  border-left-color: var(--el-color-warning);
}

.task-card.priority-medium {
  border-left-color: var(--el-color-primary);
}

.task-card.priority-low {
  border-left-color: var(--el-color-info);
}

.task-card :deep(.el-card__header) {
  padding: 8px 12px;
}

.task-card :deep(.el-card__body) {
  padding: 8px 12px;
}

.task-card :deep(.el-card__footer) {
  padding: 6px 12px;
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

.header-actions {
  display: flex;
  align-items: center;
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
  border-left-color: var(--el-color-primary);
  box-shadow: 0 0 0 1px var(--el-color-primary-light-5);
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
