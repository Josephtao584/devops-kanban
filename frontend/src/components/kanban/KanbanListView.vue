<template>
  <div class="task-list-view" ref="taskListRef">
    <!-- Pending Tasks Section (TODO) -->
    <div class="list-pending-section" :class="{ collapsed: isPendingCollapsed }">
      <div class="list-section-header" @click="isPendingCollapsed = !isPendingCollapsed">
        <div class="list-section-title">
          <svg class="collapse-icon" :class="{ rotated: isPendingCollapsed }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
          待办区
          <span class="section-count">{{ pendingTasks.length }}</span>
        </div>
        <div class="list-section-actions" @click.stop>
          <button class="sync-btn-list" @click="$emit('sync')" :title="$t('taskSource.sync')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
            同步
          </button>
          <button class="add-task-btn-list" @click="$emit('add-task')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            添加任务
          </button>
        </div>
      </div>
      <div class="list-pending-content" v-show="!isPendingCollapsed">
        <draggable
          v-model="localPendingTasks"
          item-key="id"
          class="pending-draggable-list"
          @end="onPendingTasksReorder"
          :animation="200"
          ghost-class="task-ghost"
          drag-class="task-drag"
        >
          <template #item="{ element: task }">
            <TaskListItem
              :task="task"
              :compact="true"
              :selected="selectedTask?.id === task.id"
              :running="isTaskRunning(task.id)"
              :elapsed-time="formatElapsedTime(task.id)"
              :show-status="true"
              :show-drag-handle="true"
              :status-text="$t(`status.${task.status}`)"
              :workflowExpanded="expandedTaskId === task.id"
              :descriptionExpanded="expandedDescriptionTaskId === task.id"
              :currentNodeId="currentNodeId"
              @click="$emit('select-task', task)"
              @edit="$emit('edit-task', task)"
              @delete="$emit('delete-task', task.id)"
              @worktree-update="$emit('worktree-update', $event)"
              @toggle-workflow="$emit('toggle-workflow', $event)"
              @toggle-description="$emit('toggle-description', $event)"
              @workflow-action="$emit('workflow-action', $event)"
              @quick-edit="$emit('quick-edit', $event)"
              @update-task="$emit('update-task', $event)"
            />
          </template>
        </draggable>
        <div v-if="pendingTasks.length === 0" class="empty-pending-list">
          <p>暂无待处理任务</p>
        </div>
      </div>
    </div>

    <!-- Active Tasks Section (IN_PROGRESS + DONE) -->
    <div class="list-active-section" :class="{ collapsed: isActiveCollapsed }">
      <div class="list-section-header" @click="isActiveCollapsed = !isActiveCollapsed">
        <div class="list-section-title">
          <svg class="collapse-icon" :class="{ rotated: isActiveCollapsed }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
          执行区
          <span class="section-count">{{ activeTasks.length }}</span>
        </div>
        <div class="list-status-filter" @click.stop>
          <el-checkbox-group v-model="localStatusFilter" size="small">
            <el-checkbox-button v-for="status in activeStatusOptions" :key="status" :value="status">
              {{ $t(`status.${status}`) }}
            </el-checkbox-button>
          </el-checkbox-group>
        </div>
      </div>
      <div class="task-list-container">
        <div v-if="localActiveTasks.length === 0" class="empty-list">
          <p>暂无执行任务</p>
        </div>
        <draggable
          v-model="localActiveTasks"
          item-key="id"
          class="tasks-draggable-list"
          @end="onActiveTasksReorder"
          :animation="200"
          ghost-class="task-ghost"
          drag-class="task-drag"
        >
          <template #item="{ element: task }">
            <TaskListItem
              :task="task"
              :compact="true"
              :selected="selectedTask?.id === task.id"
              :running="isTaskRunning(task.id)"
              :elapsed-time="formatElapsedTime(task.id)"
              :show-status="true"
              :show-drag-handle="true"
              :status-text="$t(`status.${task.status}`)"
              :workflowExpanded="expandedTaskId === task.id"
              :descriptionExpanded="expandedDescriptionTaskId === task.id"
              :currentNodeId="currentNodeId"
              @click="$emit('select-task', task)"
              @edit="$emit('edit-task', task)"
              @delete="$emit('delete-task', task.id)"
              @worktree-update="$emit('worktree-update', $event)"
              @toggle-workflow="$emit('toggle-workflow', $event)"
              @toggle-description="$emit('toggle-description', $event)"
              @workflow-action="$emit('workflow-action', $event)"
              @quick-edit="$emit('quick-edit', $event)"
              @update-task="$emit('update-task', $event)"
            />
          </template>
        </draggable>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import draggable from 'vuedraggable'
