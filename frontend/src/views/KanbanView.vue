<template>
  <div class="app-container">
    <!-- Top Header -->
    <header class="top-header">
      <div class="project-selector">
        <select
          v-model="selectedProjectId"
          @change="handleProjectChange"
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
          <div class="iteration-filter">
            <IterationSelect
              v-model="selectedIterationId"
              :iterations="projectIterations"
              :placeholder="$t('iteration.allIterations')"
              clearable
              style="width: 200px"
            />
            <el-button
              type="primary"
              size="small"
              :disabled="!selectedProjectId"
              @click="openCreateIteration"
              style="margin-left: 8px"
            >
              {{ $t('iteration.createIteration') }}
            </el-button>
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
            :show-sync-button="true"
            :expanded-task-id="expandedTaskId"
            :current-node-id="currentViewingNodeId"
            @drag-end="onDragEnd"
            @select-task="selectTask"
            @edit-task="openTaskModal"
            @delete-task="deleteTask"
            @add-task="openTaskModal()"
            @worktree-update="handleWorktreeUpdate"
            @sync="handleSyncTaskSources"
            @toggle-workflow="handleToggleWorkflow"
            @workflow-action="handleWorkflowAction"
          />

          <!-- IN_PROGRESS Column -->
          <KanbanColumn
            status="IN_PROGRESS"
            :title="$t('status.IN_PROGRESS')"
            :tasks="localInProgressTasks"
            :selected-task="selectedTask"
            :running-task-ids="runningTasks"
            :empty-text="$t('task.noTasks')"
            :expanded-task-id="expandedTaskId"
            :current-node-id="currentViewingNodeId"
            @drag-end="onDragEnd"
            @select-task="selectTask"
            @edit-task="openTaskModal"
            @delete-task="deleteTask"
            @worktree-update="handleWorktreeUpdate"
            @toggle-workflow="handleToggleWorkflow"
            @workflow-action="handleWorkflowAction"
          />

          <!-- DONE Column -->
          <KanbanColumn
            status="DONE"
            :title="$t('status.DONE')"
            :tasks="localDoneTasks"
            :selected-task="selectedTask"
            :running-task-ids="runningTasks"
            :empty-text="$t('task.noDoneTasks')"
            :expanded-task-id="expandedTaskId"
            :current-node-id="currentViewingNodeId"
            @drag-end="onDragEnd"
            @select-task="selectTask"
            @edit-task="openTaskModal"
            @delete-task="deleteTask"
            @worktree-update="handleWorktreeUpdate"
            @toggle-workflow="handleToggleWorkflow"
            @workflow-action="handleWorkflowAction"
          />

          <!-- BLOCKED Column -->
          <KanbanColumn
            status="BLOCKED"
            :title="$t('status.BLOCKED')"
            :tasks="localBlockedTasks"
            :selected-task="selectedTask"
            :running-task-ids="runningTasks"
            :empty-text="$t('task.noBlockedTasks')"
            :expanded-task-id="expandedTaskId"
            :current-node-id="currentViewingNodeId"
            @drag-end="onDragEnd"
            @select-task="selectTask"
            @edit-task="openTaskModal"
            @delete-task="deleteTask"
            @worktree-update="handleWorktreeUpdate"
            @toggle-workflow="handleToggleWorkflow"
            @workflow-action="handleWorkflowAction"
          />
        </div>

        <!-- List View -->
        <KanbanListView
          v-else
          :tasks="filteredTasksForList"
          :selected-task="selectedTask"
          :running-task-ids="runningTasks"
          :status-filter="listStatusFilter"
          :expandedTaskId="expandedTaskId"
          :currentNodeId="currentViewingNodeId"
          @select-task="selectTask"
          @edit-task="openTaskModal"
          @delete-task="deleteTask"
          @update:status-filter="listStatusFilter = $event"
          @add-task="openTaskModal()"
          @reorder-tasks="handleReorderTasks"
          @worktree-update="handleWorktreeUpdate"
          @sync="handleSyncTaskSources"
          @toggle-workflow="handleToggleWorkflow"
          @workflow-action="handleWorkflowAction"
        />
      </div>

      <!-- Sync Preview Dialog -->
      <el-dialog
        v-model="taskSourceStore.showPreviewDialog"
        :title="$t('taskSource.previewTitle')"
        width="650px"
        class="sync-preview-dialog"
      >
        <div v-if="taskSourceStore.syncPreviewTasks.length === 0 && !taskSourceStore.syncError" class="sync-preview-empty">
          {{ $t('common.loading') }}
        </div>
        <div v-else-if="taskSourceStore.syncError" class="sync-preview-error">
          {{ taskSourceStore.syncError }}
        </div>
        <div v-else>
          <div class="sync-preview-controls">
            <el-button size="small" @click="selectAllSyncTasks">{{ $t('taskSource.selectAll') }}</el-button>
            <el-button size="small" @click="deselectAllSyncTasks">{{ $t('taskSource.deselectAll') }}</el-button>
            <span class="selected-count">
              {{ taskSourceStore.selectedSyncTasks.size }} / {{ taskSourceStore.syncPreviewTasks.filter(t => !t.imported).length }} {{ $t('taskSource.selected') }}
            </span>
          </div>
          <div class="sync-preview-list">
            <div
              v-for="task in taskSourceStore.syncPreviewTasks"
              :key="task.external_id"
              class="sync-preview-item"
              :class="{ selected: taskSourceStore.selectedSyncTasks.has(task.external_id), imported: task.imported }"
              @click="!task.imported && toggleSyncTask(task)"
            >
              <div class="item-checkbox">
                <input
                  type="checkbox"
                  :checked="taskSourceStore.selectedSyncTasks.has(task.external_id)"
                  :disabled="task.imported"
                  @click.stop="!task.imported && toggleSyncTask(task)"
                />
              </div>
              <div class="item-content">
                <div class="item-header">
                  <span class="item-title">{{ task.title }}</span>
                  <span class="item-status" :class="task.status?.toLowerCase()">{{ task.status }}</span>
                </div>
                <span v-if="task.imported" class="imported-badge">{{ $t('taskSource.imported') }}</span>
                <div class="item-labels" v-if="task.labels && task.labels.length > 0">
                  <span v-for="label in task.labels.slice(0, 5)" :key="label" class="label-badge">{{ label }}</span>
                </div>
                <div v-if="task.description" class="item-description">
                  {{ task.description.substring(0, 150) }}{{ task.description.length > 150 ? '...' : '' }}
                </div>
                <div class="item-meta">
                  <span class="item-id">#{{ task.external_id }}</span>
                  <span class="item-source">{{ task.sourceName }}</span>
                  <a
                    v-if="task.external_url"
                    :href="task.external_url"
                    target="_blank"
                    class="external-link"
                    @click.stop
                  >
                    {{ $t('taskSource.viewOnGitHub') }} →
                  </a>
                </div>
              </div>
            </div>
            <div v-if="taskSourceStore.syncPreviewTasks.length === 0" class="sync-preview-empty">
              {{ $t('taskSource.noTasksToImport') }}
            </div>
          </div>
        </div>
        <template #footer>
          <el-button @click="closeSyncPreview">{{ $t('common.cancel') }}</el-button>
          <el-button
            type="primary"
            @click="confirmSyncImport"
            :disabled="taskSourceStore.selectedSyncTasks.size === 0"
          >
            {{ $t('taskSource.confirmImport') }} ({{ taskSourceStore.selectedSyncTasks.size }})
          </el-button>
        </template>
      </el-dialog>

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
          <div class="welcome-logo">
            <span class="logo-devops">DevOps</span>
            <span class="logo-kanban">Kanban</span>
          </div>
          <h2>点击任务查看 Workflow</h2>
        </div>

        <!-- Chat Panel - Step Mode -->
        <div v-if="selectedTask && !isChatCollapsed && currentViewingNodeId" class="chat-content step-chat-mode">
          <div class="step-chat-header">
            <div class="step-header-info">
              <span class="step-task-title">{{ selectedTask.title }}</span>
              <div class="step-node-detail" v-if="currentViewingNode">
                <span class="step-status-badge" :class="'step-' + currentViewingNode.status?.toLowerCase()">
                  {{ getStatusText(currentViewingNode.status) }}
                </span>
                <span class="step-node-name">{{ currentViewingNode.name }}</span>
                <span class="step-node-role">@{{ currentViewingNode.role }}</span>
                <span v-if="currentViewingNode.duration" class="step-node-duration">{{ currentViewingNode.duration }}min</span>
              </div>
            </div>
          </div>
          <div class="step-chat-body">
            <ChatBox
              ref="stepChatBoxRef"
              :task="selectedTask"
              :agentId="currentViewingNode?.agentId || selectedAgentId"
              :initial-session="null"
              :default-collapsed="false"
              :workflow-node="currentViewingNode"
              @session-created="onNodeSessionCreated"
              @request-agent-select="handleRequestAgentSelect"
            />
          </div>
        </div>

        <!-- Chat Panel - Task Selected, No Step -->
        <div v-if="selectedTask && !isChatCollapsed && !currentViewingNodeId" class="chat-content task-chat-placeholder">
          <div class="task-placeholder-content">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <h2>点击 Workflow 节点进行对话</h2>
          </div>
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
          <div class="form-group">
            <label>{{ $t('task.iteration') }}</label>
            <IterationSelect
              v-model="taskForm.iteration_id"
              :iterations="projectIterations"
              :placeholder="$t('task.selectIteration')"
            />
            <p class="form-help">{{ $t('task.iterationHint') }}</p>
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

    <!-- Commit Dialog -->
    <CommitDialog
      v-if="showCommitDialog"
      :project-id="commitDialogData.projectId"
      :task-id="commitDialogData.taskId"
      :current-branch="commitDialogData.worktreeBranch"
      @close="showCommitDialog = false"
    />

    <!-- Merge Dialog -->
    <MergeDialog
      v-if="showMergeDialog"
      :project-id="mergeDialogData.projectId"
      :task-id="mergeDialogData.taskId"
      :source-branch="mergeDialogData.worktreeBranch"
      @close="showMergeDialog = false"
      @merged="handleMerged"
    />

    <!-- Iteration Form Dialog -->
    <IterationForm
      v-model="showIterationModal"
      :iteration="editingIteration"
      :loading="creatingIteration"
      @submit="handleIterationSubmit"
      @cancel="showIterationModal = false"
    />

    <WorkflowTemplateSelectDialog
      v-model="showWorkflowTemplateDialog"
      @confirm="handleWorkflowTemplateConfirm"
    />

    <!-- Workflow Node Detail Dialog -->
    <div v-if="showNodeDialog && selectedNode" class="modal-overlay" @click.self="showNodeDialog = false">
      <div class="modal node-detail-modal">
        <div class="modal-header">
          <div class="header-content">
            <el-icon class="header-icon"><component :is="getNodeRoleIcon(selectedNode.role)" /></el-icon>
            <div>
              <h2>{{ selectedNode.name }}</h2>
              <span class="node-subtitle"><el-icon><component :is="getNodeRoleIcon(selectedNode.role)" /></el-icon> {{ selectedNode.role }} · {{ selectedNode.agentName }}</span>
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
                  状态
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
              与 {{ selectedNode.agentName }} 对话
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
              子节点完成情况
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
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Monitor, VideoPlay, Edit, Cpu,
  OfficeBuilding, User, Setting, Brush, Search, Coin, Document,
  Aim, CircleCheck, View, Lock, Promotion, Box, Loading
} from '@element-plus/icons-vue'
import { useProjectStore } from '../stores/projectStore'
import { useTaskStore } from '../stores/taskStore'
import { useIterationStore } from '../stores/iterationStore'
import { useTaskSourceStore } from '../stores/taskSourceStore'
import { getActiveSessionByTask } from '../api/session.js'
import AgentSelector from '../components/AgentSelector.vue'
import ChatBox from '../components/ChatBox.vue'
import TaskButlerChat from '../components/TaskButlerChat.vue'
import DiffSelectDialog from '../components/DiffSelectDialog.vue'
import CommitDialog from '../components/CommitDialog.vue'
import MergeDialog from '../components/MergeDialog.vue'
import WorkflowTimelineDialog from '../components/WorkflowTimelineDialog.vue'
import WorkflowProgressDialog from '../components/WorkflowProgressDialog.vue'
import WorkflowTemplateSelectDialog from '../components/workflow/WorkflowTemplateSelectDialog.vue'
import IterationSelect from '../components/iteration/IterationSelect.vue'
import IterationForm from '../components/iteration/IterationForm.vue'
import draggable from 'vuedraggable'
import KanbanColumn from '../components/kanban/TaskColumn.vue'
import KanbanListView from '../components/kanban/KanbanListView.vue'
import { useTaskTimer } from '../composables/kanban/useTaskTimer'
import { useWorkflowManager } from '../composables/kanban/useWorkflowManager'
import { useKanbanSelection } from '../composables/kanban/useKanbanSelection'
import { analyzeTaskCategory } from '../mock/workflowAssignment'
import {
  getWorkflowByProject,
  getWorkflowByTask,
  getOrCreateWorkflowForProject,
  addNodeToWorkflow
} from '../mock/workflowData'
import { reorderTasks, startTask } from '../api/task.js'
import { useToast } from '../composables/ui/useToast'
import { useWorktree } from '../composables/useWorktree'

