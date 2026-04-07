<template>
  <div
    class="task-item"
    :class="{
      'task-selected': selected,
      'task-running': running,
      'task-compact': compact
    }"
    :data-id="task.id"
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
            class="worktree-btn"
            :class="worktreeClass"
            :disabled="worktreeLoading"
            :title="worktreeTooltip"
            @click.stop="openWorktreeDirectory"
          >
            <el-icon v-if="worktreeLoading" class="icon-spin"><Loading /></el-icon>
            <el-icon v-else-if="task.worktree_status === 'created'"><FolderOpened /></el-icon>
            <el-icon v-else><Folder /></el-icon>
          </button>
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
      <div class="task-description-row with-separator" v-if="task.description && !compact">
        <div
          ref="descriptionRef"
          class="task-description"
          :class="{ expanded: descriptionExpanded }"
          v-html="formattedDescription"
        ></div>
        <button
          v-if="descriptionOverflow || descriptionExpanded"
          class="description-toggle-btn"
          @click.stop="$emit('toggle-description', task.id)"
        >
          {{ descriptionExpanded ? '收起 ↑' : '展开 ↓' }}
        </button>
        <button
          class="workflow-collapse-btn description-collapse-btn"
          @click.stop="$emit('toggle-workflow', task.id)"
          :title="workflowExpanded ? '收起 Workflow' : '展开 Workflow'"
        >
          <svg v-if="workflowExpanded" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 18l-6-6 6-6"></path>
            <path d="M19 18l-6-6 6-6"></path>
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      </div>
    </div>

    <!-- Workflow expanded content (shown when task is expanded) -->
    <div v-if="workflowExpanded" class="workflow-expanded-content" @click.stop>
      <div class="workflow-main">
        <div v-if="!(workflowData || task.workflow_run_id)" class="workflow-section workflow-empty-state">
          <span class="workflow-empty-title">{{ $t('workflow.noWorkflow') }}</span>
          <span class="workflow-empty-hint">可先创建 worktree，或直接启动任务后生成 workflow。</span>
        </div>

        <div
          class="workflow-section workflow-panel-section"
          :class="{ 'workflow-panel-section-bordered': workflowData || task.workflow_run_id }"
        >
          <div class="workflow-panel-header">
            <span class="workflow-panel-title">工作流</span>
            <span
              v-if="workflowData || task.workflow_run_id"
              class="quick-action-status workflow-status"
              :class="'status-' + workflowStatus"
            >
              {{ workflowStatusText }}
            </span>
            <span v-if="workflowStartTime" class="workflow-time">
              开始: {{ workflowStartTime }}
            </span>
            <span v-if="workflowEndTime" class="workflow-time">
              结束: {{ workflowEndTime }}
            </span>
          </div>
          <InlineWorkflowPanel
            v-if="workflowData"
            :workflow="workflowData"
            :currentNodeId="currentNode?.id"
            :compact="true"
            @node-click="handleNodeClick"
          />
        </div>

        <div class="workflow-section quick-actions">

          <button class="quick-action-btn" :disabled="!canStartTask" @click.stop="handleStartClick">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            启动
          </button>
          <button class="quick-action-btn" @click.stop="$emit('workflow-action', 'commit')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            提交
          </button>
          <button class="quick-action-btn" @click.stop="$emit('workflow-action', 'diff')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 3v18M3 12h18M8 8l-4 4 4 4M16 8l4 4-4 4"></path>
            </svg>
            差异
          </button>
          <button class="quick-action-btn" @click.stop="$emit('workflow-action', 'merge')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="18" r="3"></circle>
              <circle cx="6" cy="6" r="3"></circle>
              <circle cx="18" cy="6" r="3"></circle>
              <path d="M6 9v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V9"></path>
              <line x1="12" cy="15" x2="12" y2="15"></line>
            </svg>
            合入
          </button>
          <button
            v-if="task.workflow_run_id"
            class="quick-action-btn"
            :disabled="refreshLoading"
            @click.stop="refreshWorkflowRun"
            title="刷新状态"
          >
            <span class="workflow-refresh-icon" :class="{ 'is-loading': refreshLoading }">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
              </svg>
            </span>
            刷新
          </button>
          <button
            v-if="(workflowStatus === 'running' || workflowStatus === 'suspended') && task.workflow_run_id"
            class="quick-action-btn quick-action-cancel"
            :disabled="cancelLoading"
            @click.stop="handleCancelWorkflow"
            title="取消工作流"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            取消
          </button>
          <button
            v-if="workflowStatus === 'suspended' && task.workflow_run_id"
            class="quick-action-btn quick-action-resume"
            :disabled="resumeLoading"
            @click.stop="handleResumeWorkflow"
            title="确认继续"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            确认继续
          </button>
          <button
            v-if="(workflowStatus === 'failed' || workflowStatus === 'cancelled') && task.workflow_run_id"
            class="quick-action-btn quick-action-retry"
            :disabled="retryLoading"
            @click.stop="handleRetryWorkflow"
            title="重试工作流"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
            重试
          </button>
          <el-checkbox
            v-if="task.workflow_run_id && !isWorkflowTerminal"
            v-model="pollingEnabled"
            class="auto-refresh-checkbox"
            size="small"
            @change="handleAutoRefreshChange"
          >
            自动刷新
          </el-checkbox>
        </div>

        <div class="workflow-section worktree-summary">
          <div class="worktree-summary-header">
            <div class="worktree-summary-header-main">
              <span class="worktree-summary-title">{{ $t('git.worktree', 'Git Worktree') }}</span>
              <span class="worktree-summary-status" :class="worktreeClass">{{ workflowWorktreeStatusText }}</span>
            </div>
            <button
              v-if="task.worktree_status === 'created'"
              class="worktree-summary-delete-btn"
              :disabled="worktreeLoading"
              @click.stop="handleDeleteWorktree"
            >
              {{ $t('git.deleteWorktree', '删除工作树') }}
            </button>
          </div>
          <div v-if="task.worktree_branch" class="worktree-summary-row">
            <span class="worktree-summary-label">{{ $t('git.branch', 'Branch') }}</span>
            <code class="worktree-summary-value worktree-summary-branch">{{ task.worktree_branch }}</code>
          </div>
          <div v-if="task.worktree_path" class="worktree-summary-row">
            <span class="worktree-summary-label">{{ $t('git.path', 'Path') }}</span>
            <span class="worktree-summary-value worktree-summary-path worktree-summary-path-wrap" :title="task.worktree_path">{{ task.worktree_path }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loading, FolderOpened, Folder } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { formatTaskDescription } from '../../utils/taskDescriptionFormatter'