import TaskListItem from '../task/TaskListItem.vue'

const props = defineProps({
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
  statusFilter: {
    type: Array,
    default: () => ['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED']
  },
  expandedTaskId: {
    type: [String, Number],
    default: null
  },
  expandedDescriptionTaskId: {
    type: [String, Number],
    default: null
  },
  currentNodeId: {
    type: [String, Number],
    default: null
  }
})

const emit = defineEmits([
  'select-task',
  'edit-task',
  'delete-task',
  'update:statusFilter',
  'add-task',
  'reorder-tasks',
  'worktree-update',
  'sync',
  'toggle-workflow',
  'toggle-description',
  'workflow-action',
  'quick-edit',
  'update-task'
])

const { t } = useI18n()

// Collapse state for both sections
const isPendingCollapsed = ref(false)
const isActiveCollapsed = ref(false)

// Local copy of tasks for draggable
const localTasks = ref([])

// Sync tasks from props
watch(
  () => props.tasks,
  (newTasks) => {
    localTasks.value = [...newTasks]
  },
  { immediate: true, deep: true }
)

// Pending tasks (TODO status)
const pendingTasks = computed(() => {
  return props.tasks.filter(task => task.status === 'TODO')
})

// Local copy of pending tasks for draggable
const localPendingTasks = computed({
  get: () => pendingTasks.value,
  set: (value) => {
    localTasks.value = value
  }
})

// Handle pending tasks reorder
const onPendingTasksReorder = (event) => {
  emit('reorder-tasks', localTasks.value)
}

// Active tasks (IN_PROGRESS + DONE + BLOCKED status) - filtered by status filter
const activeTasks = computed(() => {
  return props.tasks.filter(task =>
    task.status !== 'TODO' &&
    localStatusFilter.value.includes(task.status)
  )
})

// Local copy of active tasks for draggable
const localActiveTasks = computed({
  get: () => activeTasks.value,
  set: (value) => {
    // The draggable updates the local value but the actual reorder is handled by onActiveTasksReorder
  }
})

// Handle active tasks reorder
const onActiveTasksReorder = (event) => {
  emit('reorder-tasks', localTasks.value)
}

const activeStatusOptions = ['IN_PROGRESS', 'DONE', 'BLOCKED']

// localStatusFilter as a ref for proper v-model binding with el-checkbox-group
const localStatusFilter = ref([...activeStatusOptions])

// Sync from parent prop when it changes
watch(() => props.statusFilter, (newFilter) => {
  const activeFilter = newFilter.filter(s => s !== 'TODO')
  // Only update if different to avoid unnecessary re-renders
  if (JSON.stringify(activeFilter.sort()) !== JSON.stringify(localStatusFilter.value.sort())) {
    localStatusFilter.value = activeFilter
  }
}, { immediate: true })

// Emit changes to parent when localStatusFilter changes
watch(localStatusFilter, (newFilter) => {
  const fullFilter = ['TODO', ...newFilter]
  emit('update:statusFilter', fullFilter)
}, { immediate: true })

const isTaskRunning = (taskId) => {
  return props.runningTaskIds?.has?.(taskId) || false
}

const formatElapsedTime = (taskId) => {
  // TODO: Implement with useTaskTimer composable
  return ''
}
</script>

<style scoped>
.task-list-view {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Pending Tasks Section */
.list-pending-section {
  background: var(--panel-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  flex-shrink: 0;
}

.list-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--panel-bg);
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  user-select: none;
  gap: 10px;
}

