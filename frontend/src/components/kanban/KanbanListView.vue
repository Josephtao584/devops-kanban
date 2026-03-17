<template>
  <div class="task-list-view" ref="taskListRef">
    <!-- Requirements Section in List View (Collapsible) -->
    <div class="list-requirements-section" :class="{ collapsed: isRequirementsCollapsed }">
      <div class="list-section-header" @click="isRequirementsCollapsed = !isRequirementsCollapsed">
        <div class="list-section-title">
          <svg class="collapse-icon" :class="{ rotated: isRequirementsCollapsed }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
          {{ $t('requirement.title') }}
          <span class="section-count">{{ requirements.length }}</span>
        </div>
        <div class="list-section-actions" @click.stop>
          <button class="add-requirement-btn-list" @click="$emit('open-requirement-modal')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            {{ $t('requirement.addRequirement') }}
          </button>
          <button
            class="toggle-converted-btn-list"
            :class="{ 'is-hiding': hideConverted }"
            @click.stop="$emit('update:hideConverted', !hideConverted)"
            :title="hideConverted ? $t('requirement.showConverted') : $t('requirement.hideConverted')"
          >
            <svg v-if="hideConverted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
        </div>
      </div>
      <div class="list-requirements-content" v-show="!isRequirementsCollapsed">
        <div
          v-for="req in requirements"
          :key="req.id"
          class="requirement-list-item"
          :class="{ 'is-converted': req.status === 'CONVERTED' }"
        >
          <div class="requirement-list-status">
            <span class="req-status-badge" :class="getReqStatusClass(req.status)">
              {{ getReqStatusLabel(req.status) }}
            </span>
          </div>
          <div class="requirement-list-priority">
            <span class="priority-badge" :class="getPriorityClass(req.priority)">
              {{ getPriorityLabel(req.priority) }}
            </span>
          </div>
          <div class="requirement-list-content">
            <div class="requirement-list-title">{{ req.title }}</div>
            <div v-if="req.description" class="requirement-list-desc">{{ req.description }}</div>
          </div>
          <div class="requirement-list-actions">
            <button
              class="edit-req-btn"
              @click.stop="$emit('edit-requirement', req)"
              :title="$t('common.edit')"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button
              class="delete-req-btn"
              @click.stop="$emit('delete-requirement', req.id)"
              :title="$t('common.delete')"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
        <div v-if="requirements.length === 0" class="empty-requirements-list">
          <p>{{ $t('requirement.noRequirements') }}</p>
        </div>
      </div>
    </div>

    <!-- Tasks Section in List View -->
    <div class="list-tasks-section">
      <div class="list-section-header">
        <div class="list-section-title">
          {{ $t('task.title') }}
          <span class="section-count">{{ filteredTasks.length }}</span>
        </div>
        <!-- Status Filter for List View -->
        <div class="list-status-filter">
          <el-checkbox-group v-model="localStatusFilter" size="small">
            <el-checkbox-button v-for="status in allStatusOptions" :key="status" :value="status">
              {{ $t(`status.${status}`) }}
            </el-checkbox-button>
          </el-checkbox-group>
        </div>
      </div>
      <div class="task-list-container">
        <div v-if="filteredTasks.length === 0" class="empty-list">
          <p>{{ $t('view.noTasksFound') }}</p>
        </div>
        <div
          v-for="task in filteredTasks"
          :key="task.id"
          class="task-list-item"
          :class="{
            'task-selected': selectedTask?.id === task.id,
            'task-running': isTaskRunning(task.id)
          }"
          @click="$emit('select-task', task)"
        >
          <div class="task-list-status">
            <span class="status-badge" :class="getStatusClass(task.status)">
              {{ $t(`status.${task.status}`) }}
            </span>
          </div>
          <div class="task-list-priority">
            <span class="priority-badge" :class="getPriorityClass(task.priority)">
              {{ getPriorityLabel(task.priority) }}
            </span>
          </div>
          <div class="task-list-content">
            <div class="task-list-title">{{ task.title }}</div>
            <div v-if="task.description" class="task-list-description">{{ task.description }}</div>
          </div>
          <div v-if="isTaskRunning(task.id)" class="task-list-running">
            <span class="running-time">{{ formatElapsedTime(task.id) }}</span>
          </div>
          <div class="task-list-actions">
            <button
              class="edit-btn"
              @click.stop="$emit('edit-task', task)"
              :title="$t('common.edit')"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button
              class="delete-btn"
              @click.stop="$emit('delete-task', task.id)"
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
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  requirements: {
    type: Array,
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
  hideConverted: {
    type: Boolean,
    default: false
  },
  statusFilter: {
    type: Array,
    default: () => ['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED']
  }
})

const emit = defineEmits([
  'open-requirement-modal',
  'delete-requirement',
  'edit-requirement',
  'select-task',
  'edit-task',
  'delete-task',
  'update:hideConverted',
  'update:statusFilter'
])

const { t } = useI18n()

const isRequirementsCollapsed = ref(false)

const localStatusFilter = computed({
  get: () => props.statusFilter,
  set: (value) => emit('update:statusFilter', value)
})

const allStatusOptions = ['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED']