import { useWorktree } from '../../composables/useWorktree'
import { useStatusStyle } from '../../composables/useStatusStyle'
import { useWorkflowRunPolling } from '../../composables/kanban/useWorkflowRunPolling'
import { getWorkflowRun, cancelWorkflow, retryWorkflow, resumeWorkflow } from '../../api/workflow'
import {
  toTimelineWorkflow,
  getWorkflowProgress,
  getCurrentWorkflowNode,
  getWorkflowDisplayStatus
} from '../../utils/workflowRunViewModel'
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
  descriptionExpanded: {
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

const emit = defineEmits(['click', 'edit', 'delete', 'worktree-update', 'toggle-workflow', 'toggle-description', 'workflow-action', 'node-click'])

const { t } = useI18n()

// Use composables
const { isWorktreeLoading, getWorktreeClass, getWorktreeTooltip, getWorktreeStatusText, createWorktree, deleteWorktree } = useWorktree()
const { getStatusClass } = useStatusStyle()

// Description overflow detection
const descriptionRef = ref(null)
const descriptionOverflow = ref(false)

const checkDescriptionOverflow = () => {
  if (descriptionRef.value) {
    descriptionOverflow.value = descriptionRef.value.scrollHeight > descriptionRef.value.clientHeight + 2
  }
}

// Real workflow run data from API
const realWorkflowRun = ref(null)
const refreshLoading = ref(false)
const cancelLoading = ref(false)
const retryLoading = ref(false)
const resumeLoading = ref(false)

// Check if workflow run is in a terminal state
const isWorkflowTerminal = computed(() => {
  if (!realWorkflowRun.value) return false
  return ['COMPLETED', 'FAILED', 'CANCELLED'].includes(realWorkflowRun.value.status)
})

// Fetch workflow run data (used by both manual refresh and polling)
const fetchWorkflowRun = async () => {
  if (!props.task?.workflow_run_id) return
  try {
    const response = await getWorkflowRun(props.task.workflow_run_id)
    if (response.success) {
      realWorkflowRun.value = response.data
    }
  } catch (error) {
    console.error('Failed to fetch workflow run:', error)
  }
}

// Polling composable for auto-refresh
const { pollingEnabled, isPolling, startPolling, stopPolling, togglePolling } = useWorkflowRunPolling({
  fetchFn: fetchWorkflowRun,
  isTerminal: () => isWorkflowTerminal.value,
  interval: 3000
})

// Fetch workflow run when expanded and start/stop polling accordingly
watch(() => [props.workflowExpanded, props.task?.workflow_run_id], async ([expanded, runId]) => {
  if (expanded && runId) {
    await fetchWorkflowRun()
    if (!isWorkflowTerminal.value && pollingEnabled.value) {
      startPolling()
    }
  } else {
    realWorkflowRun.value = null
    stopPolling()
  }
}, { immediate: true })

// Stop polling when workflow reaches terminal state
watch(isWorkflowTerminal, (terminal) => {
  if (terminal) {
    stopPolling()
  }
})

// Clear realWorkflowRun when task becomes DONE
watch(() => props.task?.status, (newStatus) => {
  if (newStatus === 'DONE') {
    realWorkflowRun.value = null
  }
})

// Manual refresh
const refreshWorkflowRun = async () => {
  if (!props.task?.workflow_run_id) return
  refreshLoading.value = true
  try {
    await fetchWorkflowRun()
  } finally {
    refreshLoading.value = false
  }
}

// Handle auto-refresh checkbox change
const handleAutoRefreshChange = (enabled) => {
  togglePolling(enabled)
  if (enabled && !isWorkflowTerminal.value) {
    startPolling()
  }
}

// Cancel workflow
const handleCancelWorkflow = async () => {
  if (!props.task?.workflow_run_id) return
  cancelLoading.value = true
  try {
    const response = await cancelWorkflow(props.task.workflow_run_id)
    if (response.success) {
      ElMessage.success('工作流已取消')
      realWorkflowRun.value = response.data
      emit('workflow-action', { action: 'cancelled', task: props.task })
    }
  } catch (error) {
    console.error('Failed to cancel workflow:', error)
    ElMessage.error('取消工作流失败')
  } finally {
    cancelLoading.value = false
  }
}

// Retry workflow
const handleRetryWorkflow = async () => {
  if (!props.task?.workflow_run_id) return
  retryLoading.value = true
  try {
    const response = await retryWorkflow(props.task.workflow_run_id)
    if (response.success) {
      ElMessage.success('工作流重试已开始')
      realWorkflowRun.value = response.data
      emit('workflow-action', { action: 'retry', task: props.task })
      if (pollingEnabled.value) startPolling()
    }
  } catch (error) {
    console.error('Failed to retry workflow:', error)
    ElMessage.error('重试工作流失败')
  } finally {
    retryLoading.value = false
  }
}

function isResumableWorkflowRun(runData) {
  return runData?.status === 'SUSPENDED' && Array.isArray(runData.steps) && runData.steps.some((step) => step.status === 'SUSPENDED')
}

// Resume workflow (continue after suspension)
const handleResumeWorkflow = async () => {
  if (!props.task?.workflow_run_id) return
  resumeLoading.value = true
  try {
    const latest = await getWorkflowRun(props.task.workflow_run_id)
    if (!latest.success) {
      ElMessage.error(latest.message || '获取工作流状态失败')
      return
    }

    realWorkflowRun.value = latest.data

    if (!isResumableWorkflowRun(latest.data)) {
      ElMessage.warning('当前工作流还未进入可继续状态，请刷新后重试')
      return
    }

    const response = await resumeWorkflow(props.task.workflow_run_id)
    if (response.success) {
      ElMessage.success('工作流已继续执行')
      realWorkflowRun.value = response.data
      emit('workflow-action', { action: 'resume', task: props.task })
      if (pollingEnabled.value) startPolling()
    }
  } catch (error) {
    console.error('Failed to resume workflow:', error)
    ElMessage.error(error.response?.data?.message || error.message || '继续工作流失败')
  } finally {
    resumeLoading.value = false
  }
}

// Computed
const worktreeLoading = computed(() => isWorktreeLoading(props.task.id))
const worktreeClass = computed(() => getWorktreeClass(props.task))
const worktreeTooltip = computed(() => getWorktreeTooltip(props.task))
const workflowWorktreeStatusText = computed(() => getWorktreeStatusText(props.task))
const statusClass = computed(() => getStatusClass(props.task.status))
const canStartTask = computed(() => !props.running && props.task?.status !== 'DONE')
const formattedDescription = computed(() => formatTaskDescription(props.task?.description || ''))

watch(formattedDescription, () => {
  nextTick(() => checkDescriptionOverflow())
})

onMounted(() => {
  nextTick(() => checkDescriptionOverflow())
})

// Workflow data - only from real backend workflow run data or explicit prop
const workflowData = computed(() => {
  if (props.workflow) return props.workflow
  if (realWorkflowRun.value) return toTimelineWorkflow(realWorkflowRun.value)
  return null
})

// Current node - from prop or computed from currentNodeId
const currentNode = computed(() => {
  if (props.task?.status === 'DONE') return null
  if (props.currentNode) return props.currentNode
  if (realWorkflowRun.value && workflowData.value) {
    return getCurrentWorkflowNode(realWorkflowRun.value, workflowData.value)
  }
  if (!workflowData.value?.stages || !props.currentNodeId) return null
  for (const stage of workflowData.value.stages) {
    const node = stage.nodes?.find(n => n.id === props.currentNodeId)
    if (node) return node
  }
  return null
})

// Workflow progress computation
const workflowProgress = computed(() => {
  // Use real workflow run data from API if available
  if (realWorkflowRun.value) {
    const steps = realWorkflowRun.value.steps || []
    // API returns 'COMPLETED' not 'DONE'
    const completed = steps.filter(s => s.status === 'COMPLETED' || s.status === 'DONE').length
    const total = steps.length
    return {
      completed,
      total,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0
    }
  }
  if (!workflowData.value) return { completed: 0, total: 0, percent: 0 }
  return getWorkflowProgress(workflowData.value)
})

// Workflow status computation
const workflowStatus = computed(() => {
  if (realWorkflowRun.value) {
    return getWorkflowDisplayStatus(realWorkflowRun.value)
  }
  if (!workflowData.value) {
    return props.task?.workflow_run_id ? 'running' : 'pending'
  }
  const { completed, total } = workflowProgress.value
  if (completed === 0) return 'pending'
  if (completed === total) return 'done'
  for (const stage of workflowData.value.stages) {
    if (stage.nodes?.some(n => n.status === 'FAILED')) return 'failed'
    if (stage.nodes?.some(n => n.status === 'IN_PROGRESS')) return 'running'
  }
  return 'paused'
})

const workflowStatusText = computed(() => {
  const textMap = {
    'pending': '待启动',
    'running': '运行中',
    'suspended': '等待确认',
    'paused': '已暂停',
    'done': '已完成',
    'failed': '已失败',
    'cancelled': '已取消'
  }
  return textMap[workflowStatus.value] || '待启动'
})

const formatDateTime = (isoString) => {
  if (!isoString) return ''
  const date = new Date(isoString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

const workflowStartTime = computed(() => {
  const steps = realWorkflowRun.value?.steps
  if (!steps || steps.length === 0) return null
  // Find the earliest started_at across all steps
  const startTimes = steps
    .map(s => s.started_at)
    .filter(t => t)
    .map(t => new Date(t).getTime())
  if (startTimes.length === 0) return null
  return formatDateTime(new Date(Math.min(...startTimes)).toISOString())
})

const workflowEndTime = computed(() => {
  const steps = realWorkflowRun.value?.steps
  if (!steps || steps.length === 0) return null
  // Find the latest completed_at across all steps
  const endTimes = steps
    .map(s => s.completed_at)
    .filter(t => t)
    .map(t => new Date(t).getTime())
  if (endTimes.length === 0) return null
  return formatDateTime(new Date(Math.max(...endTimes)).toISOString())
})

// Handle node click
const handleNodeClick = (node) => {
  emit('workflow-action', { action: 'node-click', node, task: props.task })
}

// Handle start button click
const handleStartClick = () => {
  if (!canStartTask.value) return
  console.log('[TaskListItem] handleStartClick called, task:', props.task?.id, 'running:', props.running)
  emit('workflow-action', { action: 'start', task: props.task })
}

const handleDeleteWorktree = async () => {
  await deleteWorktree(props.task, (updatedTask) => {
    emit('worktree-update', updatedTask)
  })
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
    createWorktree(props.task, (updatedTask) => {
      emit('worktree-update', updatedTask)
    })
  }
}
</script>

<style scoped>
.task-item {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px;
  border-radius: var(--radius-md);
  margin-bottom: 10px;
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-left: 4px solid #94a3b8;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s, background-color 0.2s, transform 0.2s;
  will-change: transform;
  width: 100%;
  box-sizing: border-box;
  box-shadow: var(--shadow-sm);
  --task-hover-bg: #f8fafc;
  --task-hover-border: rgba(148, 163, 184, 0.28);
  --task-selected-bg: linear-gradient(135deg, #f8fbff 0%, #eef6ff 100%);
  --task-selected-border: rgba(59, 130, 246, 0.28);
  --task-selected-left: #60a5fa;
}

/* Status-based colors */
.task-item[data-status="TODO"] {
  border-left-color: #6b7280;
  background-color: #fafafa;
  --task-hover-bg: #f3f4f6;
  --task-hover-border: rgba(107, 114, 128, 0.26);
  --task-selected-bg: linear-gradient(135deg, #fafafa 0%, #f3f4f6 100%);
  --task-selected-border: rgba(107, 114, 128, 0.22);
  --task-selected-left: #9ca3af;
}

.task-item[data-status="IN_PROGRESS"] {
  border-left-color: var(--in-progress-strong);
  background-color: #fdfefe;
  --task-hover-bg: #fafdfd;
  --task-hover-border: rgba(37, 198, 201, 0.18);
  --task-selected-bg: linear-gradient(135deg, #ffffff 0%, rgba(37, 198, 201, 0.035) 100%);
  --task-selected-border: rgba(37, 198, 201, 0.18);
  --task-selected-left: var(--in-progress-strong);
}

.task-item[data-status="DONE"] {
  border-left-color: var(--done-strong);
  background-color: #fefefe;
  --task-hover-bg: #fbfdfd;
  --task-hover-border: rgba(37, 198, 201, 0.16);
  --task-selected-bg: linear-gradient(135deg, #ffffff 0%, rgba(37, 198, 201, 0.045) 100%);
  --task-selected-border: rgba(37, 198, 201, 0.16);
  --task-selected-left: var(--done-strong);
}

.task-item[data-status="BLOCKED"] {
  border-left-color: #ef4444;
  background-color: #fef2f2;
  --task-hover-bg: #fef2f2;
  --task-hover-border: rgba(239, 68, 68, 0.22);
  --task-selected-bg: linear-gradient(135deg, #fff5f5 0%, #fef2f2 100%);
  --task-selected-border: rgba(239, 68, 68, 0.22);
  --task-selected-left: #f87171;
}

.task-item:hover {
  border-color: var(--task-hover-border);
  background: var(--task-hover-bg);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.task-item.task-selected,
.task-item.task-selected:hover {
  border: 1px solid var(--task-selected-border);
  border-left: 4px solid var(--task-selected-left);
  background: var(--task-selected-bg);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--task-selected-left) 22%, white), 0 12px 28px rgba(15, 23, 42, 0.08);
}

.task-item.task-running {
  border-left: 4px solid var(--el-color-primary);
}

/* Compact mode */
.task-item.task-compact {
  padding: 12px;
  gap: 10px;
  border-radius: var(--radius-sm);
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
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
}

.task-title-left {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex-wrap: wrap;
}

.task-title {
  font-size: 15px;
  line-height: 1.35;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.github-link {
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  width: fit-content;
}

.github-link :deep(.el-tag) {
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  padding: 0 8px;
  height: 22px;
  line-height: 20px;
  border-color: rgba(107, 114, 128, 0.14);
  background: rgba(107, 114, 128, 0.06);
  color: var(--text-secondary);
}
.github-link:hover {
  opacity: 0.8;
}

.task-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.task-description-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.task-description-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.task-description-row.with-separator {
  /* Separator already applied via parent */
}

.task-description {
  flex: 1;
  font-size: 12px;
  line-height: 1.65;
  color: rgba(75, 85, 99, 0.92);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  transition: all 0.2s ease;
}

.task-description.expanded {
  -webkit-line-clamp: unset;
  display: block;
  max-height: 300px;
  overflow-y: auto;
  padding-right: 4px;
}

.task-description.expanded::-webkit-scrollbar {
  width: 4px;
}

.task-description.expanded::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 2px;
}

.description-toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #25C6C9;
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  white-space: nowrap;
  flex-shrink: 0;
  transition: color 0.2s ease;
}

.description-toggle-btn:hover {
  color: #1EA9AC;
}

.task-description-row .workflow-collapse-btn {
  margin-left: 0;
  flex-shrink: 0;
}

.task-description :deep(strong) {
  color: var(--text-primary);
}

.task-description :deep(code) {
  font-family: monospace;
  font-size: 11px;
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

/* Icon spin animation */
.icon-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
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
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 0.02em;
}

/* Workflow expanded content */
.workflow-expanded-content {
  flex-basis: 100%;
  margin-top: 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.workflow-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* Workflow sections */
.workflow-section {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
}

.workflow-section:last-child {
  border-bottom: none;
}

.workflow-panel-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.workflow-panel-section-bordered {
  border-top: 1px solid var(--border-color);
}
.workflow-section:last-child {
  border-bottom: none;
}

.workflow-panel-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.workflow-panel-section-bordered {
  border-top: 1px solid #e2e8f0;
}

.workflow-panel-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}

.workflow-time {
  font-size: 11px;
  color: var(--text-secondary);
  background: #f1f5f9;
  padding: 3px 8px;
  border-radius: 4px;
}

.workflow-time-end {
  background: #ecfdf5;
  color: #059669;
}

.workflow-panel-title {
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.workflow-empty-state {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.workflow-empty-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.workflow-empty-hint {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  line-height: var(--line-height-relaxed);
}

.workflow-status {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
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

.workflow-status.status-cancelled {
  background: #f3f4f6;
  color: #6b7280;
}

.workflow-status.status-suspended {
  background: #fef3c7;
  color: #d97706;
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

/* Worktree summary */
.worktree-summary {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.worktree-summary-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.worktree-summary-header-main {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex-wrap: wrap;
}

.worktree-summary-title {
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.worktree-summary-delete-btn {
  padding: 6px 10px;
  border: 1px solid var(--el-color-danger-light-5);
  border-radius: var(--radius-sm);
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
  font-size: var(--font-size-xs);
  font-weight: 600;
  line-height: 1.2;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}
.worktree-summary-delete-btn:hover:not(:disabled) {
  background: var(--el-color-danger);
  border-color: var(--el-color-danger);
  color: #fff;
}

.worktree-summary-delete-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.worktree-summary-status {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.worktree-summary-status.worktree-none {
  background: #f1f5f9;
  color: #64748b;
}

.worktree-summary-status.worktree-created {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.worktree-summary-status.worktree-error {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.worktree-summary-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}

.worktree-summary-label {
  flex-shrink: 0;
  min-width: 48px;
  font-size: 10px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.worktree-summary-value {
  min-width: 0;
  font-size: var(--font-size-xs);
  color: var(--text-primary);
}

.worktree-summary-branch {
  flex-shrink: 0;
  padding: 3px 7px;
  border-radius: 999px;
  background: rgba(37, 198, 201, 0.06);
  color: #4338ca;
  font-weight: 600;
}
.worktree-summary-path {
  flex: 1;
  min-width: 0;
  display: inline-block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.worktree-summary-path-wrap {
  display: block;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  line-height: 1.45;
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
  gap: 5px;
  padding: 6px 12px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
}

.quick-actions .quick-action-btn:hover:not(:disabled) {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: #fff;
}
.quick-actions .quick-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.quick-actions .quick-action-btn.quick-action-cancel {
  color: #dc2626;
  border-color: #fecaca;
  background: #fef2f2;
}

.quick-actions .quick-action-btn.quick-action-cancel:hover:not(:disabled) {
  background: #dc2626;
  border-color: #dc2626;
  color: #fff;
}

.quick-actions .quick-action-btn.quick-action-retry {
  color: #059669;
  border-color: #a7f3d0;
  background: #ecfdf5;
}

.quick-actions .quick-action-btn.quick-action-retry:hover:not(:disabled) {
  background: #059669;
  border-color: #059669;
  color: #fff;
}

.quick-actions .quick-action-btn.quick-action-resume {
  color: #2563eb;
  border-color: #bfdbfe;
  background: #dbeafe;
}

.quick-actions .quick-action-btn.quick-action-resume:hover:not(:disabled) {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}

.quick-actions .quick-action-status {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
}

.workflow-collapse-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  color: #25C6C9;
  background: rgba(37, 198, 201, 0.06);
  border: 1px solid #c7d2fe;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.workflow-collapse-btn:hover {
  color: #1EA9AC;
  background: rgba(37, 198, 201, 0.08);
  border-color: #25C6C9;
  transform: translateX(-1px);
}

/* Loading animation */
.is-loading {
  animation: spin 1s linear infinite;
}

.workflow-refresh-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  transform: none !important;
}

.workflow-refresh-icon svg {
  display: block;
  width: 14px;
  height: 14px;
  animation: none !important;
  transform: none !important;
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

/* Auto-refresh checkbox */
.auto-refresh-checkbox {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  height: 32px;
}

.auto-refresh-checkbox :deep(.el-checkbox__label) {
  font-size: 11px;
  padding-left: 4px;
}
</style>
