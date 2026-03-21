<template>
  <div
    class="task-item"
    :class="{
      'task-selected': selected,
      'task-running': running,
      'task-compact': compact
    }"
    :data-status="task.status"
    @click="$emit('click', task)"
  >
    <!-- Drag handle (optional) -->
    <div v-if="showDragHandle" class="task-drag-handle">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="8" y1="6" x2="21" y2="6"></line>
        <line x1="8" y1="12" x2="21" y2="12"></line>
        <line x1="8" y1="18" x2="21" y2="18"></line>
        <line x1="3" y1="6" x2="3.01" y2="6"></line>
        <line x1="3" y1="12" x2="3.01" y2="12"></line>
        <line x1="3" y1="18" x2="3.01" y2="18"></line>
      </svg>
    </div>

    <!-- Status badge -->
    <div v-if="showStatus" class="task-status">
      <span class="status-badge" :class="statusClass">
        {{ statusText }}
      </span>
    </div>

    <!-- Priority badge -->
    <div class="task-priority">
      <PriorityBadge :priority="task.priority" />
    </div>

    <!-- Content -->
    <div class="task-content">
      <div class="task-title-row">
        <div class="task-title-left">
          <div class="task-title">{{ task.title || $t('task.untitled') }}</div>
          <a
            v-if="task.external_url"
            :href="task.external_url"
            target="_blank"
            class="github-link"
            @click.stop
          >
            <el-tag type="info" size="small">
              外部链接
            </el-tag>
          </a>
        </div>
        <div class="task-actions">
          <button
            class="action-btn edit-btn"
            @click.stop="$emit('edit', task)"
            :title="$t('common.edit')"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button
            class="action-btn delete-btn"
            @click.stop="$emit('delete', task.id)"
            :title="$t('common.delete')"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
      <div class="task-description-row">
        <div v-if="task.description && !compact" class="task-description">
          {{ task.description }}
        </div>
        <button
          v-if="workflowData || task.workflow_run_id"
          class="workflow-inline-btn"
          @click.stop="$emit('toggle-workflow', task.id)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
          查看 Workflow
        </button>
      </div>
    </div>

    <!-- Workflow expanded content (shown when workflow is expanded) -->
    <div v-if="workflowExpanded && (workflowData || task.workflow_run_id)" class="workflow-expanded-content">
      <div class="workflow-main">
        <div class="workflow-section workflow-progress-bar">
          <span class="workflow-status" :class="'status-' + workflowStatus">{{ workflowStatusText }}</span>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
          </div>
          <span class="progress-text">{{ completed }}/{{ total }}</span>
          <button
            class="workflow-collapse-btn"
            @click.stop="$emit('toggle-workflow', task.id)"
            title="收起 Workflow"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15 18l-6-6 6-6"></path>
              <path d="M19 18l-6-6 6-6"></path>
            </svg>
          </button>
        </div>

        <div v-if="currentNode" class="workflow-section node-detail">
          <span class="node-detail-name">{{ currentNode.name }}</span>
          <span class="node-detail-status" :class="'status-' + currentNode.status?.toLowerCase()">
            {{ getStatusText(currentNode.status) }}
          </span>
          <span v-if="currentNode.duration" class="node-detail-duration">{{ currentNode.duration }}min</span>
          <span v-if="currentNode.role" class="node-detail-role">@{{ currentNode.role }}</span>
        </div>

        <div class="workflow-section">
          <InlineWorkflowPanel
            v-if="workflowData"
            :workflow="workflowData"
            :currentNodeId="currentNode?.id"
            :compact="true"
            @node-click="handleNodeClick"
          />
        </div>

        <div class="workflow-section quick-actions">
          <button class="quick-action-btn" @click.stop="$emit('workflow-action', 'start')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            启动
          </button>
          <button class="quick-action-btn" @click.stop="$emit('workflow-action', 'pause')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="6" y="4" width="4" height="16"></rect>
              <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
            暂停
          </button>
          <button class="quick-action-btn" @click.stop="$emit('workflow-action', 'diff')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 3v18M3 12h18M8 8l-4 4 4 4M16 8l4 4-4 4"></path>
            </svg>
            差异
          </button>
          <button class="quick-action-btn" @click.stop="$emit('workflow-action', 'commit')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            提交
          </button>
          <button class="quick-action-btn" @click.stop="$emit('workflow-action', 'progress')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="20" x2="12" y2="10"></line>
              <line x1="18" y1="20" x2="18" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="16"></line>
            </svg>
            进度
          </button>
          <button class="quick-action-btn" @click.stop="$emit('workflow-action', 'help')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            帮助
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loading, FolderOpened, Folder } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useWorktree } from '../../composables/useWorktree'
import { useStatusStyle } from '../../composables/useStatusStyle'
import { getWorkflowProgress, getWorkflowByTask } from '../../mock/workflowData'
import InlineWorkflowPanel from '../workflow/InlineWorkflowPanel.vue'
import PriorityBadge from '../common/PriorityBadge.vue'