const { t } = useI18n()
const route = useRoute()
const toast = useToast()

// Use Pinia stores
const projectStore = useProjectStore()
const taskStore = useTaskStore()
const iterationStore = useIterationStore()
const taskSourceStore = useTaskSourceStore()
const { handleWorktree } = useWorktree()

const {
  selectedProjectId,
  selectedIterationId,
  viewMode,
  projectIterations,
  initializeSelection,
  onProjectChange,
} = useKanbanSelection({
  route,
  projectStore,
  taskStore,
  iterationStore,
})

// Local state
const selectedTask = ref(null)
const selectedAgentId = ref(null)
const showTaskModal = ref(false)
const showWorkflowDialog = ref(false)
const showProgressDialog = ref(false)
const showDiffDialog = ref(false)
const diffDialogData = ref(null)
const showCommitDialog = ref(false)
const commitDialogData = ref(null)
const showMergeDialog = ref(false)
const mergeDialogData = ref(null)
const showIterationModal = ref(false)
const editingIteration = ref(null)
const creatingIteration = ref(false)
const progressRunId = ref(null)
const isEditing = ref(false)
const editingTaskId = ref(null)
const activeSession = ref(null)
const chatBoxRef = ref(null)
const butlerChatRef = ref(null)
const nodeChatBoxRef = ref(null)
const stepChatBoxRef = ref(null)
const isChatCollapsed = ref(false)
const expandedTaskId = ref(null)
const currentViewingNodeId = ref(null)
const kanbanBoardRef = ref(null)
const showWorkflowTemplateDialog = ref(false)

