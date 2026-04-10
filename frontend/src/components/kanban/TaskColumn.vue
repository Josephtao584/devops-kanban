<template>
  <div class="kanban-column" :data-status="status">
    <div class="column-header">
      <span :class="['column-status', `status-${statusClass}-dot`]"></span>
      <span class="column-title">{{ title }}</span>
      <span class="column-count">{{ taskCount }}</span>
      <button v-if="showSyncButton" class="sync-btn" @click.stop="emit('sync')" :title="$t('taskSource.sync')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
        </svg>
      </button>
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
          <TaskListItem
            :task="element"
            :selected="selectedTask?.id === element.id"
            :running="isTaskRunning(element.id)"
            :elapsed-time="formatTaskElapsedTime(element.id)"
            :workflow-expanded="expandedTaskId === element.id"
            :description-expanded="expandedDescriptionTaskId === element.id"
            :current-node-id="currentNodeId"
            @click="handleSelectTask"
            @edit="handleEditTask"
            @delete="handleDeleteTask"
            @worktree-update="handleWorktreeUpdate"
            @toggle-workflow="$emit('toggle-workflow', $event)"
            @toggle-description="$emit('toggle-description', $event)"
            @workflow-action="$emit('workflow-action', $event)"
            @quick-edit="$emit('quick-edit', $event)"
          />
        </template>
      </draggable>
      <div v-if="tasks.length === 0" class="empty-column">
        <p>{{ emptyText }}</p>
      </div>
      <button v-if="showAddButton" class="add-task-btn" @click="emit('add-task')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        {{ $t('task.newTaskButton') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import draggable from 'vuedraggable'
import TaskListItem from '../task/TaskListItem.vue'

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
  },
  showAddButton: {
    type: Boolean,
    default: false
  },
  showSyncButton: {
    type: Boolean,
    default: false
  },
  expandedTaskId: {
    type: String,
    default: null
  },
  expandedDescriptionTaskId: {
    type: String,
    default: null
  },
  currentNodeId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['drag-end', 'select-task', 'edit-task', 'delete-task', 'add-task', 'worktree-update', 'sync', 'toggle-workflow', 'toggle-description', 'workflow-action', 'quick-edit'])

const statusClass = computed(() => props.statusClass || props.status.toLowerCase())

const isTaskRunning = (taskId) => {
  return props.runningTaskIds?.has?.(taskId) || false
}

const formatTaskElapsedTime = (taskId) => {
  // This should be provided by parent or use a composable
  // For now, return empty string
  return ''
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

const handleWorktreeUpdate = (updatedTask) => {
  emit('worktree-update', updatedTask)
}

const taskCount = computed(() => props.tasks.length)
</script>

<style scoped>
.kanban-column {
  display: flex;
  flex-direction: column;
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  width: 500px;
  min-width: 500px;
  max-width: 500px;
  flex: 0 0 500px;
  max-height: 100%;
  overflow: hidden;
}

.column-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 18px;
  font-weight: 600;
  border-bottom: 1px solid var(--border-color);
  background: var(--panel-bg);
}

.column-status {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 6px currentColor;
}

.status-todo-dot { background: var(--el-color-info); }
.status-in-progress-dot { background: var(--el-color-warning); }
.status-done-dot { background: var(--el-color-success); }
.status-blocked-dot { background: var(--el-color-danger); }
.status-requirement-dot { background: var(--el-color-primary); }

.column-title {
  flex: 1;
  font-size: var(--font-size-md);
  font-weight: 700;
  color: var(--text-primary);
}

.column-count {
  font-size: var(--font-size-xs);
  color: var(--accent-color);
  background: var(--accent-color-soft);
  padding: 3px 9px;
  border-radius: 999px;
  font-weight: 700;
}

.sync-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.2s;
}

.sync-btn:hover {
  background: var(--hover-bg);
  color: var(--accent-color);
}

.column-content {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
}

.column-content :deep(.task-item:last-child) {
  margin-bottom: 0;
}

.column-content :deep(.task-item) {
  box-shadow: none;
}
.empty-column {
  text-align: center;
  padding: 24px 12px;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.add-task-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--panel-bg);
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 10px;
}

.add-task-btn:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
  background: var(--hover-bg);
}

/* Drag and drop styles */
.ghost-card {
  opacity: 0.5;
  background: var(--el-color-primary-light-9);
}

.drag-card {
  transform: rotate(2deg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
</style>