const props = defineProps({
  task: {
    type: Object,
    required: true
  },
  selected: {
    type: Boolean,
    default: false
  },
  running: {
    type: Boolean,
    default: false
  },
  elapsedTime: {
    type: String,
    default: ''
  },
  showWorktree: {
    type: Boolean,
    default: true
  },
  showActions: {
    type: Boolean,
    default: true
  },
  showStatus: {
    type: Boolean,
    default: false
  },
  showDragHandle: {
    type: Boolean,
    default: false
  },
  compact: {
    type: Boolean,
    default: false
  },
  statusText: {
    type: String,
    default: ''
  },
  workflowExpanded: {
    type: Boolean,
    default: false
  },
  workflow: {
    type: Object,
    default: null
  },
  currentNode: {
    type: Object,
    default: null
  },
  currentNodeId: {
    type: [String, Number],
    default: null
  }
})

const emit = defineEmits(['click', 'edit', 'delete', 'worktree-update', 'toggle-workflow', 'workflow-action', 'node-click'])

const { t } = useI18n()

// Use composables
const { isWorktreeLoading, getWorktreeClass, getWorktreeTooltip, handleWorktree: handleWorktreeAction } = useWorktree()
const { getStatusClass } = useStatusStyle()

// Computed
const worktreeLoading = computed(() => isWorktreeLoading(props.task.id))
const worktreeClass = computed(() => getWorktreeClass(props.task))
const worktreeTooltip = computed(() => {
  if (props.task.worktree_status === 'created') return '打开本地目录'
  if (props.task.worktree_status === 'error') return 'Worktree 创建失败'
  return '创建 Worktree 沙箱'
})
const statusClass = computed(() => getStatusClass(props.task.status))

// Workflow data - either from prop or computed from task
const workflowData = computed(() => {
  if (props.workflow) return props.workflow
  if (props.task?.id) {
    return getWorkflowByTask(props.task.id)
  }
  return null
})

// Current node - from prop or computed from currentNodeId
const currentNode = computed(() => {
  if (props.currentNode) return props.currentNode
  if (!props.currentNodeId || !workflowData.value?.stages) return null
  for (const stage of workflowData.value.stages) {
    const node = stage.nodes?.find(n => n.id === props.currentNodeId)
    if (node) return node
  }
  return null
})

// Workflow progress computation
const workflowProgress = computed(() => {
  if (!workflowData.value) return { completed: 0, total: 0, percent: 0 }
  return getWorkflowProgress(workflowData.value)
})

const completed = computed(() => workflowProgress.value.completed)
const total = computed(() => workflowProgress.value.total)
const progressPercent = computed(() => workflowProgress.value.percent)

// Status text helper
const getStatusText = (status) => {
  const statusMap = {
    'DONE': '已完成',
    'IN_PROGRESS': '进行中',
    'PENDING': '待处理',
    'FAILED': '失败',
    'REJECTED': '已打回',
    'TODO': '待办'
  }
  return statusMap[status] || status
}

// Workflow status computation
const workflowStatus = computed(() => {
  if (!workflowData.value) return 'pending'
  const { completed, total } = workflowProgress.value
  if (completed === 0) return 'pending' // 待启动
  if (completed === total) return 'done' // 完成
  // 检查是否有失败的节点
  for (const stage of workflowData.value.stages) {
    if (stage.nodes?.some(n => n.status === 'FAILED')) return 'failed'
  }
  // 检查是否有进行中的节点
  for (const stage of workflowData.value.stages) {
    if (stage.nodes?.some(n => n.status === 'IN_PROGRESS')) return 'running'
  }
  return 'paused' // 暂停
})

const workflowStatusText = computed(() => {
  const textMap = {
    'pending': '待启动',
    'running': '运行中',
    'paused': '已暂停',
    'done': '已完成',
    'failed': '已失败'
  }
  return textMap[workflowStatus.value] || '待启动'
})

// Handle node click
const handleNodeClick = (node) => {
  emit('workflow-action', { action: 'node-click', node, task: props.task })
}

const openWorktreeDirectory = () => {
  if (props.task.worktree_status === 'created' && props.task.worktree_path) {
    // Copy path to clipboard and show message
    navigator.clipboard.writeText(props.task.worktree_path).then(() => {
      ElMessage.success('路径已复制到剪贴板')
    }).catch(() => {
      ElMessage.info(`Worktree 路径: ${props.task.worktree_path}`)
    })
  } else if (props.task.worktree_status !== 'created') {
    // Create worktree if not created
    handleWorktreeAction(props.task, (updatedTask) => {
      emit('worktree-update', updatedTask)
    })
  }
}
</script>

