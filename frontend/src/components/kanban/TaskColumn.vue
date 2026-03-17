<template>
  <div class="kanban-column" :data-status="status">
    <div class="column-header">
      <span :class="['column-status', `status-${statusClass}`]"></span>
      <span class="column-title">{{ title }}</span>
      <span class="column-count">{{ taskCount }}</span>
    </div>
    <div class="column-content">
      <draggable
        :list="tasks"
        group="tasks"
        :animation="200"
        ghost-class="ghost-card"
        drag-class="drag-card"
        :data-status="status"
        @end="handleDragEnd"
        item-key="id"
      >
        <template #item="{ element }">
          <div
            class="task-card"
            :data-id="element.id"
            :class="{
              'task-selected': selectedTask?.id === element.id,
              'task-running': isTaskRunning(element.id)
            }"
            @click="handleSelectTask(element)"
          >
            <div class="task-card-content">
              <div class="task-card-main">
                <span class="task-card-title">{{ element.title }}</span>
                <span class="task-card-priority" :class="getPriorityClass(element.priority)">
                  {{ getPriorityLabel(element.priority) }}
                </span>
                <span v-if="isTaskRunning(element.id)" class="task-running-time">
                  {{ formatTaskElapsedTime(element.id) }}
                </span>
              </div>
              <div v-if="element.description" class="task-card-description">
                {{ element.description }}
              </div>
              <div class="task-card-actions">
                <button
                  class="auto-transition-btn"
                  :class="{ 'active': element.autoTransitionEnabled === true }"
                  @click.stop="handleToggleAutoTransition(element)"
                  :title="element.autoTransitionEnabled === true ? $t('task.autoTransitionEnabled') : $t('task.autoTransitionDisabled')"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M23 4v6h-6"></path>
                    <path d="M1 20v-6h6"></path>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                  </svg>
                </button>
                <button
                  class="edit-btn"
                  @click.stop="handleEditTask(element)"
                  :title="$t('common.edit')"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
                <button
                  class="delete-btn"
                  @click.stop="handleDeleteTask(element.id)"
                  :title="$t('common.delete')"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </template>
      </draggable>
      <div v-if="tasks.length === 0" class="empty-column">
        <p>{{ emptyText }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  status: {
    type: String,
    required: true
  },
  statusClass: {
    type: String,
    default: ''
  },
  title: {
    type: String,
    required: true
  },
  tasks: {
    type: Array,
    required: true
  },
  selectedTask: {
    type: Object,
    default: null
  },
  runningTaskIds: {
    type: Set,
    default: () => new Set()
  },
  emptyText: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['drag-end', 'select-task', 'edit-task', 'delete-task', 'toggle-auto-transition'])

const { t } = useI18n()

// Default empty text based on status
const defaultEmptyText = computed(() => {
  const emptyTextMap = {
    TODO: t('task.noTodoTasks'),
    IN_PROGRESS: t('task.noTasks'),
    DONE: t('task.noDoneTasks'),
    BLOCKED: t('task.noTasks'),
    REQUIREMENTS: t('requirement.noRequirements')
  }
  return emptyTextMap[props.status] || t('task.noTasks')
})

const displayEmptyText = computed(() => {
  return props.emptyText || defaultEmptyText.value
})

const isTaskRunning = (taskId) => {
  return props.runningTaskIds?.has?.(taskId) || false
}

const formatTaskElapsedTime = (taskId) => {
  // This should be provided by parent or use a composable
  // For now, return empty string
  return ''
}

const getPriorityClass = (priority) => {
  const classMap = {
    CRITICAL: 'priority-critical',
    HIGH: 'priority-high',
    MEDIUM: 'priority-medium',
    LOW: 'priority-low'
  }
  return classMap[priority] || 'priority-medium'
}

const getPriorityLabel = (priority) => {
  const labelMap = {
    CRITICAL: 'Crit',
    HIGH: 'High',
    MEDIUM: 'Med',
    LOW: 'Low'
  }
  return labelMap[priority] || 'Med'
}

const handleDragEnd = (evt) => {
  emit('drag-end', evt)
}

const handleSelectTask = (task) => {
  emit('select-task', task)
}

const handleEditTask = (task) => {
  emit('edit-task', task)
}

const handleDeleteTask = (taskId) => {
  emit('delete-task', taskId)
}

const handleToggleAutoTransition = (task) => {
  emit('toggle-auto-transition', task)
}

const taskCount = computed(() => props.tasks.length)
</script>

<style scoped>
.kanban-column {
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color-page);
  border-radius: 8px;
  min-width: 280px;
  max-width: 280px;
  max-height: 100%;
}

.column-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  font-weight: 600;
  border-bottom: 1px solid var(--el-border-color-light);
}

.column-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-todo { background: var(--el-color-info); }
.status-in-progress { background: var(--el-color-warning); }
.status-done { background: var(--el-color-success); }
.status-blocked { background: var(--el-color-danger); }
.status-requirement { background: var(--el-color-primary); }

.column-title {
  flex: 1;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.column-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-bg-color);
  padding: 2px 8px;
  border-radius: 10px;
}

.column-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.empty-column {
  text-align: center;
  padding: 20px 8px;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}

/* Task Card Styles (inline for now, should be extracted) */
.task-card {
  background: var(--el-bg-color);
  border-radius: 6px;
  padding: 10px;
  cursor: pointer;
  border: 1px solid var(--el-border-color-light);
  transition: all 0.2s;
}

.task-card:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.task-card.task-selected {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-9);
}

.task-card.task-running {
  border-left: 3px solid var(--el-color-primary);
}

.task-card-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.task-card-main {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  flex-wrap: wrap;
}

.task-card-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  flex: 1;
  min-width: 0;
  word-break: break-word;
}

.task-card-priority {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 500;
  flex-shrink: 0;
}

.task-card-priority.priority-critical {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.task-card-priority.priority-high {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}

.task-card-priority.priority-medium {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.task-card-priority.priority-low {
  background: var(--el-color-info-light-9);
  color: var(--el-color-info);
}

.task-running-time {
  font-size: 11px;
  color: var(--el-color-primary);
  font-family: monospace;
}

.task-card-description {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.task-card-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.task-card:hover .task-card-actions {
  opacity: 1;
}

.task-card-actions button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  color: var(--el-text-color-secondary);
  transition: all 0.2s;
}

.task-card-actions button:hover {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.task-card-actions .delete-btn:hover {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.auto-transition-btn.active {
  color: var(--el-color-success);
  background: var(--el-color-success-light-9);
}

.ghost-card {
  opacity: 0.5;
  background: var(--el-color-primary-light-9);
}

.drag-card {
  transform: rotate(2deg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
</style>
