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
          <button class="sync-requirements-btn-list" @click="$emit('sync-requirements')" :disabled="syncing">
            <svg v-if="!syncing" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/>
            </svg>
            <svg v-else class="icon-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
              <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
            </svg>
            {{ syncing ? $t('taskSource.syncing') : $t('requirement.syncAllRequirements') }}
          </button>
          <!-- Status filter like task filter -->
          <el-checkbox-group
            :model-value="requirementStatusFilter"
            @update:model-value="$emit('update:requirementStatusFilter', $event)"
            size="small"
            class="requirement-filter-group"
          >
            <el-checkbox-button value="NEW">
              {{ $t('requirement.statuses.NEW') }}
            </el-checkbox-button>
            <el-checkbox-button value="CONVERTED">
              {{ $t('requirement.statuses.CONVERTED') }}
            </el-checkbox-button>
          </el-checkbox-group>
        </div>
      </div>
      <div class="list-requirements-content" v-show="!isRequirementsCollapsed">
        <draggable
          v-model="localRequirements"
          item-key="id"
          class="requirements-draggable-list"
          @end="onRequirementsReorder"
          :animation="200"
          ghost-class="requirement-ghost"
          drag-class="requirement-drag"
        >
          <template #item="{ element: req }">
            <div
              class="requirement-list-item"
              :class="{ 'is-converted': req.status === 'CONVERTED', 'is-selected': selectedRequirementIds.includes(req.id) }"
            >
              <div class="drag-handle">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="8" y1="6" x2="21" y2="6"></line>
                  <line x1="8" y1="12" x2="21" y2="12"></line>
                  <line x1="8" y1="18" x2="21" y2="18"></line>
                  <line x1="3" y1="6" x2="3.01" y2="6"></line>
                  <line x1="3" y1="12" x2="3.01" y2="12"></line>
                  <line x1="3" y1="18" x2="3.01" y2="18"></line>
                </svg>
              </div>
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
                <div class="requirement-list-title-row">
                  <span class="requirement-list-title">{{ req.title }}</span>
                  <span v-if="req.source" class="source-badge-inline">{{ getSourceLabel(req.source) }}</span>
                  <a
                    v-if="req.external_url"
                    :href="req.external_url"
                    target="_blank"
                    class="external-link-inline"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                      <polyline points="15 3 21 3 21 9"></polyline>
                      <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                    {{ $t('requirement.viewOriginal') }}
                  </a>
                </div>
                <div v-if="req.labels && req.labels.length > 0" class="requirement-labels">
                  <el-tag
                    v-for="label in req.labels"
                    :key="label"
                    size="small"
                    type="info"
                    class="requirement-label"
                  >
                    {{ label }}
                  </el-tag>
                </div>
                <div v-if="req.description" class="requirement-list-desc">
                  <span class="desc-label">描述:</span> {{ req.description }}
                </div>
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
          </template>
        </draggable>
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
        <!-- Status Filter and Add Button on Right -->
        <div class="list-section-right">
          <div class="list-section-actions">
            <button class="add-requirement-btn-list" @click="$emit('add-task')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              添加任务
            </button>
          </div>
          <div class="list-status-filter">
            <el-checkbox-group v-model="localStatusFilter" size="small">
              <el-checkbox-button v-for="status in allStatusOptions" :key="status" :value="status">
                {{ $t(`status.${status}`) }}
              </el-checkbox-button>
            </el-checkbox-group>
          </div>
        </div>
      </div>
      <div class="task-list-container">
        <div v-if="localTasks.length === 0" class="empty-list">
          <p>{{ $t('view.noTasksFound') }}</p>
        </div>
        <draggable
          v-model="localTasks"
          item-key="id"
          class="tasks-draggable-list"
          @end="onTasksReorder"
          :animation="200"
          ghost-class="task-ghost"
          drag-class="task-drag"
        >
          <template #item="{ element: task }">
            <div
              class="task-list-item"
              :class="{
                'task-selected': selectedTask?.id === task.id,
                'task-running': isTaskRunning(task.id)
              }"
              @click="$emit('select-task', task)"
            >
              <div class="task-drag-handle">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="8" y1="6" x2="21" y2="6"></line>
                  <line x1="8" y1="12" x2="21" y2="12"></line>
                  <line x1="8" y1="18" x2="21" y2="18"></line>
                  <line x1="3" y1="6" x2="3.01" y2="6"></line>
                  <line x1="3" y1="12" x2="3.01" y2="12"></line>
                  <line x1="3" y1="18" x2="3.01" y2="18"></line>
                </svg>
              </div>
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
                <div class="task-list-title">{{ task.title || $t('task.untitled') }}</div>
                <div v-if="task.description" class="task-list-description">{{ task.description }}</div>
              </div>
              <div v-if="isTaskRunning(task.id)" class="task-list-running">
                <span class="running-time">{{ formatElapsedTime(task.id) }}</span>
              </div>
              <!-- Worktree button -->
              <el-tooltip
                :content="getWorktreeTooltip(task)"
                placement="top"
              >
                <button
                  class="worktree-btn"
                  :class="getWorktreeClass(task)"
                  @click.stop="handleWorktree(task)"
                  :disabled="isWorktreeLoading(task.id)"
                >
                  <el-icon v-if="isWorktreeLoading(task.id)" class="is-loading"><Loading /></el-icon>
                  <el-icon v-else-if="task.worktree_status === 'created'"><FolderOpened /></el-icon>
                  <el-icon v-else><Folder /></el-icon>
                </button>
              </el-tooltip>
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
import { Loading, FolderOpened, Folder } from '@element-plus/icons-vue'
import * as taskWorktreeApi from '../../api/taskWorktree'
import { ElMessage } from 'element-plus'

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
  requirementStatusFilter: {
    type: Array,
    default: () => ['NEW']
  },
  statusFilter: {
    type: Array,
    default: () => ['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED']
  },
  selectedRequirementIds: {
    type: Array,
    default: () => []
  },
  syncing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'open-requirement-modal',
  'sync-requirements',
  'delete-requirement',
  'edit-requirement',
  'select-task',
  'edit-task',
  'delete-task',
  'update:requirementStatusFilter',
  'update:statusFilter',
  'add-task',
  'reorder-requirements',
  'reorder-tasks',
  'worktree-update'
])