const filteredTasks = computed(() => {
  return props.tasks.filter(task => localStatusFilter.value.includes(task.status))
})

const isTaskRunning = (taskId) => {
  return props.runningTaskIds?.has?.(taskId) || false
}

const formatElapsedTime = (taskId) => {
  // TODO: Implement with useTaskTimer composable
  return ''
}

const getReqStatusClass = (status) => {
  const classMap = {
    NEW: 'req-new',
    ANALYZING: 'req-analyzing',
    APPROVED: 'req-approved',
    DRAFT: 'req-draft',
    CONVERTED: 'req-converted',
    ARCHIVED: 'req-archived',
    REJECTED: 'req-rejected'
  }
  return classMap[status] || 'req-new'
}

const getReqStatusLabel = (status) => {
  return t(`requirement.statuses.${status}`) || status
}

const getStatusClass = (status) => {
  const classMap = {
    TODO: 'status-todo',
    IN_PROGRESS: 'status-in-progress',
    DONE: 'status-done',
    BLOCKED: 'status-blocked'
  }
  return classMap[status] || 'status-todo'
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
</script>

<style scoped>
.task-list-view {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Requirements Section */
.list-requirements-section {
  background: var(--el-bg-color);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
  overflow: hidden;
}

.list-requirements-section.collapsed {
  max-height: 48px;
}

.list-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--el-bg-color-page);
  border-bottom: 1px solid var(--el-border-color-light);
  cursor: pointer;
}

.list-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.collapse-icon {
  transition: transform 0.2s;
}

.collapse-icon.rotated {
  transform: rotate(-90deg);
}

.section-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  padding: 2px 8px;
  border-radius: 10px;
}

.list-section-actions {
  display: flex;
  gap: 8px;
}

.add-requirement-btn-list,
.toggle-converted-btn-list {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
  border-radius: 4px;
  cursor: pointer;
  color: var(--el-text-color-regular);
  transition: all 0.2s;
}

.add-requirement-btn-list:hover {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-5);
}

.toggle-converted-btn-list.is-hiding {
  color: var(--el-color-warning);
}

.list-requirements-content {
  max-height: 400px;
  overflow-y: auto;
  padding: 8px;
}

.requirement-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 6px;
  margin-bottom: 8px;
  background: var(--el-bg-color-page);
  border: 1px solid var(--el-border-color-light);
}

.requirement-list-item.is-converted {
  opacity: 0.6;
}

.requirement-list-status,
.requirement-list-priority {
  flex-shrink: 0;
}

.req-status-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.req-pending {
  background: var(--el-color-info-light-9);
  color: var(--el-color-info);
}

.req-converted {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.req-new {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}

.req-analyzing {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.req-approved {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.req-draft {
  background: var(--el-color-info-light-9);
  color: var(--el-color-info);
}

.req-archived {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
}

.req-rejected {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.requirement-list-content {
  flex: 1;
  min-width: 0;
}

.requirement-list-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin-bottom: 2px;
}

.requirement-list-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.requirement-list-actions {
  display: flex;
  gap: 4px;
}

.edit-req-btn,
.delete-req-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  color: var(--el-text-color-secondary);
  transition: all 0.2s;
}

.edit-req-btn:hover {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.delete-req-btn:hover {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.empty-requirements-list {
  text-align: center;
  padding: 20px;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}

/* Tasks Section */
.list-tasks-section {
  background: var(--el-bg-color);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
  overflow: hidden;
}

.list-status-filter {
  display: flex;
  gap: 4px;
}

.task-list-container {
  max-height: 500px;
  overflow-y: auto;
  padding: 8px;
}

.task-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 8px;
  background: var(--el-bg-color-page);
  border: 1px solid var(--el-border-color-light);
  cursor: pointer;
  transition: all 0.2s;
}

.task-list-item:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.task-list-item.task-selected {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-9);
}

.status-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.status-todo { background: var(--el-color-info-light-9); color: var(--el-color-info); }
.status-in-progress { background: var(--el-color-warning-light-9); color: var(--el-color-warning); }
.status-done { background: var(--el-color-success-light-9); color: var(--el-color-success); }
.status-blocked { background: var(--el-color-danger-light-9); color: var(--el-color-danger); }

.priority-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  font-weight: 500;
}

.priority-critical { background: var(--el-color-danger-light-9); color: var(--el-color-danger); }
.priority-high { background: var(--el-color-warning-light-9); color: var(--el-color-warning); }
.priority-medium { background: var(--el-color-primary-light-9); color: var(--el-color-primary); }
.priority-low { background: var(--el-color-info-light-9); color: var(--el-color-info); }

.task-list-content {
  flex: 1;
  min-width: 0;
}

.task-list-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin-bottom: 2px;
}

.task-list-description {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.task-list-running {
  font-size: 11px;
  color: var(--el-color-primary);
  font-family: monospace;
}

.task-list-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.task-list-item:hover .task-list-actions {
  opacity: 1;
}

.task-list-actions button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  color: var(--el-text-color-secondary);
  transition: all 0.2s;
}

.task-list-actions button:hover {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.task-list-actions .delete-btn:hover {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.empty-list {
  text-align: center;
  padding: 20px;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}

.icon-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
