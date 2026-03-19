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
      <div class="task-title-wrapper">
        <div class="task-title">{{ task.title || $t('task.untitled') }}</div>
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
      <div v-if="task.description && !compact" class="task-description">
        {{ task.description }}
      </div>
    </div>

    <!-- Running time indicator -->
    <div v-if="running" class="task-running-time">
      <span class="running-time">{{ elapsedTime }}</span>
    </div>

    <!-- Worktree button -->
    <el-tooltip v-if="showWorktree" :content="worktreeTooltip" placement="top">
      <button
        class="worktree-btn"
        :class="worktreeClass"
        @click.stop="openWorktreeDirectory"
        :disabled="worktreeLoading"
      >
        <el-icon v-if="worktreeLoading" class="is-loading"><Loading /></el-icon>
        <el-icon v-else-if="task.worktree_status === 'created'"><FolderOpened /></el-icon>
        <el-icon v-else><Folder /></el-icon>
      </button>
    </el-tooltip>

    <!-- Actions -->
    <div v-if="showActions" class="task-actions">
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
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loading, FolderOpened, Folder } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useWorktree } from '../../composables/useWorktree'
import { useStatusStyle } from '../../composables/useStatusStyle'
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
  }
})

const emit = defineEmits(['click', 'edit', 'delete', 'worktree-update'])

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

.task-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin-bottom: 2px;
}

.task-title-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
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
  font-size: 12px;
  color: var(--el-text-color-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
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

/* Actions */
.task-actions {
  display: flex;
  gap: 4px;
  transition: opacity 0.2s;
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

/* Loading animation */
.is-loading {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