const { t } = useI18n()

// Worktree state
const worktreeLoading = ref(new Set())

const isWorktreeLoading = (taskId) => worktreeLoading.value.has(taskId)

const getWorktreeClass = (task) => {
  if (task.worktree_status === 'created') return 'worktree-created'
  if (task.worktree_status === 'error') return 'worktree-error'
  return 'worktree-none'
}

const getWorktreeTooltip = (task) => {
  if (task.worktree_status === 'created') return 'Worktree 已创建，点击删除'
  if (task.worktree_status === 'error') return 'Worktree 创建失败'
  return '创建 Worktree 沙箱'
}

const handleWorktree = async (task) => {
  if (worktreeLoading.value.has(task.id)) return

  try {
    worktreeLoading.value.add(task.id)
    if (task.worktree_status === 'created') {
      // Delete worktree
      const response = await taskWorktreeApi.deleteTaskWorktree(task.id)
      if (response.success) {
        task.worktree_path = null
        task.worktree_branch = null
        task.worktree_status = 'none'
        ElMessage.success('Worktree 已删除')
        emit('worktree-update', task)
      }
    } else {
      // Create worktree
      const response = await taskWorktreeApi.createTaskWorktree(task.id)
      if (response.success) {
        task.worktree_path = response.data.worktree_path
        task.worktree_branch = response.data.worktree_branch
        task.worktree_status = 'created'
        ElMessage.success('Worktree 创建成功')
        emit('worktree-update', task)
      }
    }
  } catch (error) {
    ElMessage.error(error.message || '操作失败')
  } finally {
    worktreeLoading.value.delete(task.id)
  }
}

const isRequirementsCollapsed = ref(false)

// Local copy of requirements for draggable
const localRequirements = ref([])

