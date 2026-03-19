<template>
  <div class="app-container">
    <!-- Top Header -->
    <header class="top-header">
      <div class="project-selector">
        <select
          v-model="selectedProjectId"
          @change="onProjectChange"
          :disabled="loading.projects"
        >
          <option value="" disabled>{{ $t('project.selectProject') }}</option>
          <option
            v-for="project in projects"
            :key="project.id"
            :value="project.id"
          >
            {{ project.name }}
          </option>
        </select>
      </div>
    </header>

    <!-- Main Content: Kanban Area + Chat -->
    <div class="main-content-wrapper">
      <!-- Left: Workflow + Kanban Board -->
      <div class="kanban-area">
        <!-- View Mode Toolbar -->
        <div class="view-toolbar">
          <div class="view-toggle">
            <el-radio-group v-model="viewMode" size="small">
              <el-radio-button value="list">
                <span class="view-btn-content">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="8" y1="6" x2="21" y2="6"></line>
                    <line x1="8" y1="12" x2="21" y2="12"></line>
                    <line x1="8" y1="18" x2="21" y2="18"></line>
                    <line x1="3" y1="6" x2="3.01" y2="6"></line>
                    <line x1="3" y1="12" x2="3.01" y2="12"></line>
                    <line x1="3" y1="18" x2="3.01" y2="18"></line>
                  </svg>
                  {{ $t('view.list') }}
                </span>
              </el-radio-button>
              <el-radio-button value="kanban">
                <span class="view-btn-content">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                  </svg>
                  {{ $t('view.kanban') }}
                </span>
              </el-radio-button>
            </el-radio-group>
          </div>
        </div>

        <!-- Kanban Board -->
        <div v-if="viewMode === 'kanban'" class="kanban-board" ref="kanbanBoardRef">
          <!-- TODO Column -->
          <KanbanColumn
            status="TODO"
            :title="$t('status.TODO')"
            :tasks="localTodoTasks"
            :selected-task="selectedTask"
            :running-task-ids="runningTasks"
            :empty-text="$t('task.noTodoTasks')"
            :show-add-button="true"
            @drag-end="onDragEnd"
            @select-task="selectTask"
            @edit-task="openTaskModal"
            @delete-task="deleteTask"
            @add-task="openTaskModal()"
            @worktree-update="handleWorktreeUpdate"
          />

          <!-- IN_PROGRESS Column -->
          <KanbanColumn
            status="IN_PROGRESS"
            :title="$t('status.IN_PROGRESS')"
            :tasks="localInProgressTasks"
            :selected-task="selectedTask"
            :running-task-ids="runningTasks"
            :empty-text="$t('task.noTasks')"
            @drag-end="onDragEnd"
            @select-task="selectTask"
            @edit-task="openTaskModal"
            @delete-task="deleteTask"
            @worktree-update="handleWorktreeUpdate"
          />

          <!-- DONE Column -->
          <KanbanColumn
            status="DONE"
            :title="$t('status.DONE')"
            :tasks="localDoneTasks"
            :selected-task="selectedTask"
            :running-task-ids="runningTasks"
            :empty-text="$t('task.noDoneTasks')"
            @drag-end="onDragEnd"
            @select-task="selectTask"
            @edit-task="openTaskModal"
            @delete-task="deleteTask"
            @worktree-update="handleWorktreeUpdate"
          />
        </div>

        <!-- List View -->
        <KanbanListView
          v-else
          :tasks="filteredTasksForList"
          :selected-task="selectedTask"
          :running-task-ids="runningTasks"
          :status-filter="listStatusFilter"
          @select-task="selectTask"
          @edit-task="openTaskModal"
          @delete-task="deleteTask"
          @update:status-filter="listStatusFilter = $event"
          @add-task="openTaskModal()"
          @sync-task="onSyncTask"
          @reorder-tasks="handleReorderTasks"
          @worktree-update="handleWorktreeUpdate"
        />
      </div>

      <!-- Chat Container -->
      <div class="chat-container" :class="{ collapsed: isChatCollapsed }">
        <div class="chat-toggle-btn" @click="isChatCollapsed = !isChatCollapsed" :title="isChatCollapsed ? 'Expand Chat' : 'Collapse Chat'">
          <span class="collapse-arrow" :class="{ collapsed: isChatCollapsed }">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </span>
        </div>

        <div v-if="!selectedTask && !isChatCollapsed" class="chat-welcome">
          <div class="welcome-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <h2>{{ $t('butler.selectTask') }}</h2>
          <p>{{ $t('butler.selectTaskHint') }}</p>
        </div>

        <div v-if="selectedTask && !isChatCollapsed" class="chat-content">
          <div class="butler-header">
            <div class="butler-avatar">🤖</div>
            <div class="butler-info">
              <h3>{{ $t('butler.title') }} - {{ selectedTask.title }}</h3>
              <div v-if="selectedTaskWorktreeName" class="butler-worktree">
                <span class="worktree-label">{{ $t('git.worktree', 'Worktree') }}:</span>
                <span class="worktree-badge" :title="selectedTask.worktree_path">
                  {{ selectedTaskWorktreeName }}
                </span>
                <button
                  class="butler-worktree-delete"
                  @click.stop="handleDeleteWorktree(selectedTask)"
                  title="删除 Worktree"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <TaskButlerChat
            ref="butlerChatRef"
            :task="selectedTask"
            @control-workflow="handleButlerControl"
            @view-workflow="handleViewWorkflow"
            @task-started="handleTaskStarted"
            @view-progress="handleViewProgress"
            @show-diff="handleShowDiff"
          />
        </div>
      </div>
    </div>

    <!-- Task Modal -->
    <div v-if="showTaskModal" class="modal-overlay" @click.self="closeTaskModal">
      <div class="modal">
        <div class="modal-header">
          <h2>{{ isEditing ? $t('task.editTask') : $t('task.newTask') }}</h2>
          <button class="modal-close" @click="closeTaskModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>{{ $t('task.taskTitle') }}</label>
            <input
              v-model="taskForm.title"
              type="text"
              :placeholder="$t('task.taskTitlePlaceholder')"
            />
          </div>
          <div class="form-group">
            <label>{{ $t('task.taskDescription') }}</label>
            <textarea
              v-model="taskForm.description"
              rows="4"
              :placeholder="$t('task.taskDescriptionPlaceholder')"
            ></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>{{ $t('task.status') }}</label>
              <select v-model="taskForm.status">
                <option value="TODO">{{ $t('status.TODO') }}</option>
                <option value="IN_PROGRESS">{{ $t('status.IN_PROGRESS') }}</option>
                <option value="DONE">{{ $t('status.DONE') }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>{{ $t('task.priority') }}</label>
              <select v-model="taskForm.priority">
                <option value="LOW">{{ $t('priority.LOW') }}</option>
                <option value="MEDIUM">{{ $t('priority.MEDIUM') }}</option>
                <option value="HIGH">{{ $t('priority.HIGH') }}</option>
                <option value="CRITICAL">{{ $t('priority.CRITICAL') }}</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input
                type="checkbox"
                v-model="taskForm.autoAssignWorkflow"
              />
              <span>{{ $t('task.autoAssignWorkflow') }}</span>
            </label>
            <p class="form-help">{{ $t('task.autoAssignWorkflowHelp') }}</p>
          </div>
        </div>
        <div class="modal-footer">
          <div class="modal-actions">
            <button class="btn btn-secondary" @click="closeTaskModal">{{ $t('common.cancel') }}</button>
            <button class="btn btn-primary" @click="saveTask">{{ $t('common.save') }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Agent Selector Dialog -->
    <AgentSelector
      v-if="showAgentSelector"
      v-model="showAgentSelector"
      :project-id="selectedProjectId"
      :task="pendingTask"
      @select="handleAgentSelect"
    />

    <!-- Workflow Timeline Dialog -->
    <WorkflowTimelineDialog
      v-model="showWorkflowDialog"
      :task-id="selectedTask?.id"
      @select-node="onNodeSelect"
      @view-details="onNodeViewDetails"
      @start-workflow="onStartWorkflow"
    />

    <!-- Workflow Progress Dialog -->
    <WorkflowProgressDialog
      v-model="showProgressDialog"
      :task-id="selectedTask?.id"
      :workflow-run-id="progressRunId"
      :task-title="selectedTask?.title"
      @workflow-completed="handleWorkflowCompleted"
    />

    <!-- Diff Select Dialog -->
    <DiffSelectDialog
      v-if="showDiffDialog"
      :project-id="diffDialogData.projectId"
      :task-id="diffDialogData.taskId"
      :worktree-branch="diffDialogData.worktreeBranch"
      @close="showDiffDialog = false"
    />

    <!-- Sync Tasks Dialog -->
    <div v-if="showSyncDialog" class="modal-overlay" @click.self="closeSyncDialog">
      <div class="modal sync-modal">
        <div class="modal-header">
          <h2>{{ $t('taskSource.previewTitle') }}</h2>
          <button class="modal-close" @click="closeSyncDialog">&times;</button>
        </div>
        <div class="modal-body">
          <!-- Task Source Selector -->
          <div v-if="availableSources.length > 1" class="source-selector">
            <label class="form-label">{{ $t('taskSource.selectSource') }}</label>
            <el-select v-model="selectedSourceId" placeholder="请选择任务源" @change="onSourceChange" style="width: 100%">
              <el-option
                v-for="source in availableSources"
                :key="source.id"
                :label="source.name"
                :value="source.id"
              />
            </el-select>
          </div>
          <!-- Preview Loading -->
          <div v-if="previewLoading" class="preview-loading">
            <el-skeleton :rows="5" animated />
          </div>
          <!-- Preview List -->
          <div v-else-if="previewItems.length > 0" class="preview-list">
            <div class="preview-header">
              <span class="preview-hint">从 GitHub Issues 导入，选择要创建为任务的 Issue：</span>
              <div class="preview-actions">
                <button class="btn btn-link" @click="selectAllIssues">{{ $t('taskSource.selectAll') }}</button>
                <button class="btn btn-link" @click="deselectAllIssues">{{ $t('taskSource.deselectAll') }}</button>
              </div>
            </div>
            <label
              v-for="issue in previewItems"
              :key="issue.id"
              class="preview-item"
              :class="{ 'is-selected': selectedIssueIds.includes(issue.id), 'is-imported': issue.imported }"
            >
              <input
                type="checkbox"
                :value="issue.id"
                v-model="selectedIssueIds"
                :disabled="issue.imported"
              />
              <span class="preview-item-content">
                <span class="preview-item-title">
                  #{{ issue.number }} {{ issue.title }}
                  <span v-if="issue.imported" class="imported-badge">{{ $t('taskSource.imported') }}</span>
                  <span v-if="issue.state" class="issue-state" :class="issue.state">{{ issue.state }}</span>
                </span>
                <span class="preview-item-labels" v-if="issue.labels && issue.labels.length > 0">
                  <span
                    v-for="label in issue.labels"
                    :key="label.id"
                    class="label"
                    :style="{ backgroundColor: '#' + label.color }"
                  >
                    {{ label.name }}
                  </span>
                </span>
                <span v-if="issue.description" class="preview-item-desc">
                  {{ issue.description }}
                </span>
                <span class="preview-item-meta">
                  <span class="preview-item-author" v-if="issue.user">
                    <img v-if="issue.user.avatar_url" :src="issue.user.avatar_url" alt="" class="avatar" />
                    {{ issue.user.login }}
                  </span>
                </span>
              </span>
            </label>
          </div>
          <!-- Empty State -->
          <div v-else class="empty-state">
            <p>暂无可同步的 Issues</p>
          </div>
        </div>
        <div class="modal-footer">
          <div class="modal-actions">
            <button class="btn btn-secondary" @click="closeSyncDialog">{{ $t('common.cancel') }}</button>
            <button
              class="btn btn-primary"
              @click="confirmSync"
              :disabled="selectedIssueIds.length === 0 || syncing"
            >
              <svg v-if="syncing" class="icon-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
                <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
              </svg>
              {{ syncing ? $t('taskSource.syncing') : $t('taskSource.confirmImport') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Workflow Node Detail Dialog -->
    <div v-if="showNodeDialog && selectedNode" class="modal-overlay" @click.self="showNodeDialog = false">
      <div class="modal node-detail-modal">
        <div class="modal-header">
          <div class="header-content">
            <el-icon class="header-icon"><component :is="getNodeRoleIcon(selectedNode.role)" /></el-icon>
            <div>
              <h2>{{ selectedNode.name }}</h2>
              <span class="node-subtitle"><el-icon><component :is="getNodeRoleIcon(selectedNode.role)" /></el-icon> {{ selectedNode.role }} �?{{ selectedNode.agentName }}</span>
            </div>
          </div>
          <button class="modal-close" @click="showNodeDialog = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="info-card">
            <h3 class="info-card-title">基本信息</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 16v-4"></path>
                    <path d="M12 8h.01"></path>
                  </svg>
                  状�?
                </span>
                <span class="info-value status-badge" :class="'status-' + selectedNode.status?.toLowerCase()">
                  <span class="status-dot"></span>
                  {{ getStatusText(selectedNode.status) }}
                </span>
              </div>
              <div class="info-item">
                <span class="info-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  Agent
                </span>
                <span class="info-value agent-badge">
                  <el-icon class="agent-icon"><component :is="getAgentIcon(selectedNode.agentType)" /></el-icon>
                  {{ selectedNode.agentName }}
                </span>
              </div>
              <div class="info-item" v-if="selectedNode.duration">
                <span class="info-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  耗时
                </span>
                <span class="info-value duration-value">{{ selectedNode.duration }} 分钟</span>
              </div>
            </div>
          </div>

          <div v-if="selectedNode.rejectedReason" class="info-card rejected-reason-card">
            <h3 class="info-card-title rejected-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              打回原因
            </h3>
            <p class="rejected-reason-text">{{ selectedNode.rejectedReason }}</p>
          </div>

          <div class="info-card chat-card">
            <h3 class="info-card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              �?{{ selectedNode.agentName }} 对话
            </h3>
            <div class="node-chat-container">
              <ChatBox
                ref="nodeChatBoxRef"
                :task="selectedTask"
                :agent-id="selectedNode.agentId || selectedAgentId"
                :initial-session="null"
                :default-collapsed="false"
                @session-created="onNodeSessionCreated"
                @request-agent-select="() => {}"
              />
            </div>
          </div>

          <div v-if="selectedNode.isParent && selectedNode.childNodes" class="info-card">
            <h3 class="info-card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="16 18 22 12 16 6"></polyline>
                <polyline points="8 6 2 12 8 18"></polyline>
              </svg>
              子节点完成情�?
            </h3>
            <div class="child-nodes-list">
              <div v-for="child in selectedNode.childNodes" :key="child.id" class="child-node-item" :class="'status-' + child.status?.toLowerCase()">
                <span class="child-status-icon">
                  <span v-if="child.status === 'DONE'">✅</span>
                  <span v-else-if="child.status === 'IN_PROGRESS'">🔄</span>
                  <span v-else-if="child.status === 'REJECTED'">↩️</span>
                  <span v-else-if="child.status === 'FAILED'">❌</span>
                  <span v-else>⏳</span>
                </span>
                <div class="child-node-info">
                  <span class="child-node-name">{{ child.name }}</span>
                  <span class="child-node-agent">{{ child.agentName }}</span>
                </div>
                <span class="child-node-status status-badge" :class="'status-' + child.status?.toLowerCase()">{{ getStatusText(child.status) }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary btn-close" @click="showNodeDialog = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Monitor, VideoPlay, Edit, Cpu,
  OfficeBuilding, User, Setting, Brush, Search, Coin, Document,
  Aim, CircleCheck, View, Lock, Promotion, Box
} from '@element-plus/icons-vue'
import { useProjectStore } from '../stores/projectStore'
import { useTaskStore } from '../stores/taskStore'
import { getActiveSessionByTask } from '../api/session.js'
import AgentSelector from '../components/AgentSelector.vue'
import ChatBox from '../components/ChatBox.vue'
import TaskButlerChat from '../components/TaskButlerChat.vue'
import DiffSelectDialog from '../components/DiffSelectDialog.vue'
import WorkflowTimelineDialog from '../components/WorkflowTimelineDialog.vue'
import WorkflowProgressDialog from '../components/WorkflowProgressDialog.vue'
import draggable from 'vuedraggable'
import KanbanColumn from '../components/kanban/TaskColumn.vue'
import KanbanListView from '../components/kanban/KanbanListView.vue'
import { useTaskTimer } from '../composables/kanban/useTaskTimer'
import { useWorkflowManager } from '../composables/kanban/useWorkflowManager'
import { useTaskSourceStore } from '../stores/taskSourceStore'
import {
  getWorkflowByProject,
  getWorkflowByTask,
  getOrCreateWorkflowForProject,
  addNodeToWorkflow
} from '../mock/workflowData'
import { reorderTasks } from '../api/task.js'
import { deleteTaskWorktree } from '../api/taskWorktree.js'

const { t } = useI18n()

// Use Pinia stores
const projectStore = useProjectStore()
const taskStore = useTaskStore()
const taskSourceStore = useTaskSourceStore()

// Icon mappings
const agentIconMap = { Monitor, VideoPlay, Edit, Cpu }
const roleIconMap = {
  OfficeBuilding, User, Setting, Brush, Search, Coin, Document,
  Aim, CircleCheck, View, Lock, Promotion, Box
}

// Local state
const selectedProjectId = ref('')
const selectedTask = ref(null)
const selectedAgentId = ref(null)
const showTaskModal = ref(false)
const showWorkflowDialog = ref(false)
const showProgressDialog = ref(false)
const progressRunId = ref(null)
const showSyncDialog = ref(false)
// Sync state
const availableSources = ref([])
const selectedSourceId = ref(null)
const previewItems = ref([])
const selectedIssueIds = ref([])
const syncing = ref(false)
const previewLoading = ref(false)
const isEditing = ref(false)
const editingTaskId = ref(null)
const activeSession = ref(null)
const chatBoxRef = ref(null)
const butlerChatRef = ref(null)
const nodeChatBoxRef = ref(null)
const isChatCollapsed = ref(false)
const kanbanBoardRef = ref(null)
const viewMode = ref(localStorage.getItem('kanban-view-mode') || 'list')
const showDiffDialog = ref(false)
const diffDialogData = ref({})

// 监听 viewMode 变化并保存到 localStorage
watch(viewMode, (newValue) => {
  localStorage.setItem('kanban-view-mode', newValue)
})
const listStatusFilter = ref(['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED'])
const allStatusOptions = ['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED']

// Use useTaskTimer composable
const {
  runningTasks,
  isTaskRunning,
  startTaskTimer,
  stopTaskTimer,
  formatTaskElapsedTime,
  cleanup: cleanupTimer
} = useTaskTimer()

// Use useWorkflowManager composable
const {
  selectedNode,
  showNodeDialog,
  workflowVersion,
  onNodeSelect,
  onNodeViewDetails,
  handleButlerControl,
  handleViewWorkflow,
  onNodeSessionCreated,
  onStartWorkflow
} = useWorkflowManager({
  selectedTask,
  selectedProjectId,
  showWorkflowDialog,
  getWorkflowByTask,
  getWorkflowByProject,
  t
})

// Handle task started event from TaskButlerChat
const handleTaskStarted = async (updatedTask) => {
  // Refresh tasks to reflect status change
  if (selectedProjectId.value) {
    await taskStore.fetchTasks(selectedProjectId.value)
  }
  // Update selected task with new data
  if (selectedTask.value && selectedTask.value.id === updatedTask.id) {
    selectedTask.value = updatedTask
  }
}

// Handle view progress event from TaskButlerChat
const handleViewProgress = ({ taskId, workflowRunId }) => {
  progressRunId.value = workflowRunId
  showProgressDialog.value = true
}

// Handle workflow completed event from WorkflowProgressDialog
const handleWorkflowCompleted = async () => {
  // Refresh tasks to reflect status change (task should now be DONE)
  if (selectedProjectId.value) {
    await taskStore.fetchTasks(selectedProjectId.value)
  }
  // Update selected task from refreshed store
  if (selectedTask.value) {
    const updated = taskStore.tasks.find(t => t.id === selectedTask.value.id)
    if (updated) {
      selectedTask.value = updated
    }
  }
}

// Handle tasks reorder from drag-and-drop
const handleReorderTasks = async (newOrder) => {
  try {
    // Update local state immediately for responsive UI
    localTasks.value = [...newOrder]
    taskStore.tasks = [...newOrder]

    // Send update to backend
    await reorderTasks(newOrder)

    console.log('[KanbanView] Tasks reordered successfully')
  } catch (error) {
    console.error('[KanbanView] Failed to reorder tasks:', error)
    // Reload tasks from server on error
    await taskStore.fetchTasks(selectedProjectId.value)
  }
}

// Handle worktree update from child components
const handleWorktreeUpdate = (task) => {
  // Task object is mutated by reference, no additional action needed
  console.log('[KanbanView] Worktree updated for task:', task.id)
}

// Handle show diff dialog from butler chat
const handleShowDiff = (data) => {
  diffDialogData.value = data
  showDiffDialog.value = true
}

// Handle delete worktree from butler header
const handleDeleteWorktree = async (task) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除 Worktree "${task.worktree_branch}" 吗？`,
      '确认删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    const response = await deleteTaskWorktree(task.id)
    if (response.success) {
      task.worktree_path = null
      task.worktree_branch = null
      task.worktree_status = 'none'
      ElMessage.success('Worktree 已删除')
      await taskStore.fetchTasks(selectedProjectId.value)
    }
  } catch (error) {
    const isCancelled = error === 'cancel' || error === 'esc'
    if (!isCancelled) {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

// Computed - tasks and projects
const tasks = computed(() => taskStore.tasks)
const projects = computed(() => projectStore.projects)

// Worktree name from selected task
const selectedTaskWorktreeName = computed(() => {
  if (!selectedTask.value?.worktree_path) return ''
  const parts = selectedTask.value.worktree_path.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || selectedTask.value.worktree_path
})

// Local reactive arrays for draggable
const localTodoTasks = ref([])
const localInProgressTasks = ref([])
const localDoneTasks = ref([])

// Sync store to local arrays
watch(
  () => taskStore.tasks,
  (newTasks) => {
    localTodoTasks.value = newTasks.filter(t => t.status === 'TODO')
    localInProgressTasks.value = newTasks.filter(t => t.status === 'IN_PROGRESS')
    localDoneTasks.value = newTasks.filter(t => t.status === 'DONE')
  },
  { immediate: true, deep: true }
)

// Loading state
const loading = reactive({
  projects: computed(() => projectStore.loading),
  tasks: computed(() => taskStore.loading),
  saving: false
})

// Task form
const taskForm = reactive({
  title: '',
  description: '',
  category: '',
  status: 'TODO',
  priority: 'MEDIUM',
  assignee: '',
  autoAssignWorkflow: true
})

// Agent selector
const showAgentSelector = ref(false)
const pendingTask = ref(null)

// Filtered tasks for list view - only sort, don't filter by status
// Status filtering is handled by KanbanListView components
const filteredTasksForList = computed(() => {
  const statusOrder = { 'TODO': 0, 'IN_PROGRESS': 2, 'DONE': 3, 'BLOCKED': 4 }
  return [...taskStore.tasks].sort((a, b) => {
    const orderA = statusOrder[a.status] ?? 5
    const orderB = statusOrder[b.status] ?? 5
    return orderA - orderB
  })
})

// Helper functions
const updateColumnRefs = () => {
  localTodoTasks.value = taskStore.tasks.filter(t => t.status === 'TODO')
  localInProgressTasks.value = taskStore.tasks.filter(t => t.status === 'IN_PROGRESS')
  localDoneTasks.value = taskStore.tasks.filter(t => t.status === 'DONE')
}

const getStatusClass = (status) => {
  const classes = {
    TODO: 'status-todo',
    IN_PROGRESS: 'status-in-progress',
    DONE: 'status-done',
    BLOCKED: 'status-blocked'
  }
  return classes[status] || 'status-todo'
}

const getStatusLabel = (status) => t(`status.${status}`)

const getPriorityClass = (priority) => {
  const classes = {
    LOW: 'priority-low',
    MEDIUM: 'priority-medium',
    HIGH: 'priority-high',
    CRITICAL: 'priority-critical'
  }
  return classes[priority] || 'priority-medium'
}

const getPriorityLabel = (priority) => {
  const labels = {
    LOW: t('priority.LOW'),
    MEDIUM: t('priority.MEDIUM'),
    HIGH: t('priority.HIGH'),
    CRITICAL: t('priority.CRITICAL')
  }
  return labels[priority] || 'Medium'
}

// Workflow node display helpers
const getNodeRoleIcon = (role) => {
  if (!role) return Document
  const iconName = roleConfig[role]?.icon || 'Document'
  return roleIconMap[iconName] || Document
}

const getAgentIcon = (agentType) => {
  if (!agentType) return Monitor
  const iconName = agentConfig[agentType]?.icon || 'Monitor'
  return agentIconMap[iconName] || Monitor
}

const getStatusText = (status) => {
  if (!status) return 'Unknown'
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

// Project change handler
const onProjectChange = async () => {
  selectedTask.value = null
  if (selectedProjectId.value) {
    await taskStore.fetchTasks(selectedProjectId.value)
  }
  updateColumnRefs()
}

// Task selection
const selectTask = (task) => {
  // Prevent selecting the same task that's already selected
  if (selectedTask.value && selectedTask.value.id === task.id) {
    return
  }
  console.log('[KanbanView] selectTask called with:', task)
  selectedTask.value = task
  loadActiveSession()
}

// Task modal
const openTaskModal = (task = null) => {
  // Check if a project is selected
  if (!task && !selectedProjectId.value) {
    ElMessage.warning('请先选择一个项目')
    return
  }

  if (task) {
    isEditing.value = true
    editingTaskId.value = task.id
    taskForm.title = task.title
    taskForm.description = task.description || ''
    taskForm.category = task.category || ''
    taskForm.status = task.status
    taskForm.priority = task.priority || 'MEDIUM'
    taskForm.assignee = task.assignee || ''
    taskForm.autoAssignWorkflow = task.autoAssignWorkflow !== false
  } else {
    isEditing.value = false
    editingTaskId.value = null
    taskForm.title = ''
    taskForm.description = ''
    taskForm.category = ''
    taskForm.status = 'TODO'
    taskForm.priority = 'MEDIUM'
    taskForm.assignee = ''
    taskForm.autoAssignWorkflow = true
  }
  showTaskModal.value = true
}

const closeTaskModal = () => {
  showTaskModal.value = false
  isEditing.value = false
  editingTaskId.value = null
}

// Sync tasks dialog functions
const openSyncDialog = async () => {
  // Check if project is selected
  if (!selectedProjectId.value) {
    ElMessage.warning('请先选择项目')
    return
  }

  // Fetch task sources for current project
  try {
    await taskSourceStore.fetchTaskSources(selectedProjectId.value)
    availableSources.value = taskSourceStore.taskSources

    if (availableSources.value.length === 0) {
      ElMessage.warning('请先配置任务源')
      return
    }

    // If only one source, select it directly
    if (availableSources.value.length === 1) {
      selectedSourceId.value = availableSources.value[0].id
      await loadPreview(selectedSourceId.value)
    }

    showSyncDialog.value = true
  } catch (error) {
    console.error('[KanbanView] Failed to fetch task sources:', error)
    ElMessage.error('加载任务源失败：' + error.message)
  }
}

const onSourceChange = async () => {
  if (selectedSourceId.value) {
    await loadPreview(selectedSourceId.value)
  }
}

const loadPreview = async (sourceId) => {
  previewLoading.value = true
  previewItems.value = []
  selectedIssueIds.value = []
  try {
    const result = await taskSourceStore.previewSync(sourceId)
    // Map the preview items to include checkbox IDs
    previewItems.value = (result || []).map(item => ({
      ...item,
      id: item.external_id || item.id
    }))
  } catch (error) {
    console.error('[KanbanView] Failed to load preview:', error)
    ElMessage.error('加载预览失败：' + error.message)
  } finally {
    previewLoading.value = false
  }
}

const selectAllIssues = () => {
  // Only select issues that are not already imported
  selectedIssueIds.value = previewItems.value
    .filter(item => !item.imported)
    .map(item => item.id)
}

const deselectAllIssues = () => {
  selectedIssueIds.value = []
}

const confirmSync = async () => {
  if (selectedIssueIds.value.length === 0) return

  const selectedItems = previewItems.value.filter(item =>
    selectedIssueIds.value.includes(item.id)
  )

  syncing.value = true
  try {
    const result = await taskSourceStore.importSelectedIssues(
      selectedSourceId.value,
      selectedItems,
      selectedProjectId.value
    )
    console.log('[KanbanView] Import result:', result)
    // Get source name for display
    const source = availableSources.value.find(s => s.id === selectedSourceId.value)
    const sourceName = source?.name || '任务源'
    ElMessage.success(`从 ${sourceName} 成功导入 ${result?.created || 0} 个任务`)
    closeSyncDialog()
    // Refresh tasks list
    await taskStore.fetchTasks(selectedProjectId.value)
  } catch (error) {
    console.error('[KanbanView] Failed to import issues:', error)
    ElMessage.error('导入失败：' + error.message)
  } finally {
    syncing.value = false
  }
}

const closeSyncDialog = () => {
  showSyncDialog.value = false
  availableSources.value = []
  selectedSourceId.value = null
  previewItems.value = []
  selectedIssueIds.value = []
  taskSourceStore.closePreviewDialog()
}

const onSyncTask = () => {
  openSyncDialog()
}

// Save task
const saveTask = async () => {
  if (!taskForm.title.trim()) return

  loading.saving = true
  try {
    let category = taskForm.category
    if (!category && taskForm.title) {
      category = analyzeTaskCategory(taskForm.title, taskForm.description)
    }

    const taskData = {
      ...taskForm,
      category: category || 'FEATURE',
      projectId: selectedProjectId.value
    }

    let savedTask
    if (isEditing.value) {
      await taskStore.updateTask(editingTaskId.value, taskData)
      savedTask = { ...taskData, id: editingTaskId.value }
    } else {
      savedTask = await taskStore.createTask(taskData)
    }

    if (taskForm.autoAssignWorkflow && !isEditing.value && savedTask) {
      const node = autoAssignTaskToWorkflow(savedTask)
      if (node) {
        ElMessage.success(t('task.workflowAssigned', { stage: node.role }))
      }
    }

    closeTaskModal()
    ElMessage.success(isEditing.value ? t('task.updated') : t('task.created'))
  } catch (error) {
    console.error('Failed to save task:', error)
    ElMessage.error(t('task.saveFailed'))
  } finally {
    loading.saving = false
  }
}

// Delete task
const deleteTask = async (taskId) => {
  try {
    await ElMessageBox.confirm(
      t('task.deleteConfirmMessage'),
      t('task.deleteConfirmTitle'),
      {
        confirmButtonText: t('common.delete'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
  } catch {
    return
  }

  loading.saving = true
  try {
    await taskStore.deleteTask(taskId)
    if (selectedTask.value?.id === taskId) {
      selectedTask.value = null
    }
    closeTaskModal()
    ElMessage.success(t('task.deleted'))
  } catch (error) {
    console.error('Failed to delete task:', error)
    ElMessage.error(t('task.deleteFailed'))
  } finally {
    loading.saving = false
  }
}

// Drag and drop handler
const onDragEnd = async (evt) => {
  const newStatus = evt.to?.closest('.kanban-column')?.getAttribute('data-status')
  if (!newStatus) {
    ElMessage.error(t('task.cannotDetermineStatus'))
    return
  }

  const taskId = evt.item?.getAttribute('data-id')
  if (!taskId) {
    ElMessage.error(t('task.cannotGetTaskId'))
    return
  }

  const task = taskStore.tasks.find(t => String(t.id) === String(taskId))
  if (!task) {
    ElMessage.error(t('task.taskNotFound'))
    return
  }

  if (task.status === newStatus) return

  try {
    await taskStore.updateTaskStatus(taskId, newStatus)
    ElMessage.success(t('task.taskMoved', { status: t(`status.${newStatus}`) }))
  } catch (error) {
    updateColumnRefs()
    console.error('Failed to update task status:', error)
    ElMessage.error(t('task.statusUpdateFailed'))
  }
}

// Session handlers
const onSessionCreated = async (session) => {
  activeSession.value = session
  if (session.status === 'RUNNING' || session.status === 'IDLE') {
    startTaskTimer(session.taskId)
  }
  if (session.taskId) {
    try {
      const updatedTask = await taskStore.fetchTask(session.taskId)
      if (updatedTask && selectedTask.value?.id === updatedTask.id) {
        selectedTask.value = updatedTask
        updateColumnRefs()
      }
    } catch (e) {
      console.error('Failed to refresh task after session creation:', e)
    }
  }
}

const onSessionStopped = () => {
  if (selectedTask.value) {
    stopTaskTimer(selectedTask.value.id)
  }
}

const onSessionDeleted = async () => {
  if (selectedTask.value) {
    stopTaskTimer(selectedTask.value.id)
    try {
      const updatedTask = await taskStore.fetchTask(selectedTask.value.id)
      if (updatedTask) {
        selectedTask.value = updatedTask
        updateColumnRefs()
      }
    } catch (e) {
      console.error('Failed to refresh task after session deletion:', e)
    }
  }
}

const onStatusChange = (status) => {
  if (activeSession.value) {
    activeSession.value.status = status
  }
  if (selectedTask.value) {
    if (status === 'RUNNING' || status === 'IDLE') {
      startTaskTimer(selectedTask.value.id)
    } else if (status === 'STOPPED' || status === 'ERROR' || status === 'COMPLETED') {
      stopTaskTimer(selectedTask.value.id)
    }
  }
}

const handleAgentSelect = ({ agentId, agent, task }) => {
  selectedAgentId.value = agentId
  pendingTask.value = task
  showAgentSelector.value = false
}

const handleRequestAgentSelect = (task) => {
  console.log('handleRequestAgentSelect called, task:', task?.id, 'projectId:', selectedProjectId.value)
  pendingTask.value = task
  showAgentSelector.value = true
}

const loadActiveSession = async () => {
  if (!selectedTask.value) return
  // Store task ID before async operation to prevent stale reference
  const taskId = selectedTask.value.id
  try {
    const response = await getActiveSessionByTask(taskId)
    if (response.success && response.data) {
      activeSession.value = response.data
    } else {
      activeSession.value = null
    }
  } catch (error) {
    console.error('Failed to load active session:', error)
    activeSession.value = null
  }
}

// Lifecycle
onMounted(async () => {
  try {
    await projectStore.fetchProjects()
    if (projectStore.projects.length > 0) {
      selectedProjectId.value = projectStore.projects[0].id
      await taskStore.fetchTasks(selectedProjectId.value)
    }
  } catch (error) {
    console.error('Failed to fetch initial data:', error)
    ElMessage.error('加载数据失败')
  }
})

onUnmounted(() => {
  cleanupTimer()
})
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
  color: var(--text-primary);
  overflow: hidden;
}

/* Top Header */
.top-header {
  display: flex;
  padding: 12px 16px;
  gap: 10px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
  flex-shrink: 0;
}

.project-selector {
  flex: 1;
  max-width: 300px;
}

.project-selector select {
  width: 100%;
  padding: 10px 14px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpolyline points='6,9 12,15 18,9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
}

.project-selector select:hover {
  border-color: var(--accent-color);
}

.project-selector select:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px rgba(92, 92, 255, 0.15);
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #6366f1;
  color: white;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--hover-bg);
  border-color: var(--accent-color);
}

.btn-icon {
  padding: 10px;
  width: 40px;
  height: 40px;
  justify-content: center;
  border-radius: 10px;
}

/* Main Content Wrapper */
.main-content-wrapper {
  display: flex;
  flex: 1;
  min-height: 0;
}

/* Kanban Area */
.kanban-area {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow-x: auto;
}

.kanban-area :deep(.workflow-timeline) {
  margin: 12px;
  margin-bottom: 8px;
  flex-shrink: 0;
  max-width: calc(100% - 24px);
}

/* Kanban Board */
.kanban-board {
  display: flex;
  flex: 1;
  padding: 16px;
  gap: 16px;
  min-height: 0;
  align-content: stretch;
  overflow-x: auto;
  flex-wrap: nowrap;
}

/* View Mode Toolbar */
.view-toolbar {
  padding: 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.view-toggle {
  display: flex;
  gap: 8px;
}

.view-btn-content {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* Chat Container */
.chat-container {
  width: 400px;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  position: relative;
  flex-shrink: 0;
}

.chat-container.collapsed {
  width: 0;
  overflow: visible;
  border-left: none;
}

.chat-toggle-btn {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  right: 0;
  width: 24px;
  height: 48px;
  background: var(--accent-color);
  border: none;
  border-radius: 4px 0 0 4px;
  cursor: pointer;
  z-index: 100;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-left: 4px;
}

.chat-container:not(.collapsed) .chat-toggle-btn {
  right: 0;
  border-radius: 4px 0 0 4px;
}

.chat-container.collapsed .chat-toggle-btn {
  right: 0;
  border-radius: 0 4px 4px 0;
  padding-left: 0;
}

.chat-toggle-btn:hover {
  width: 28px;
}

.collapse-arrow {
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}

.collapse-arrow.collapsed {
  transform: rotate(180deg);
}

.chat-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px 20px;
  text-align: center;
  color: var(--text-secondary);
}

.welcome-icon {
  margin-bottom: 16px;
  color: var(--accent-color);
}

.chat-welcome h2 {
  font-size: 16px;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.chat-welcome p {
  font-size: 13px;
  color: var(--text-secondary);
}

.chat-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.butler-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.butler-avatar {
  font-size: 32px;
}

.butler-info h3 {
  font-size: 14px;
  margin: 0;
  color: var(--text-primary);
  font-weight: 600;
}

.butler-worktree {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}

.butler-worktree .worktree-label {
  font-size: 11px;
  color: var(--text-muted);
}

.butler-worktree .worktree-badge {
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.butler-worktree-delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  color: var(--text-muted);
  transition: all 0.2s;
  flex-shrink: 0;
}

.butler-worktree-delete:hover {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--bg-secondary);
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h2 {
  font-size: 18px;
  margin: 0;
  color: var(--text-primary);
}

.modal-close {
  background: none;
  border: none;
  font-size: 28px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s;
}

.modal-close:hover {
  background: var(--hover-bg);
}

.modal-body {
  padding: 20px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 13px;
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--accent-color);
}

.form-group textarea {
  resize: vertical;
  min-height: 80px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-group .checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.form-group .checkbox-label input[type="checkbox"] {
  width: auto;
}

.form-help {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 6px;
}

.modal-actions {
  display: flex;
  gap: 12px;
}

/* Auto Assign Modal */
.auto-assign-modal {
  max-width: 700px;
}

.dialog-hint {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 16px;
}

.select-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.btn-link {
  background: none;
  border: none;
  color: var(--accent-color);
  font-size: 13px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.btn-link:hover {
  background: var(--accent-color-light);
}

.requirements-list {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px;
}

.requirement-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.requirement-item:hover {
  background: var(--hover-bg);
  border-color: var(--accent-color-light-3);
  box-shadow: 0 0 0 2px var(--accent-color-light);
}

.requirement-item.is-selected {
  background: var(--accent-color-light);
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px var(--accent-color-light);
}

.requirement-item input[type="checkbox"] {
  margin-top: 2px;
}

.requirement-item-content {
  flex: 1;
  min-width: 0;
}

.requirement-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.requirement-item-title {
  font-weight: 500;
  color: var(--text-primary);
}

.requirement-item-priority {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
  font-weight: 500;
}

.requirement-item-priority.priority-low {
  background: var(--el-color-info-light-9);
  color: var(--el-color-info);
}

.requirement-item-priority.priority-medium {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.requirement-item-priority.priority-high {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}

.requirement-item-priority.priority-critical {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.requirement-item-desc {
  font-size: 12px;
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.selected-count {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 12px;
  text-align: center;
}

/* Node Detail Modal */
.node-detail-modal {
  max-width: 800px;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  font-size: 24px;
  color: var(--accent-color);
}

.node-subtitle {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.info-card {
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.info-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.info-value {
  font-size: 14px;
  color: var(--text-primary);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.status-done { background: var(--el-color-success-light-9); color: var(--el-color-success); }
.status-in-progress { background: var(--el-color-warning-light-9); color: var(--el-color-warning); }
.status-pending { background: var(--el-color-info-light-9); color: var(--el-color-info); }
.status-failed { background: var(--el-color-danger-light-9); color: var(--el-color-danger); }
.status-rejected { background: var(--el-color-danger-light-9); color: var(--el-color-danger); }

.agent-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.agent-icon {
  font-size: 14px;
}

.duration-value {
  font-weight: 500;
  color: var(--el-color-primary);
}

.rejected-reason-card {
  background: var(--el-color-danger-light-9);
  border: 1px solid var(--el-color-danger-light-7);
}

.rejected-title {
  color: var(--el-color-danger);
}

.rejected-reason-text {
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.6;
}

.chat-card {
  padding: 0;
  overflow: hidden;
}

.chat-card .info-card-title {
  padding: 16px 16px 0 16px;
}

.node-chat-container {
  height: 400px;
}

.child-nodes-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.child-node-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-primary);
  border-radius: 6px;
  border-left: 3px solid transparent;
}

.child-node-item.status-done {
  border-left-color: var(--el-color-success);
}

.child-node-item.status-in-progress {
  border-left-color: var(--el-color-warning);
}

.child-node-item.status-rejected {
  border-left-color: var(--el-color-danger);
}

.child-node-item.status-failed {
  border-left-color: var(--el-color-danger);
}

.child-status-icon {
  font-size: 18px;
}

.child-node-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.child-node-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.child-node-agent {
  font-size: 12px;
  color: var(--text-secondary);
}

.child-node-status {
  font-size: 12px;
  font-weight: 500;
}

.btn-close {
  min-width: 80px;
}

/* Icon spin animation */
.icon-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Kanban Column Styles */
.kanban-column {
  display: flex;
  flex-direction: column;
  min-width: 320px;
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  max-height: 100%;
}

.kanban-column.requirement-column {
  border-left: 1px solid var(--border-color);
}

.column-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  background: #eef2ff;
  border-radius: 12px 12px 0 0;
  font-weight: 600;
  font-size: 14px;
  color: var(--text-primary);
  position: sticky;
  top: 0;
  z-index: 10;
  flex-wrap: nowrap;
}

.column-header > * {
  flex-shrink: 0;
}

.column-status {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  align-self: center;
}

.column-status.status-requirement {
  background: #6366f1;
}

.column-status.status-todo {
  background: #6b7280;
}

.column-status.status-in-progress {
  background: #3b82f6;
}

.column-status.status-done {
  background: #10b981;
}

.column-status.status-blocked {
  background: #ef4444;
}

.column-title {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  align-self: center;
}

.column-count {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-primary);
  padding: 2px 8px;
  border-radius: 10px;
  min-width: 24px;
  text-align: center;
}

.status-filter-group {
  margin-left: auto;
  align-self: center;
}

.status-filter-group .el-checkbox-button__inner {
  font-size: 11px;
  padding: 3px 8px;
}

.column-count {
  font-size: 12px;
  min-width: 24px;
  text-align: center;
  align-self: center;
}

.sync-requirements-btn-header {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  margin-left: 4px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  align-self: center;
  flex-shrink: 0;
}

.sync-requirements-btn-header:hover:not(:disabled) {
  background: var(--accent-color-light);
  color: var(--accent-color);
}

.sync-requirements-btn-header:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.column-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.sync-requirements-btn {
  flex: 1;
  background: var(--bg-primary);
}

.sync-requirements-btn:hover:not(:disabled) {
  background: var(--accent-color-light);
  border-color: var(--accent-color);
  transform: translateY(-1px);
}

.sync-requirements-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.auto-assign-btn {
  flex: 1;
  background: var(--bg-primary);
}

.auto-assign-btn:hover:not(:disabled) {
  background: var(--accent-color-light);
  border-color: var(--accent-color);
  transform: translateY(-1px);
}

.auto-assign-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Toggle Converted Button */
.toggle-converted-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.toggle-converted-btn:hover {
  background: var(--hover-bg);
  color: var(--accent-color);
}

.toggle-converted-btn.is-hiding {
  color: var(--el-color-warning);
}

/* Empty Column State */
.empty-column {
  text-align: center;
  padding: 32px 16px;
  color: var(--text-placeholder);
  font-size: 13px;
}

/* Requirement Card in Kanban */
.kanban-column .requirement-card {
  margin-bottom: 12px;
}

/* Sync Modal */
.sync-modal {
  max-width: 700px;
}

.source-selector {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.preview-loading {
  padding: 16px;
}

.preview-list {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 8px;
  background: var(--bg-primary);
  border-radius: 4px;
}

.preview-hint {
  font-size: 13px;
  color: var(--text-secondary);
}

.preview-actions {
  display: flex;
  gap: 8px;
}

.preview-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.preview-item:hover {
  background: var(--bg-hover);
}

.preview-item.is-selected {
  background: var(--accent-color-light);
  border: 1px solid var(--accent-color);
}

.preview-item.is-imported {
  opacity: 0.6;
  background: var(--bg-tertiary);
}

.preview-item.is-imported:hover {
  background: var(--bg-tertiary);
  cursor: not-allowed;
}

.preview-item input[type="checkbox"] {
  margin-top: 4px;
}

.preview-item.is-imported input[type="checkbox"] {
  cursor: not-allowed;
}

.preview-item-content {
  flex: 1;
  min-width: 0;
}

.preview-item-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.imported-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
  font-weight: 500;
}

.issue-state {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  font-weight: 500;
  text-transform: uppercase;
}

.issue-state.open {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.issue-state.closed {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.preview-item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 6px;
}

.preview-item-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 6px 0;
}

.preview-item-author {
  display: flex;
  align-items: center;
  gap: 4px;
}

.preview-item-author .avatar {
  width: 16px;
  height: 16px;
  border-radius: 50%;
}

.preview-item-labels {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.preview-item-labels .label {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  color: #fff;
}

.empty-state {
  text-align: center;
  padding: 48px 16px;
  color: var(--text-placeholder);
}

/* Add requirement button styles */
.requirement-actions-row-bottom {
  margin-top: 8px;
}

.add-requirement-btn {
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
  width: 100%;
}

.add-requirement-btn:hover {
  border-color: #6366f1;
  color: #6366f1;
  background: #eef2ff;
}
</style>