.list-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  font-size: var(--font-size-md);
  color: var(--text-primary);
}.collapse-icon {
  transition: transform 0.2s;
  transform: rotate(90deg);
}

.collapse-icon.rotated {
  transform: rotate(0deg);
}

.section-count {
  font-size: var(--font-size-xs);
  color: var(--accent-color);
  background: var(--accent-color-soft);
  padding: 3px 9px;
  border-radius: 999px;
  font-weight: 700;
}

.list-section-actions {
  display: flex;
  align-items: center;
  min-height: 30px;
  gap: 6px;
}

.add-task-btn-list,
.sync-btn-list {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid var(--border-color);
  background: var(--panel-bg);
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
  line-height: 1;
}.add-task-btn-list:hover,
.sync-btn-list:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
  background: var(--hover-bg);
}

.add-task-btn-list svg,
.sync-btn-list svg {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
}

.list-status-filter {
  flex-shrink: 0;
}

.list-status-filter :deep(.el-checkbox-group) {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 4px;
}

.list-status-filter :deep(.el-checkbox-button) {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  height: 28px;
  min-height: 28px;
  min-width: 62px;
  padding: 0 9px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  box-shadow: none;
  background: var(--panel-bg);
  color: var(--text-secondary);
}

.list-status-filter :deep(.el-checkbox-button.is-checked .el-checkbox-button__inner) {
  border-color: var(--button-primary-active-border);
  background: var(--button-primary-gradient);
  color: var(--button-primary-text);
  box-shadow: var(--button-primary-shadow);
}

.list-status-filter :deep(.el-checkbox-button__inner:hover) {
  border-color: var(--button-surface-hover-border);
  color: var(--button-surface-hover-text);
  background: var(--button-surface-hover-bg);
}

.list-status-filter :deep(.el-checkbox-button.is-checked .el-checkbox-button__inner:hover) {
  border-color: var(--button-primary-active-border);
  background: var(--button-primary-gradient-hover);
  color: var(--button-primary-text);
  box-shadow: var(--button-primary-shadow-hover);
}

.list-status-filter :deep(.el-checkbox-button:first-child .el-checkbox-button__inner),
.list-status-filter :deep(.el-checkbox-button:last-child .el-checkbox-button__inner) {
  border-radius: var(--radius-sm);
}

.list-status-filter :deep(.el-checkbox-button:not(:first-child) .el-checkbox-button__inner),
.list-status-filter :deep(.el-checkbox-button + .el-checkbox-button) {
  margin-left: 0;
}

.list-status-filter :deep(.el-checkbox-button__inner)::before {
  display: none;
}
.list-active-section .list-section-header {
  cursor: pointer;
}

.list-active-section.collapsed .task-list-container {
  display: none;
}

.list-pending-section.collapsed {
  max-height: 48px;
}

.list-pending-content {
  max-height: 800px;
  overflow-y: auto;
  padding: 10px;
  padding-bottom: 18px;
  background: var(--bg-secondary);
}

.pending-draggable-list {
  width: 100%;
}

.empty-pending-list {
  text-align: center;
  padding: 24px;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

/* Active Tasks Section */
.list-active-section {
  background: var(--panel-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  flex-shrink: 0;
}

.list-status-filter {
  display: flex;
  gap: 4px;
}

.task-list-container {
  min-height: 420px;
  max-height: clamp(620px, 68vh, 820px);
  overflow-y: auto;
  padding: 10px;
  padding-bottom: 18px;
  background: var(--bg-secondary);
}

.tasks-draggable-list {
  width: 100%;
}

.empty-list {
  text-align: center;
  padding: 24px;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.task-list-container :deep(.task-item:last-child),
.list-pending-content :deep(.task-item:last-child) {
  margin-bottom: 0;
}

.task-list-container :deep(.task-item),
.list-pending-content :deep(.task-item) {
  box-shadow: none;
}

/* Drag and drop styles */
.task-ghost {
  opacity: 0.5;
  background: #f5f5f5;
  border: 1px dashed var(--el-border-color);
}

.task-drag {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
}
</style>