// Sync requirements from props
watch(
  () => props.requirements,
  (newReqs) => {
    localRequirements.value = [...newReqs]
  },
  { immediate: true, deep: true }
)

// Handle requirements reorder
const onRequirementsReorder = (event) => {
  // Emit the new order to parent component
  emit('reorder-requirements', localRequirements.value)
}

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

// Handle tasks reorder
const onTasksReorder = (event) => {
  // Emit the new order to parent component
  emit('reorder-tasks', localTasks.value)
}

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
    CRITICAL: t('priority.CRITICAL'),
    HIGH: t('priority.HIGH'),
    MEDIUM: t('priority.MEDIUM'),
    LOW: t('priority.LOW')
  }
  return labelMap[priority] || t('priority.MEDIUM')
}

// Helper function to get source type label
const getSourceLabel = (source) => {
  const labelMap = {
    GITHUB: 'GitHub',
    JIRA: 'Jira',
    GITLAB: 'GitLab',
    LINEAR: 'Linear'
  }
  return labelMap[source] || source
}
</script>

<style scoped>
.task-list-view {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  padding-bottom: 32px;
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
  flex-shrink: 0;
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

.list-section-right {
  display: flex;
  align-items: center;
  gap: 12px;
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
.sync-requirements-btn-list,
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

.add-requirement-btn-list:hover,
.sync-requirements-btn-list:hover:not(:disabled) {
  border-color: #3b82f6;
  color: #3b82f6;
  background: #eff6ff;
}

.sync-requirements-btn-list:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle-converted-btn-list.is-hiding {
  color: var(--el-color-warning);
}

.requirement-filter-group {
  display: flex;
  gap: 4px;
}

.requirement-filter-group .el-checkbox-button__inner {
  font-size: 11px;
  padding: 3px 8px;
}

.list-requirements-content {
  max-height: 800px;
  overflow-y: auto;
  padding: 8px;
  padding-bottom: 16px;
}

.requirement-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 6px;
  margin-bottom: 8px;
  background: #fff;
  border: 1px solid var(--el-border-color-light);
  transition: all 0.2s;
  cursor: grab;
}

.requirement-list-item:active {
  cursor: grabbing;
}

.drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  color: var(--el-text-color-placeholder);
  cursor: grab;
  opacity: 0.5;
  transition: opacity 0.2s;
}

.requirement-list-item:hover .drag-handle {
  opacity: 1;
}

.requirement-ghost {
  opacity: 0.5;
  background: #f5f5f5;
  border: 1px dashed var(--el-border-color);
}

.requirement-drag {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
}

.requirement-list-item:hover {
  border-color: #a855f7;
  box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.15);
}

.requirement-list-item.is-converted {
  opacity: 0.6;
}

.requirement-list-item.is-selected {
  border-color: #a855f7;
  box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.2);
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

.requirement-list-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.source-badge-inline {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 500;
  flex-shrink: 0;
}

.external-link-inline {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--el-color-primary);
  text-decoration: none;
  flex-shrink: 0;
}

.external-link-inline:hover {
  text-decoration: underline;
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
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.desc-label {
  color: #9ca3af;
  font-size: 11px;
}

.requirement-labels {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.requirement-label {
  font-size: 10px;
  padding: 0 4px;
}

.requirement-list-tags {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
  margin-left: 8px;
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
  flex-shrink: 0;
}

.list-status-filter {
  display: flex;
  gap: 4px;
}

.task-list-container {
  max-height: 500px;
  overflow-y: auto;
  padding: 8px;
  padding-bottom: 16px;
}

.tasks-draggable-list {
  width: 100%;
}

.task-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 8px;
  background: #fff;
  border: 1px solid var(--el-border-color-light);
  cursor: pointer;
  transition: all 0.2s;
}

.task-drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  color: var(--el-text-color-placeholder);
  cursor: grab;
  opacity: 0.5;
  transition: opacity 0.2s;
}

.task-list-item:hover .task-drag-handle {
  opacity: 1;
}

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
  min-width: 32px;
  text-align: center;
}

.priority-critical {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

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

/* Worktree button styles for list view */
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
