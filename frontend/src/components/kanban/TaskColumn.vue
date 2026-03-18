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
                <div class="task-card-meta">
                  <span v-if="isTaskRunning(element.id)" class="task-running-time">
                    {{ formatTaskElapsedTime(element.id) }}
                  </span>
                  <PriorityBadge :priority="element.priority" />
                </div>
              </div>
              <div v-if="element.description" class="task-card-description">
                {{ element.description }}
              </div>
              <div class="task-card-footer">
                <div class="task-card-actions">
                  <!-- ActionButtons for edit/delete -->
                  <ActionButtons
                    :item="element"
                    :edit-tooltip="$t('common.edit')"
                    :delete-tooltip="$t('common.delete')"
                    size="small"
                    @edit="handleEditTask"
                    @delete="handleDeleteTask"
                  />
                  <!-- Worktree button -->
                  <el-tooltip
                    :content="getWorktreeTooltip(element)"
                    placement="top"
                  >
                    <button
                      class="btn btn-icon worktree-btn"
                      :class="getWorktreeClass(element)"
                      @click.stop="handleWorktreeClick(element)"
                      :disabled="isWorktreeLoading(element.id)"
                    >
                      <el-icon v-if="isWorktreeLoading(element.id)" class="is-loading"><Loading /></el-icon>
                      <el-icon v-else-if="element.worktree_status === 'created'"><FolderOpened /></el-icon>
                      <el-icon v-else><Folder /></el-icon>
                    </button>
                  </el-tooltip>
                </div>
              </div>
            </div>
          </div>
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
import { useI18n } from 'vue-i18n'
import draggable from 'vuedraggable'
import { Loading, FolderOpened, Folder } from '@element-plus/icons-vue'
import { useWorktree } from '../../composables/useWorktree'
import ActionButtons from '../common/ActionButtons.vue'
import PriorityBadge from '../common/PriorityBadge.vue'

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
  }
})

const emit = defineEmits(['drag-end', 'select-task', 'edit-task', 'delete-task', 'add-task', 'worktree-update'])

const { t } = useI18n()

// Use worktree composable
const { isWorktreeLoading, getWorktreeClass, getWorktreeTooltip, handleWorktree } = useWorktree()

const handleWorktreeClick = (task) => {
  handleWorktree(task, (updatedTask) => {
    emit('worktree-update', updatedTask)
  })
}

// Default empty text based on status
const statusClass = computed(() => props.statusClass || props.status.toLowerCase())

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

const taskCount = computed(() => props.tasks.length)
</script>

<style scoped>
.kanban-column {
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color-page);
  border-radius: 8px;
  min-width: 300px;
  max-width: 300px;
  max-height: 100%;
}

.column-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  font-weight: 600;
  border-bottom: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-light);
}

.column-status {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 6px currentColor;
}

.status-todo { background: var(--el-color-info); }
.status-in-progress { background: var(--el-color-warning); }
.status-done { background: var(--el-color-success); }
.status-blocked { background: var(--el-color-danger); }
.status-requirement { background: var(--el-color-primary); }

.column-title {
  flex: 1;
  font-size: 15px;
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
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.empty-column {
  text-align: center;
  padding: 20px 8px;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}

.add-task-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px dashed var(--el-border-color-light);
  border-radius: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: transparent;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 8px;
}

.add-task-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
  background: #eff6ff;
}

/* Task Card Styles */
.task-card {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border-radius: 10px;
  padding: 14px;
  cursor: pointer;
  border: 1px solid rgba(100, 116, 139, 0.15);
  border-left: 4px solid #94a3b8;
  transition: all 0.3s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  margin-bottom: 12px;
}

.task-card:hover {
  border-color: rgba(100, 116, 139, 0.3);
  box-shadow: 0 2px 8px rgba(100, 116, 139, 0.15);
  transform: translateY(-1px);
}

.task-card.task-selected {
  border-color: #64748b;
  box-shadow: 0 0 0 2px rgba(100, 116, 139, 0.2), 0 2px 8px rgba(100, 116, 139, 0.15);
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
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.task-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  flex: 1;
  min-width: 0;
  word-break: break-word;
  line-height: 1.4;
}

.task-card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.task-card-priority {
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 500;
  flex-shrink: 0;
  min-width: 32px;
  text-align: center;
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
  flex-shrink: 0;
}

.task-card-description {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.task-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
  flex-wrap: nowrap;
  white-space: nowrap;
}

.task-card-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Action button styles */
.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
}

.action-btn:hover {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.action-btn.delete-btn:hover {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

/* Worktree button styles */
.worktree-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.worktree-btn:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.worktree-btn .el-icon {
  font-size: 14px;
}

.worktree-btn.worktree-none {
  color: var(--el-text-color-secondary);
}

.worktree-btn.worktree-none:hover {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.worktree-btn.worktree-created {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.worktree-btn.worktree-created:hover {
  background: #fef2f2;
  color: #dc2626;
}

.worktree-btn.worktree-error {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
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