<style scoped>
.task-item {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 14px;
  border-radius: 8px;
  margin-bottom: 10px;
  background: #fff;
  border: 1px solid var(--el-border-color-light);
  border-left: 4px solid #94a3b8;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
  will-change: transform;
  width: 100%;
  box-sizing: border-box;
}

/* Status-based colors */
.task-item[data-status="TODO"] {
  border-left-color: #6b7280;
  background-color: #fafafa;
}

.task-item[data-status="IN_PROGRESS"] {
  border-left-color: #3b82f6;
  background-color: #f0f7ff;
}

.task-item[data-status="DONE"] {
  border-left-color: #10b981;
  background-color: #f0fdf4;
}

.task-item[data-status="BLOCKED"] {
  border-left-color: #ef4444;
  background-color: #fef2f2;
}

.task-item:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.task-item.task-selected,
.task-item.task-selected:hover {
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.15);
}

.task-item.task-running {
  border-left: 3px solid var(--el-color-primary);
}

/* Compact mode */
.task-item.task-compact {
  padding: 8px 10px;
  gap: 8px;
}

/* Drag handle */
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

.task-item:hover .task-drag-handle {
  opacity: 1;
}

/* Status */
.task-status {
  flex-shrink: 0;
}

/* Priority */
.task-priority {
  flex-shrink: 0;
}

/* Content */
.task-content {
  flex: 1;
  min-width: 0;
}

.task-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.task-title-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.task-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.github-link {
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  width: fit-content;
}

.github-link:hover {
  opacity: 0.8;
}

.task-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.task-description-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.task-description {
  flex: 1;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.workflow-inline-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
  color: #6366f1;
  background: transparent;
  border: 1px solid #c7d2fe;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  white-space: nowrap;
}

.workflow-inline-btn:hover {
  background: #eef2ff;
  border-color: #6366f1;
  color: #4f46e5;
}

.task-iteration {
  margin-top: 4px;
  display: inline-flex;
}

/* Running time */
.task-running-time {
  flex-shrink: 0;
}

.running-time {
  font-size: 11px;
  color: var(--el-color-primary);
  font-family: monospace;
}

/* Worktree button */
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
  color: var(--el-text-color-secondary);
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

/* Action buttons */
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

/* Status badge */
.status-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
  display: inline-block;
}

/* Workflow expanded content */
.workflow-expanded-content {
  flex-basis: 100%;
  border-top: 2px solid #6366f1;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
}

.workflow-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* Workflow sections */
.workflow-section {
  padding: 12px 14px;
  border-bottom: 1px solid #e2e8f0;
}

.workflow-section:last-child {
  border-bottom: none;
}

/* Progress bar */
.workflow-progress-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.workflow-status {
  font-size: 12px;
  font-weight: 500;
  padding: 2px 10px;
  border-radius: 10px;
  white-space: nowrap;
}

.workflow-status.status-pending {
  background: #f1f5f9;
  color: #64748b;
}

.workflow-status.status-running {
  background: #dbeafe;
  color: #2563eb;
}

.workflow-status.status-paused {
  background: #fef3c7;
  color: #d97706;
}

.workflow-status.status-done {
  background: #d1fae5;
  color: #059669;
}

.workflow-status.status-failed {
  background: #fee2e2;
  color: #dc2626;
}

.workflow-progress-bar .progress-bar {
  flex: 1;
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

.workflow-progress-bar .progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
  border-radius: 4px;
  transition: width 0.4s ease;
}

.workflow-progress-bar .progress-text {
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
  min-width: 60px;
  text-align: right;
}

/* Node detail */
.node-detail {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.node-detail-name {
  font-weight: 600;
  color: #334155;
}

.node-detail-status {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.node-detail-status.status-done {
  background: #d1fae5;
  color: #059669;
}

.node-detail-status.status-in_progress {
  background: #fef3c7;
  color: #d97706;
}

.node-detail-status.status-failed,
.node-detail-status.status-rejected {
  background: #fee2e2;
  color: #dc2626;
}

.node-detail-duration {
  color: #059669;
  font-weight: 500;
  font-size: 12px;
}

.node-detail-role {
  color: #64748b;
  font-size: 12px;
}

/* Quick actions */
.quick-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.quick-actions .quick-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 500;
  color: #475569;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.quick-actions .quick-action-btn:hover {
  background: #6366f1;
  border-color: #6366f1;
  color: #fff;
}

.workflow-collapse-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  color: #6366f1;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.workflow-collapse-btn:hover {
  color: #4f46e5;
  background: #e0e7ff;
  border-color: #6366f1;
  transform: translateX(-1px);
}

/* Loading animation */
.is-loading {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.status-todo {
  background: var(--el-color-info-light-9);
  color: var(--el-color-info);
}

.status-in-progress {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}

.status-done {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.status-blocked {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}
</style>