// Clear currentViewingNodeId when selected task becomes DONE
watch(() => selectedTask.value?.status, (newStatus) => {
  if (newStatus === 'DONE' && currentViewingNodeId.value) {
    currentViewingNodeId.value = null
    currentViewingNode.value = null
  }
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

// Handle sync task sources from TODO column - show preview first
const handleSyncTaskSources = async () => {
  if (!selectedProjectId.value) return

  try {
    const tasks = await taskSourceStore.openSyncPreviewForProject(selectedProjectId.value)
    if (tasks.length === 0) {
      taskSourceStore.closePreviewDialog()
    }
  } catch (err) {
    console.error('Failed to sync task sources:', err)
    toast.error(err.message || t('taskSource.syncFailed'))
  }
}

const toggleSyncTask = (task) => {
  taskSourceStore.toggleSyncTask(task)
}

const selectAllSyncTasks = () => {
  taskSourceStore.selectAllSyncTasks()
}

const deselectAllSyncTasks = () => {
  taskSourceStore.deselectAllSyncTasks()
}

const confirmSyncImport = async () => {
  if (taskSourceStore.selectedSyncTasks.size === 0) {
    return
  }

  try {
    const totalImported = await taskSourceStore.importSelectedPreviewTasks(selectedProjectId.value)
    await taskStore.fetchTasks(selectedProjectId.value)
    if (totalImported > 0) {
      toast.success(t('taskSource.importSuccess', { count: totalImported }))
    }
  } catch (err) {
    console.error('Failed to import tasks:', err)
    toast.error(t('taskSource.importFailed'))
  }
}

const closeSyncPreview = () => {
  taskSourceStore.closePreviewDialog()
}

// Handle show diff dialog from butler chat
const handleShowDiff = (data) => {
  diffDialogData.value = data
  showDiffDialog.value = true
}

// Handle show commit dialog from butler chat
const handleShowCommit = (data) => {
  commitDialogData.value = data
  showCommitDialog.value = true
}

// Handle show merge dialog
const openMergeDialog = (data) => {
  mergeDialogData.value = data
  showMergeDialog.value = true
}

// Handle merged event
const handleMerged = () => {
  // Refresh task data after merge
  if (selectedProjectId.value) {
    taskStore.fetchTasks(selectedProjectId.value)
  }
  toast.success(t('git.mergeSuccess', '合并成功'))
}

// Handle delete worktree from butler header
const handleDeleteWorktree = async (task) => {
  const updatedTask = await handleWorktree(task, async () => {
    if (selectedProjectId.value) {
      await taskStore.fetchTasks(selectedProjectId.value)
    }
  })
  return updatedTask
}

// Handle workflow expand/collapse
const handleToggleWorkflow = (taskId) => {
  expandedTaskId.value = expandedTaskId.value === taskId ? null : taskId
}

const startSelectedTaskWithTemplate = async (workflowTemplateId) => {
  if (!selectedTask.value) return

  try {
    const response = await startTask(selectedTask.value.id, {
      workflow_template_id: workflowTemplateId
    })

    if (response.success) {
      ElMessage.success('任务已启动')
      if (selectedProjectId.value) {
        await taskStore.fetchTasks(selectedProjectId.value)
      }
      showWorkflowTemplateDialog.value = false
    } else {
      ElMessage.error(response.message || '启动失败')
    }
  } catch (error) {
    console.error('启动任务失败:', error)
    ElMessage.error('启动失败')
  }
}

const handleWorkflowTemplateConfirm = async (workflowTemplateId) => {
  await startSelectedTaskWithTemplate(workflowTemplateId)
}

// Handle workflow action from inline workflow panel
const handleWorkflowAction = (payload) => {
  console.log('[KanbanView] handleWorkflowAction called:', payload, 'selectedTask:', selectedTask.value?.id)

  // Extract action and task from payload
  const action = typeof payload === 'string' ? payload : payload.action
  const task = typeof payload === 'string' ? selectedTask.value : (payload.task || selectedTask.value)

  if (action === 'start') {
    console.log('[KanbanView] start action, task:', task?.id)
    if (task) {
      selectedTask.value = task
      console.log('[KanbanView] showing workflow template dialog')
      showWorkflowTemplateDialog.value = true
    } else {
      console.log('[KanbanView] no task, cannot start')
    }
  } else if (action === 'pause') {
      // Handle pause
    } else if (action === 'diff') {
      if (selectedTask.value) {
        handleShowDiff({
          taskId: selectedTask.value.id,
          projectId: selectedTask.value.project_id,
          worktreeBranch: selectedTask.value.worktree_branch
        })
      }
    } else if (action === 'commit') {
      if (selectedTask.value) {
        handleShowCommit({
          taskId: selectedTask.value.id,
          projectId: selectedTask.value.project_id,
          worktreeBranch: selectedTask.value.worktree_branch
        })
      }
    } else if (action === 'progress') {
      if (selectedTask.value?.workflow_run_id) {
        handleViewProgress({
          taskId: selectedTask.value.id,
          workflowRunId: selectedTask.value.workflow_run_id
        })
      }
    } else if (action === 'help') {
      // Help will be shown in chat
    } else if (action === 'merge') {
      if (selectedTask.value) {
        openMergeDialog({
          taskId: selectedTask.value.id,
          projectId: selectedTask.value.project_id,
          worktreeBranch: selectedTask.value.worktree_branch
        })
    }
  } else if (payload && payload.action === 'node-click') {
    selectedTask.value = payload.task || null
    currentViewingNodeId.value = payload.node?.id || null
    currentViewingNode.value = payload.node || null
    isChatCollapsed.value = false
    loadActiveSession()
  }
}

// Get current node from workflow for a task
const getCurrentNode = (task, expandedTaskId) => {
  if (!task.workflow) return null
  // Find current in-progress node
  for (const stage of task.workflow.stages || []) {
    for (const node of stage.nodes || []) {
      if (node.status === 'IN_PROGRESS') {
        return node
      }
    }
  }
  // If no in-progress node, return first pending node
  for (const stage of task.workflow.stages || []) {
    for (const node of stage.nodes || []) {
      if (node.status === 'PENDING' || node.status === 'TODO') {
        return node
      }
    }
  }
  return null
}

// Computed - tasks and projects
const tasks = computed(() => taskStore.tasks)
const projects = computed(() => projectStore.projects)

// Filtered tasks by iteration
const filteredTasks = computed(() => {
  if (!selectedIterationId.value) return tasks.value
  return tasks.value.filter(t => t.iteration_id === selectedIterationId.value)
})

// Worktree name from selected task
// Current viewing workflow node - directly from node-click payload
const currentViewingNode = ref(null)

// Clear node selection and return to task chat mode
const clearNodeSelection = () => {
  currentViewingNodeId.value = null
  currentViewingNode.value = null
}

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
const localBlockedTasks = ref([])

// Sync store to local arrays with iteration filter
watch(
  () => filteredTasks.value,
  (newTasks) => {
    localTodoTasks.value = newTasks.filter(t => t.status === 'TODO')
    localInProgressTasks.value = newTasks.filter(t => t.status === 'IN_PROGRESS')
    localDoneTasks.value = newTasks.filter(t => t.status === 'DONE')
    localBlockedTasks.value = newTasks.filter(t => t.status === 'BLOCKED')
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
  iteration_id: null,
  autoAssignWorkflow: true
})

// Agent selector
const showAgentSelector = ref(false)
const pendingTask = ref(null)

// Filtered tasks for list view - only sort, don't filter by status
// Status filtering is handled by KanbanListView components
const filteredTasksForList = computed(() => {
  const statusOrder = { 'TODO': 0, 'IN_PROGRESS': 2, 'DONE': 3, 'BLOCKED': 4 }
  return [...filteredTasks.value].sort((a, b) => {
    const orderA = statusOrder[a.status] ?? 5
    const orderB = statusOrder[b.status] ?? 5
    return orderA - orderB
  })
})

// Helper functions
const updateColumnRefs = () => {
  localTodoTasks.value = filteredTasks.value.filter(t => t.status === 'TODO')
  localInProgressTasks.value = filteredTasks.value.filter(t => t.status === 'IN_PROGRESS')
  localDoneTasks.value = filteredTasks.value.filter(t => t.status === 'DONE')
  localBlockedTasks.value = filteredTasks.value.filter(t => t.status === 'BLOCKED')
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

const handleProjectChange = async () => {
  selectedTask.value = null
  await onProjectChange()
  updateColumnRefs()
}

// Task selection
const selectTask = (task) => {
  // Toggle workflow when clicking the same task
  if (selectedTask.value && selectedTask.value.id === task.id) {
    expandedTaskId.value = expandedTaskId.value === task.id ? null : task.id
    return
  }
  console.log('[KanbanView] selectTask called with:', task)
  selectedTask.value = task
  // Clear any step selection when task changes
  currentViewingNodeId.value = null
  currentViewingNode.value = null
  // Auto expand workflow when task is selected
  expandedTaskId.value = task.id
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
    taskForm.iteration_id = task.iteration_id || null
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
    taskForm.iteration_id = null
    taskForm.autoAssignWorkflow = true
  }
  showTaskModal.value = true
}

const closeTaskModal = () => {
  showTaskModal.value = false
  isEditing.value = false
  editingTaskId.value = null
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

    closeTaskModal()
    ElMessage.success(isEditing.value ? t('task.updated') : t('task.created'))
  } catch (error) {
    console.error('Failed to save task:', error)
    ElMessage.error(t('task.saveFailed'))
  } finally {
    loading.saving = false
  }
}

// Open create iteration dialog
const openCreateIteration = () => {
  editingIteration.value = null
  showIterationModal.value = true
}

// Handle iteration form submit
const handleIterationSubmit = async (formData) => {
  creatingIteration.value = true
  try {
    const iterationData = {
      ...formData,
      project_id: selectedProjectId.value
    }

    if (editingIteration.value?.id) {
      await iterationStore.updateIteration(editingIteration.value.id, iterationData)
      ElMessage.success(t('common.saveSuccess'))
    } else {
      await iterationStore.createIteration(iterationData)
      ElMessage.success(t('common.createSuccess'))
    }

    showIterationModal.value = false
    // Refresh iterations
    await iterationStore.fetchByProject(selectedProjectId.value)
  } catch (error) {
    console.error('Failed to save iteration:', error)
    ElMessage.error(t('common.saveFailed'))
  } finally {
    creatingIteration.value = false
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
    await initializeSelection()
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
  padding-top: 16px;
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
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.view-toggle {
  display: flex;
  gap: 8px;
}

.iteration-filter {
  display: flex;
  align-items: center;
}

.view-btn-content {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* Sync Preview Dialog */
.sync-preview-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px;
  color: var(--el-text-color-secondary);
}

.sync-preview-error {
  padding: 20px;
  color: var(--el-color-danger);
  text-align: center;
}

.sync-preview-controls {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.selected-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-left: auto;
}

.sync-preview-list {
  max-height: 400px;
  overflow-y: auto;
}

.sync-preview-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: 1px solid var(--el-border-color-lightest);
}

.sync-preview-item:hover {
  background: var(--el-fill-color-light);
}

.sync-preview-item.selected {
  background: var(--el-color-primary-light-9);
}

.sync-preview-item.imported {
  opacity: 0.6;
  cursor: not-allowed;
}

.item-checkbox {
  padding-top: 2px;
}

.item-checkbox input {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.item-checkbox input:disabled {
  cursor: not-allowed;
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.item-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.item-status {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
}

.item-status.open {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.item-status.closed {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.imported-badge {
  display: inline-block;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--el-color-primary-light-8);
  color: var(--el-color-primary);
  margin-bottom: 4px;
}

.item-labels {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 4px;
}

.label-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
}

.item-description {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.item-id {
  font-weight: 500;
}

.item-source {
  color: var(--el-color-primary);
}

.external-link {
  color: var(--el-color-primary);
  text-decoration: none;
}

.external-link:hover {
  text-decoration: underline;
}

.task-info {
  flex: 1;
  min-width: 0;
}

.task-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.task-status {
  background: var(--el-fill-color-light);
  padding: 1px 6px;
  border-radius: 4px;
}

.task-source {
  color: var(--el-color-primary);
}

.sync-preview-empty {
  text-align: center;
  padding: 40px;
  color: var(--el-text-color-placeholder);
}

/* Chat Container */
.chat-container {
  width: 600px;
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
  background: var(--bg-secondary);
}

@keyframes welcome-pulse {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.08); }
}

.welcome-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
  animation: welcome-pulse 2s ease-in-out infinite;
}

.logo-devops,
.logo-kanban {
  font-size: 32px;
  font-weight: 800;
}

.logo-devops {
  color: #818cf8;
}

.logo-kanban {
  color: #a78bfa;
}

.chat-welcome h2 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.chat-welcome p {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.chat-welcome strong {
  color: var(--accent-color);
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

/* Step Chat Mode - Unified with card style */
.step-chat-mode {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary);
}

.step-chat-header {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  border-left: 3px solid var(--accent-color, #6366f1);
  background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
  flex-shrink: 0;
}

.step-header-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.step-task-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.step-node-detail {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.step-status-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.step-status-badge.step-done {
  background: #10b98120;
  color: #10b981;
}

.step-status-badge.step-in_progress {
  background: #f59e0b20;
  color: #f59e0b;
}

.step-status-badge.step-pending {
  background: #94a3b820;
  color: #94a3b8;
}

.step-status-badge.step-failed,
.step-status-badge.step-rejected {
  background: #ef444420;
  color: #ef4444;
}

.step-node-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-color);
}

.step-node-role {
  font-size: 11px;
  color: var(--text-secondary);
}

.step-node-duration {
  font-size: 11px;
  color: var(--text-muted);
}

.step-chat-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Task Chat Placeholder */
.task-chat-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  background: var(--bg-secondary);
}

.task-placeholder-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 40px;
}

.task-placeholder-content svg {
  margin-bottom: 20px;
  color: var(--accent-color);
  opacity: 0.5;
  animation: welcome-pulse 2s ease-in-out infinite;
}

.task-placeholder-content h2 {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
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
