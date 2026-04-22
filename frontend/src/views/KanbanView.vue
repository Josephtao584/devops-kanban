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
              class="open-iteration-manager"
              size="small"
              :disabled="!selectedProjectId"
              @click="showIterationManager = true"
            >
              {{ $t('iteration.manageIterations') }}
            </el-button>
            <el-button
              size="small"
              :disabled="!selectedProjectId"
              @click="showTaskSourcePanel = !showTaskSourcePanel"
            >
              任务源 {{ showTaskSourcePanel ? '▲' : '▼' }}
            </el-button>
          </div>
        </div>

        <!-- Task Source Panel -->
        <TaskSourcePanel
          v-if="showTaskSourcePanel"
          :project-id="selectedProjectId"
          :visible="showTaskSourcePanel"
          @update:visible="showTaskSourcePanel = $event"
          @tasks-imported="handleTasksImported"
        />

        <!-- Kanban Board -->
        <div v-if="viewMode === 'kanban'" class="kanban-board" ref="kanbanBoardRef">
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
            @delete-task="onDeleteTask"
            @add-task="openTaskModal()"
            @worktree-update="handleWorktreeUpdate"
            @sync="handleSyncTaskSources"
            @toggle-workflow="handleToggleWorkflow"
            @workflow-action="handleWorkflowAction"
            @quick-edit="handleQuickEdit"
          />

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
            @delete-task="onDeleteTask"
            @worktree-update="handleWorktreeUpdate"
            @toggle-workflow="handleToggleWorkflow"
            @workflow-action="handleWorkflowAction"
            @quick-edit="handleQuickEdit"
          />

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
            @delete-task="onDeleteTask"
            @worktree-update="handleWorktreeUpdate"
            @toggle-workflow="handleToggleWorkflow"
            @workflow-action="handleWorkflowAction"
            @quick-edit="handleQuickEdit"
          />

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
            @delete-task="onDeleteTask"
            @worktree-update="handleWorktreeUpdate"
            @toggle-workflow="handleToggleWorkflow"
            @workflow-action="handleWorkflowAction"
            @quick-edit="handleQuickEdit"
          />
        </div>

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
          @delete-task="onDeleteTask"
          @update:status-filter="listStatusFilter = $event"
          @add-task="openTaskModal()"
          @reorder-tasks="handleReorderTasks"
          @worktree-update="handleWorktreeUpdate"
          @sync="handleSyncTaskSources"
          @toggle-workflow="handleToggleWorkflow"
          @workflow-action="handleWorkflowAction"
          @quick-edit="handleQuickEdit"
          @update-task="handleUpdateTask"
        />
      </div>

      <BaseDialog
        v-if="!showTaskSourcePanel"
        v-model="taskSourceStore.showPreviewDialog"
        :title="$t('taskSource.previewTitle')"
        width="650px"
        custom-class="sync-preview-dialog"
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
                <div v-if="task.description" class="item-description-wrapper">
                  <div
                    class="item-description"
                    :class="{ expanded: expandedPreviewDescriptions.has(task.external_id) }"
                    :ref="(el) => setDescriptionRef(el, task.external_id)"
                    v-html="formatTaskDescription(task.description || '')"
                  ></div>
                  <button
                    v-if="overflowPreviewDescriptions.has(task.external_id) || expandedPreviewDescriptions.has(task.external_id)"
                    class="preview-description-toggle"
                    @click.stop="togglePreviewDescription(task.external_id)"
                  >
                    {{ expandedPreviewDescriptions.has(task.external_id) ? '收起 ↑' : '展开 ↓' }}
                  </button>
                </div>
                <div class="item-meta">
                  <span class="item-id">#{{ task.external_id }}</span>
                  <span class="item-source">{{ task.sourceName }}</span>
                  <template v-if="task.external_url && task.external_url.startsWith('file://')">
                    <span class="external-link local-path" :title="formatKanbanExternalUrl(task.external_url)">
                      {{ formatKanbanExternalUrl(task.external_url) }}
                    </span>
                  </template>
                  <a
                    v-else-if="task.external_url"
                    :href="task.external_url"
                    target="_blank"
                    class="external-link"
                    @click.stop
                  >
                    {{ $t('taskSource.viewExternalItem') }} →
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
      </BaseDialog>

      <div
        v-if="!isChatCollapsed"
        class="chat-resize-handle"
        @mousedown="startResize"
      ></div>
      <div class="chat-container" :class="{ collapsed: isChatCollapsed }" :style="!isChatCollapsed ? { width: chatWidth + 'px' } : {}">
        <div class="chat-toggle-btn" @click="isChatCollapsed = !isChatCollapsed" :title="isChatCollapsed ? 'Expand Chat' : 'Collapse Chat'">
          <span class="collapse-arrow" :class="{ collapsed: isChatCollapsed }">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </span>
        </div>

        <!-- Sync analysis view (highest priority in chat container) -->
        <div v-if="taskSourceStore.syncPanelVisible && !isChatCollapsed" class="chat-content sync-analysis-mode">
          <div class="step-chat-header">
            <div class="step-header-copy">
              <span class="step-header-label">{{ $t('taskSource.syncAnalysisTitle', 'Agent 分析') }}</span>
              <span v-if="taskSourceStore.syncSessionId" class="step-session-id" :title="'Session #' + taskSourceStore.syncSessionId">
                #{{ taskSourceStore.syncSessionId }}
              </span>
            </div>
            <el-button class="sync-analysis-close" size="small" text @click="taskSourceStore.closeSyncPanel()">
              ✕
            </el-button>
          </div>
          <div class="step-chat-body">
            <StepSessionPanel
              :session-id="taskSourceStore.syncSessionId"
              :show-header="false"
            />
          </div>
        </div>

        <div v-if="!selectedTask && !taskSourceStore.syncPanelVisible && !isChatCollapsed" class="chat-welcome">
          <div class="welcome-logo">
            <span class="logo-devops">DevOps</span>
            <span class="logo-kanban">Kanban</span>
          </div>
          <h2>点击任务查看 Workflow</h2>
        </div>

        <div v-if="selectedTask && !taskSourceStore.syncPanelVisible && !isChatCollapsed && currentViewingNodeId" class="chat-content step-chat-mode">
          <div class="step-chat-header">
            <div class="step-header-copy">
              <span class="step-header-label">Workflow 对话</span>
              <div class="step-node-detail" v-if="currentViewingNode">
                <span class="step-node-name">{{ currentViewingNode.name }}</span>
                <div class="step-node-meta">
                  <span class="step-status-badge" :class="'step-' + currentViewingNode.status?.toLowerCase()">
                    {{ getStatusText(currentViewingNode.status) }}
                  </span>
                  <span v-if="currentViewingAgent" class="step-agent-badge">
                    {{ currentViewingAgent.name }}
                  </span>
                  <span v-if="currentViewingNode.providerSessionId" class="step-session-id" :title="'Provider Session: ' + currentViewingNode.providerSessionId">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    {{ currentViewingNode.providerSessionId }}
                  </span>
                  <span v-if="!currentViewingNode.providerSessionId && currentViewingNode.sessionId" class="step-session-id" :title="'Session #' + currentViewingNode.sessionId">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    #{{ currentViewingNode.sessionId }}
                  </span>
                  <span v-if="currentViewingNode.duration" class="step-node-duration">{{ currentViewingNode.duration }}min</span>
                </div>
              </div>
            </div>
          </div>
          <div class="step-chat-body">
            <StepSessionPanel
              :session-id="currentViewingNode?.sessionId"
              :step-name="currentViewingNode?.name"
              :show-header="false"
              :workflow-run-id="selectedTask?.workflow_run_id"
              :assembled-prompt="currentViewingNode?.assembled_prompt || ''"
            />
          </div>
        </div>

        <div v-if="selectedTask && !taskSourceStore.syncPanelVisible && !isChatCollapsed && !currentViewingNodeId" class="chat-content task-chat-placeholder">
          <div class="task-placeholder-content">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <h2>选择一个 Workflow 节点</h2>
            <p>右侧会展示该步骤的执行会话、状态变化和继续对话入口。</p>
          </div>
        </div>
      </div>
    </div>

    <BaseDialog
      v-model="showTaskModal"
      :title="isEditing ? $t('task.editTask') : $t('task.newTask')"
      width="800px"
      custom-class="task-editor-dialog"
    >
      <el-form label-position="top">
        <el-form-item :label="$t('task.taskTitle')">
          <el-input
            v-model="taskForm.title"
            :placeholder="$t('task.taskTitlePlaceholder')"
            class="task-title-input"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
        <el-form-item :label="$t('task.taskDescription')">
          <el-input
            v-model="taskForm.description"
            type="textarea"
            :rows="12"
            :placeholder="$t('task.taskDescriptionPlaceholder')"
            class="task-description-input"
            maxlength="5000"
            show-word-limit
          />
        </el-form-item>
        <div class="form-row">
          <el-form-item :label="$t('task.status')">
            <el-select v-model="taskForm.status" class="full-width">
              <el-option value="TODO" :label="$t('status.TODO')" />
              <el-option value="IN_PROGRESS" :label="$t('status.IN_PROGRESS')" />
              <el-option value="DONE" :label="$t('status.DONE')" />
              <el-option value="BLOCKED" :label="$t('status.BLOCKED')" />
            </el-select>
          </el-form-item>
          <el-form-item :label="$t('task.priority')">
            <el-select v-model="taskForm.priority" class="full-width">
              <el-option value="LOW" :label="$t('priority.LOW')" />
              <el-option value="MEDIUM" :label="$t('priority.MEDIUM')" />
              <el-option value="HIGH" :label="$t('priority.HIGH')" />
              <el-option value="CRITICAL" :label="$t('priority.CRITICAL')" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item :label="$t('task.iteration')">
          <IterationSelect
            v-model="taskForm.iteration_id"
            :iterations="projectIterations"
            :placeholder="$t('task.selectIteration')"
            class="full-width"
          />
          <p class="form-help">{{ $t('task.iterationHint') }}</p>
        </el-form-item>
        <el-form-item :label="$t('task.workflowTemplate')">
          <el-select v-model="taskForm.auto_execute_template_id" class="full-width" clearable :placeholder="$t('task.noTemplate')">
            <el-option v-for="tmpl in workflowTemplates" :key="tmpl.template_id" :value="tmpl.template_id" :label="tmpl.name" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeTaskModal">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="saveTask">{{ $t('common.save') }}</el-button>
      </template>
    </BaseDialog>

    <AgentSelector
      v-if="showAgentSelector"
      v-model="showAgentSelector"
      :project-id="selectedProjectId"
      :task="pendingTask"
      @select="handleAgentSelect"
    />

    <WorkflowTimelineDialog
      v-model="showWorkflowDialog"
      :task-id="selectedTask?.id"
      :workflow-run-id="selectedTask?.workflow_run_id"
      @select-node="onNodeSelect"
      @view-details="onNodeViewDetails"
      @start-workflow="onStartWorkflow"
    />

    <WorkflowProgressDialog
      v-model="showProgressDialog"
      :task-id="selectedTask?.id"
      :workflow-run-id="progressRunId"
      :task-title="selectedTask?.title"
      @workflow-completed="handleWorkflowCompleted"
    />

    <DiffSelectDialog
      v-if="showDiffDialog"
      :project-id="diffDialogData.projectId"
      :task-id="diffDialogData.taskId"
      :worktree-branch="diffDialogData.worktreeBranch"
      @close="showDiffDialog = false"
    />

    <CommitDialog
      v-if="showCommitDialog"
      :project-id="commitDialogData.projectId"
      :task-id="commitDialogData.taskId"
      :current-branch="commitDialogData.worktreeBranch"
      @close="showCommitDialog = false"
    />

    <MergeDialog
      v-if="showMergeDialog"
      :project-id="mergeDialogData.projectId"
      :task-id="mergeDialogData.taskId"
      :source-branch="mergeDialogData.worktreeBranch"
      @close="showMergeDialog = false"
      @merged="handleMerged"
    />

    <CodeEditor
      v-if="showCodeEditor"
      :project-id="codeEditorData.projectId"
      :task-id="codeEditorData.taskId"
      :task-title="codeEditorData.taskTitle"
      @close="showCodeEditor = false"
    />

    <BaseDialog
      v-model="showIterationManager"
      :title="$t('iteration.manageIterationsTitle')"
      width="720px"
    >
      <div class="iteration-manager-actions">
        <el-button
          class="open-create-iteration"
          type="primary"
          size="small"
          @click="openCreateIteration"
        >
          {{ $t('iteration.createIteration') }}
        </el-button>
      </div>
      <IterationList
        :iterations="projectIterations"
        @edit="handleEditIteration"
        @delete="handleDeleteIteration"
      />
    </BaseDialog>

    <IterationForm
      v-model="showIterationModal"
      :iteration="editingIteration"
      :loading="creatingIteration"
      @submit="handleIterationSubmit"
      @cancel="showIterationModal = false"
    />

    <WorkflowTemplateSelectDialog
      v-model="showWorkflowTemplateDialog"
      :recommended-template-id="recommendedWorkflowTemplateId"
      @confirm="handleWorkflowTemplateConfirm"
    />

    <WorkflowStartEditorDialog
      v-model="showWorkflowStartEditorDialog"
      :draft-template="workflowStartDraftTemplate"
      :task-title="selectedTask?.title || ''"
      :task-description="selectedTask?.description || ''"
      :project-env="currentProjectEnv"
      @confirm="handleWorkflowStartEditorConfirm"
    />

    <BaseDialog
      v-model="showNodeDialog"
      :title="selectedNode?.name || ''"
      width="600px"
      :body-padding="false"
      custom-class="node-detail-dialog"
    >
      <div class="node-subtitle-header">
        <el-icon><component :is="getNodeRoleIcon(selectedNode?.role)" /></el-icon>
        {{ selectedNode?.role }} · {{ selectedNode?.agentName }}
      </div>
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
            <span class="info-value status-badge" :class="'status-' + selectedNode?.status?.toLowerCase()">
              <span class="status-dot"></span>
              {{ getStatusText(selectedNode?.status) }}
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
              <el-icon class="agent-icon"><component :is="getAgentIcon(selectedNode?.agentType)" /></el-icon>
              {{ selectedNode?.agentName }}
            </span>
          </div>
          <div class="info-item" v-if="selectedNode?.duration">
            <span class="info-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              耗时
            </span>
            <span class="info-value duration-value">{{ selectedNode?.duration }} 分钟</span>
          </div>
        </div>
      </div>

      <div v-if="selectedNode?.rejectedReason" class="info-card rejected-reason-card">
        <h3 class="info-card-title rejected-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          打回原因
        </h3>
        <p class="rejected-reason-text">{{ selectedNode?.rejectedReason }}</p>
      </div>

      <div v-if="selectedNode?.isParent && selectedNode?.childNodes" class="info-card">
        <h3 class="info-card-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
          子节点完成情况
        </h3>
        <div class="child-nodes-list">
          <div v-for="child in selectedNode?.childNodes" :key="child.id" class="child-node-item" :class="'status-' + child.status?.toLowerCase()">
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
      <template #footer>
        <el-button type="primary" @click="showNodeDialog = false">关闭</el-button>
      </template>
    </BaseDialog>

    </div>

  <BaseDialog
    v-model="showDeleteConfirm"
    :title="t('task.deleteConfirmTitle')"
    width="400px"
  >
    <div class="delete-confirm-content">
      <p>{{ t('task.deleteConfirmMessage') }}</p>
      <el-checkbox v-model="deleteWorktreeChecked" class="delete-worktree-checkbox">
        {{ t('task.deleteWorktreeCheckbox') }}
      </el-checkbox>
    </div>
    <template #footer>
      <el-button @click="showDeleteConfirm = false">{{ t('common.cancel') }}</el-button>
      <el-button type="danger" :loading="loading.saving" @click="confirmDeleteTask">
        {{ t('common.delete') }}
      </el-button>
    </template>
  </BaseDialog>
</template>

<script setup>
import { h, ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { ElCheckbox, ElMessage, ElMessageBox } from 'element-plus'
import {
  Monitor, VideoPlay, Edit, Cpu,
  OfficeBuilding, User, Setting, Document,
  CircleCheck, Lock, Promotion, Box, Loading
} from '@element-plus/icons-vue'
import { useProjectStore } from '../stores/projectStore'
import { useTaskStore } from '../stores/taskStore'
import { useIterationStore } from '../stores/iterationStore'
import { useTaskSourceStore } from '../stores/taskSourceStore'
import { useAgentStore } from '../stores/agentStore'
import BaseDialog from '../components/BaseDialog.vue'
import AgentSelector from '../components/AgentSelector.vue'
import StepSessionPanel from '../components/workflow/StepSessionPanel.vue'
import DiffSelectDialog from '../components/DiffSelectDialog.vue'
import CommitDialog from '../components/CommitDialog.vue'
import MergeDialog from '../components/MergeDialog.vue'
import WorkflowTimelineDialog from '../components/WorkflowTimelineDialog.vue'
import WorkflowProgressDialog from '../components/WorkflowProgressDialog.vue'
import WorkflowTemplateSelectDialog from '../components/workflow/WorkflowTemplateSelectDialog.vue'
import WorkflowStartEditorDialog from '../components/workflow/WorkflowStartEditorDialog.vue'
import IterationSelect from '../components/iteration/IterationSelect.vue'
import IterationList from '../components/iteration/IterationList.vue'
import IterationForm from '../components/iteration/IterationForm.vue'
import TaskSourcePanel from '../components/taskSource/TaskSourcePanel.vue'
import KanbanColumn from '../components/kanban/TaskColumn.vue'
import KanbanListView from '../components/kanban/KanbanListView.vue'
import CodeEditor from '../components/editor/CodeEditor.vue'
import { useTaskTimer } from '../composables/kanban/useTaskTimer'
import { useWorkflowManager } from '../composables/kanban/useWorkflowManager'
import { useKanbanSelection } from '../composables/kanban/useKanbanSelection'
import { analyzeTaskCategory, getRecommendedWorkflowTemplateId } from '../mock/workflowAssignment'
import { getWorkflowTemplates } from '../api/workflowTemplate.js'
import { reorderTasks, startTask, deleteTask, updateTask } from '../api/task.js'
import { getWorkflowTemplateById } from '../api/workflowTemplate.js'
import { normalizeWorkflowTemplate } from '../components/workflow/templateEditorShared.js'
import { formatTaskDescription } from '../utils/taskDescriptionFormatter'
import { useToast } from '../composables/ui/useToast'
import { useWorktree } from '../composables/useWorktree'
import { agentConfig, roleConfig } from '../constants/workflowPresentation.js'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()

const projectStore = useProjectStore()
const taskStore = useTaskStore()
const iterationStore = useIterationStore()
const taskSourceStore = useTaskSourceStore()
const agentStore = useAgentStore()
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

const selectedTask = ref(null)
const showTaskModal = ref(false)
const showWorkflowDialog = ref(false)
const showProgressDialog = ref(false)
const showDiffDialog = ref(false)
const diffDialogData = ref(null)
const showCommitDialog = ref(false)
const commitDialogData = ref(null)
const showMergeDialog = ref(false)
const mergeDialogData = ref(null)
const showCodeEditor = ref(false)
const codeEditorData = ref(null)
const showIterationManager = ref(false)
const showTaskSourcePanel = ref(false)
const showIterationModal = ref(false)
const editingIteration = ref(null)
const creatingIteration = ref(false)
const progressRunId = ref(null)
const isEditing = ref(false)
const editingTaskId = ref(null)
const isChatCollapsed = ref(false)

const CHAT_WIDTH_KEY = 'kanban-chat-width'
const DEFAULT_CHAT_WIDTH = 720
const MIN_CHAT_WIDTH = 360
const MAX_CHAT_WIDTH = 1600
const savedWidth = localStorage.getItem(CHAT_WIDTH_KEY)
const chatWidth = ref(savedWidth ? parseInt(savedWidth, 10) : DEFAULT_CHAT_WIDTH)
const isResizing = ref(false)

function startResize(e) {
  e.preventDefault()
  isResizing.value = true
  const startX = e.clientX
  const startWidth = chatWidth.value
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'

  function onMouseMove(e) {
    const delta = startX - e.clientX
    const newWidth = Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, startWidth + delta))
    chatWidth.value = newWidth
  }

  function onMouseUp() {
    isResizing.value = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    localStorage.setItem(CHAT_WIDTH_KEY, String(chatWidth.value))
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}
const expandedTaskId = ref(null)
const expandedPreviewDescriptions = ref(new Set())
const overflowPreviewDescriptions = ref(new Set())
const descriptionRefs = ref({})

const setDescriptionRef = (el, externalId) => {
  if (el && descriptionRefs.value) {
    descriptionRefs.value[externalId] = el
    checkPreviewDescriptionOverflow(externalId)
  }
}

const checkPreviewDescriptionOverflow = (externalId) => {
  nextTick(() => {
    const el = descriptionRefs.value[externalId]
    if (el && el.scrollHeight > el.clientHeight + 2) {
      overflowPreviewDescriptions.value = new Set([...overflowPreviewDescriptions.value, externalId])
    }
  })
}

const togglePreviewDescription = (externalId) => {
  const newSet = new Set(expandedPreviewDescriptions.value)
  if (newSet.has(externalId)) {
    newSet.delete(externalId)
  } else {
    newSet.add(externalId)
  }
  expandedPreviewDescriptions.value = newSet
}
const currentViewingNodeId = ref(null)
const kanbanBoardRef = ref(null)
const showWorkflowTemplateDialog = ref(false)
const templateDialogMode = ref('start') // 'start' or 'save'
const showDeleteConfirm = ref(false)
const deleteWorktreeChecked = ref(false)
const pendingDeleteTaskId = ref(null)
const showWorkflowStartEditorDialog = ref(false)
const workflowStartDraftTemplate = ref(null)
const selectedWorkflowTemplateId = ref('')
const recommendedWorkflowTemplateId = ref('')

watch(() => selectedTask.value?.status, (newStatus) => {
  if (newStatus === 'DONE' && currentViewingNodeId.value) {
    currentViewingNodeId.value = null
    currentViewingNode.value = null
  }
})

// Auto-expand chat when sync analysis opens
watch(() => taskSourceStore.syncPanelVisible, (visible) => {
  if (visible) {
    isChatCollapsed.value = false
  }
})

const listStatusFilter = ref(['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED'])
const isComponentMounted = ref(false)

const {
  runningTasks,
  isTaskRunning,
  startTaskTimer,
  stopTaskTimer,
  formatTaskElapsedTime,
  cleanup: cleanupTimer
} = useTaskTimer()

const {
  selectedNode,
  showNodeDialog,
  onNodeSelect,
  onNodeViewDetails,
  onStartWorkflow
} = useWorkflowManager({
  selectedTask,
  selectedProjectId,
  showWorkflowDialog,
  t
})

const handleViewProgress = ({ taskId, workflowRunId }) => {
  progressRunId.value = workflowRunId
  showProgressDialog.value = true
}

const handleWorkflowCompleted = async () => {
  if (selectedProjectId.value) {
    await taskStore.fetchTasks(selectedProjectId.value)
  }
  if (selectedTask.value) {
    const updated = taskStore.tasks.find(t => t.id === selectedTask.value.id)
    if (updated) {
      selectedTask.value = updated
    }
  }
}

const handleReorderTasks = async (newOrder) => {
  try {
    localTasks.value = [...newOrder]
    taskStore.tasks = [...newOrder]
    await reorderTasks(newOrder)
    console.log('[KanbanView] Tasks reordered successfully')
  } catch (error) {
    console.error('[KanbanView] Failed to reorder tasks:', error)
    await taskStore.fetchTasks(selectedProjectId.value)
  }
}

const handleWorktreeUpdate = (task) => {
  console.log('[KanbanView] Worktree updated for task:', task.id)
}

const handleSyncTaskSources = async () => {
  if (!selectedProjectId.value) return

  try {
    const response = await taskSourceStore.previewSync(selectedProjectId.value)
    if (!response || response.fileCount === 0) {
      ElMessage.info(t('taskSource.noNewFiles', '没有新文件可导入'))
      return
    }
    taskSourceStore.openSyncPreviewDialog()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

const formatKanbanExternalUrl = (url) => {
  if (url.startsWith('file://')) return url.replace('file://', '')
  return url
}

const handleTasksImported = async () => {
  if (selectedProjectId.value) {
    await taskStore.fetchTasks(selectedProjectId.value)
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
    const totalImported = await taskSourceStore.importSelectedPreviewTasks(
      selectedProjectId.value,
      selectedIterationId.value
    )
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

const handleShowDiff = (data) => {
  diffDialogData.value = data
  showDiffDialog.value = true
}

const handleShowCommit = (data) => {
  commitDialogData.value = data
  showCommitDialog.value = true
}

const openMergeDialog = (data) => {
  mergeDialogData.value = data
  showMergeDialog.value = true
}

const handleMerged = () => {
  if (selectedProjectId.value) {
    taskStore.fetchTasks(selectedProjectId.value)
  }
  toast.success(t('git.mergeSuccess', '合并成功'))
}

const handleToggleWorkflow = (taskId) => {
  expandedTaskId.value = expandedTaskId.value === taskId ? null : taskId
}

const startSelectedTaskWithTemplate = async (
  workflowTemplateId,
  workflowTemplateSnapshot,
  autoCreateWorktree = false
) => {
  if (!selectedTask.value) return

  if (autoCreateWorktree && selectedTask.value.worktree_status !== 'created') {
    try {
      const result = await handleWorktree(selectedTask.value)
      if (!result) {
        showWorkflowStartEditorDialog.value = false
        ElMessageBox.alert('Worktree 创建失败，无法启动任务', '启动失败', { type: 'error' })
        return
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Worktree 创建失败，无法启动任务'
      showWorkflowStartEditorDialog.value = false
      ElMessageBox.alert(msg, '启动失败', { type: 'error' })
      return
    }
  }

  try {
    const response = await startTask(selectedTask.value.id, {
      workflow_template_id: workflowTemplateId,
      workflow_template_snapshot: workflowTemplateSnapshot
    })

    if (response.success) {
      ElMessage.success('任务已启动')
      showWorkflowTemplateDialog.value = false
      showWorkflowStartEditorDialog.value = false
      workflowStartDraftTemplate.value = null
      selectedWorkflowTemplateId.value = ''
      recommendedWorkflowTemplateId.value = ''

      if (selectedProjectId.value) {
        await taskStore.fetchTasks(selectedProjectId.value)
        const updated = taskStore.tasks.find(t => t.id === selectedTask.value?.id)
        if (updated) {
          selectedTask.value = updated
        }
      }
    } else {
      showWorkflowStartEditorDialog.value = false
      ElMessageBox.alert(response.message || '启动失败', '启动失败', { type: 'error' })
    }
  } catch (error) {
    console.error('启动任务失败:', error)
    const msg = error?.response?.data?.message || error?.message || '启动失败'
    showWorkflowStartEditorDialog.value = false
    ElMessageBox.alert(msg, '启动失败', { type: 'error' })
  }
}

const handleWorkflowTemplateConfirm = async ({ templateId, autoCreateWorktree }) => {
  if (templateDialogMode.value === 'save') {
    // Save template to task without starting
    try {
      await updateTask(selectedTask.value.id, {
        auto_execute: 1,
        auto_execute_template_id: templateId,
      })
      showWorkflowTemplateDialog.value = false
      ElMessage.success('模板已保存')
      await taskStore.fetchTasks(selectedProjectId.value)
      const updated = taskStore.tasks.find(t => t.id === selectedTask.value?.id)
      if (updated) selectedTask.value = updated
    } catch (error) {
      console.error('保存模板失败:', error)
      ElMessage.error('保存模板失败')
    }
    return
  }

  // Start mode: load template and open editor
  try {
    const response = await getWorkflowTemplateById(templateId)
    if (!response?.success) {
      ElMessage.error(response?.message || '加载工作流模板失败')
      return
    }

    // Save selected template to task
    await updateTask(selectedTask.value.id, {
      auto_execute: 1,
      auto_execute_template_id: templateId,
    })

    selectedWorkflowTemplateId.value = templateId
    workflowStartDraftTemplate.value = normalizeWorkflowTemplate(response.data)
    showWorkflowTemplateDialog.value = false
    showWorkflowStartEditorDialog.value = true
    workflowStartDraftTemplate.value.autoCreateWorktree = autoCreateWorktree
    recommendedWorkflowTemplateId.value = ''
  } catch (error) {
    console.error('加载工作流模板失败:', error)
    ElMessage.error('加载工作流模板失败')
  }
}

const handleWorkflowStartEditorConfirm = async (draftTemplate, autoCreateWorktree) => {
  await startSelectedTaskWithTemplate(
    selectedWorkflowTemplateId.value,
    normalizeWorkflowTemplate(draftTemplate),
    Boolean(autoCreateWorktree ?? workflowStartDraftTemplate.value?.autoCreateWorktree)
  )
}

const handleWorkflowAction = (payload) => {
  console.log('[KanbanView] handleWorkflowAction called:', payload, 'selectedTask:', selectedTask.value?.id)

  const action = typeof payload === 'string' ? payload : payload.action
  const task = typeof payload === 'string' ? selectedTask.value : (payload.task || selectedTask.value)

  if (action === 'start') {
    console.log('[KanbanView] start action, task:', task?.id)
    if (task) {
      selectedTask.value = task

      // If task has a configured template, start directly without selection dialog
      if (task.auto_execute_template_id) {
        console.log('[KanbanView] task has auto_execute_template_id, starting directly')
        handleStartWithConfiguredTemplate(task)
      } else {
        const category = task.category || analyzeTaskCategory(task.title, task.description)
        recommendedWorkflowTemplateId.value = getRecommendedWorkflowTemplateId(category)
        templateDialogMode.value = 'start'
        console.log('[KanbanView] showing workflow template dialog')
        showWorkflowTemplateDialog.value = true
      }
    } else {
      console.log('[KanbanView] no task, cannot start')
    }
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
  } else if (action === 'merge') {
    if (selectedTask.value) {
      openMergeDialog({
        taskId: selectedTask.value.id,
        projectId: selectedTask.value.project_id,
        worktreeBranch: selectedTask.value.worktree_branch
      })
    }
  } else if (action === 'configure') {
    if (task) {
      selectedTask.value = task
      handleConfigureWorkflow(task)
    }
  } else if (payload && payload.action === 'node-click') {
    selectedTask.value = payload.task || null
    currentViewingNodeId.value = payload.node?.id || null
    currentViewingNode.value = payload.node || null
    isChatCollapsed.value = false
  }
}

const handleStartWithConfiguredTemplate = async (task) => {
  try {
    const response = await getWorkflowTemplateById(task.auto_execute_template_id)
    if (!response?.success) {
      ElMessage.error(response?.message || '加载工作流模板失败')
      return
    }
    selectedWorkflowTemplateId.value = task.auto_execute_template_id
    workflowStartDraftTemplate.value = normalizeWorkflowTemplate(response.data)
    workflowStartDraftTemplate.value.autoCreateWorktree = true
    showWorkflowStartEditorDialog.value = true
  } catch (error) {
    console.error('加载工作流模板失败:', error)
    ElMessage.error('加载工作流模板失败')
  }
}

const handleConfigureWorkflow = async (task) => {
  // Always open template selection in 'save' mode
  selectedTask.value = task
  recommendedWorkflowTemplateId.value = task.auto_execute_template_id || ''
  templateDialogMode.value = 'save'
  showWorkflowTemplateDialog.value = true
}

const handleQuickEdit = (task) => {
  codeEditorData.value = {
    projectId: task.project_id,
    taskId: task.id,
    taskTitle: task.title,
  }
  showCodeEditor.value = true
}

const handleUpdateTask = async ({ id, ...data }) => {
  try {
    await updateTask(id, data)
    await taskStore.fetchTasks(currentProject.value?.id)
  } catch (error) {
    console.error('Failed to update task:', error)
  }
}

const tasks = computed(() => taskStore.tasks)
const projects = computed(() => projectStore.projects)
const currentProjectEnv = computed(() => {
  const project = projects.value.find(p => String(p.id) === String(selectedProjectId.value))
  return project?.env || {}
})

const filteredTasks = computed(() => {
  if (!selectedIterationId.value) return tasks.value
  return tasks.value.filter(t => t.iteration_id === selectedIterationId.value)
})

const currentViewingNode = ref(null)

const localTodoTasks = ref([])
const localInProgressTasks = ref([])
const localDoneTasks = ref([])
const localBlockedTasks = ref([])

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

const loading = reactive({
  projects: computed(() => projectStore.loading),
  tasks: computed(() => taskStore.loading),
  saving: false
})

const taskForm = reactive({
  title: '',
  description: '',
  category: '',
  status: 'TODO',
  priority: 'MEDIUM',
  assignee: '',
  iteration_id: null,
  auto_execute_template_id: null,
  auto_execute: 0,
})

const workflowTemplates = ref([])
const workflowTemplatesLoaded = ref(false)

async function loadWorkflowTemplates() {
  if (workflowTemplatesLoaded.value) return
  try {
    const res = await getWorkflowTemplates()
    if (res.success && res.data) {
      workflowTemplates.value = res.data
    }
    workflowTemplatesLoaded.value = true
  } catch { /* silently fail */ }
}

const showAgentSelector = ref(false)
const pendingTask = ref(null)

const filteredTasksForList = computed(() => {
  const statusOrder = { 'TODO': 0, 'IN_PROGRESS': 2, 'DONE': 3, 'BLOCKED': 4 }
  return [...filteredTasks.value].sort((a, b) => {
    const orderA = statusOrder[a.status] ?? 5
    const orderB = statusOrder[b.status] ?? 5
    return orderA - orderB
  })
})

const updateColumnRefs = () => {
  localTodoTasks.value = filteredTasks.value.filter(t => t.status === 'TODO')
  localInProgressTasks.value = filteredTasks.value.filter(t => t.status === 'IN_PROGRESS')
  localDoneTasks.value = filteredTasks.value.filter(t => t.status === 'DONE')
  localBlockedTasks.value = filteredTasks.value.filter(t => t.status === 'BLOCKED')
}

const getNodeRoleIcon = (role) => {
  if (!role) return Document
  // roleConfig uses emoji icons, not Element Plus icon components
  return Document
}

const agentIconMap = { Monitor, VideoPlay, Edit, Cpu }

const currentViewingAgent = computed(() => {
  const agentId = currentViewingNode.value?.agentId
  if (!agentId) return null
  return agentStore.agents.find(a => a.id === agentId || String(a.id) === String(agentId)) || null
})

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
    'CANCELLED': '已取消',
    'SUSPENDED': '等待确认',
    'TODO': '待办'
  }
  return statusMap[status] || status
}

const handleProjectChange = async () => {
  selectedTask.value = null
  await onProjectChange()
  if (!isComponentMounted.value) return
  router.replace(`/kanban/${selectedProjectId.value}`)
  updateColumnRefs()
}

const selectTask = (task) => {
  if (selectedTask.value && selectedTask.value.id === task.id) {
    expandedTaskId.value = expandedTaskId.value === task.id ? null : task.id
    return
  }
  console.log('[KanbanView] selectTask called with:', task)
  selectedTask.value = task
  currentViewingNodeId.value = null
  currentViewingNode.value = null
  expandedTaskId.value = task.id
}

const openTaskModal = (task = null) => {
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
    taskForm.auto_execute_template_id = task.auto_execute_template_id || null
    taskForm.auto_execute = task.auto_execute || 0
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
    taskForm.auto_execute_template_id = null
    taskForm.auto_execute = 0
  }
  loadWorkflowTemplates()
  showTaskModal.value = true
}

const closeTaskModal = () => {
  showTaskModal.value = false
  isEditing.value = false
  editingTaskId.value = null
}

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
      projectId: selectedProjectId.value,
      auto_execute: taskForm.auto_execute_template_id ? 1 : 0,
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

const openCreateIteration = () => {
  editingIteration.value = null
  showIterationModal.value = true
}

const handleEditIteration = (iteration) => {
  editingIteration.value = iteration
  showIterationModal.value = true
}

const handleDeleteIteration = async (iteration) => {
  const deleteTasksRef = ref(false)

  try {
    await ElMessageBox.confirm(
      h('div', { class: 'iteration-delete-confirm' }, [
        h('p', t('iteration.deleteConfirmMessage', { name: iteration.name })),
        h(ElCheckbox, {
          modelValue: deleteTasksRef.value,
          'onUpdate:modelValue': (value) => {
            deleteTasksRef.value = value
          }
        }, () => t('iteration.deleteTasksCheckbox'))
      ]),
      t('iteration.deleteConfirmTitle'),
      {
        type: 'warning',
        confirmButtonText: t('common.delete'),
        cancelButtonText: t('common.cancel'),
        dangerouslyUseHTMLString: false
      }
    )
  } catch {
    return
  }

  let deleted = false

  try {
    const response = await iterationStore.deleteIteration(iteration.id, { deleteTasks: deleteTasksRef.value })
    if (!response?.success) {
      throw new Error(response?.message || response?.error || t('iteration.deleteFailed'))
    }

    deleted = true

    if (selectedIterationId.value === iteration.id || String(selectedIterationId.value) === String(iteration.id)) {
      selectedIterationId.value = null
    }

    await Promise.all([
      iterationStore.fetchByProject(selectedProjectId.value),
      taskStore.fetchTasks(selectedProjectId.value)
    ])

    ElMessage.success(t('iteration.deleted'))
  } catch (error) {
    console.error('Failed to delete iteration:', error)
    if (deleted) {
      ElMessage.warning(t('iteration.refreshAfterDeleteFailed'))
      return
    }
    ElMessage.error(t('iteration.deleteFailed'))
  }
}

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
    editingIteration.value = null
    await iterationStore.fetchByProject(selectedProjectId.value)
  } catch (error) {
    console.error('Failed to save iteration:', error)
    ElMessage.error(t('common.saveFailed'))
  } finally {
    creatingIteration.value = false
  }
}

const onDeleteTask = async (taskId) => {
  pendingDeleteTaskId.value = taskId
  deleteWorktreeChecked.value = false
  showDeleteConfirm.value = true
}

const confirmDeleteTask = async () => {
  const taskId = pendingDeleteTaskId.value
  if (!taskId) return

  showDeleteConfirm.value = false
  loading.saving = true
  try {
    await deleteTask(taskId, deleteWorktreeChecked.value)
    await taskStore.fetchTasks(selectedProjectId.value)
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
    pendingDeleteTaskId.value = null
  }
}

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

const handleAgentSelect = ({ task }) => {
  pendingTask.value = task
  showAgentSelector.value = false
}

// Lifecycle
onMounted(async () => {
  isComponentMounted.value = true
  agentStore.fetchAgents()
  try {
    await initializeSelection()
    if (!isComponentMounted.value) return
    if (selectedProjectId.value && route.params.projectId !== selectedProjectId.value) {
      router.replace(`/kanban/${selectedProjectId.value}`)
    }
  } catch (error) {
    console.error('Failed to fetch initial data:', error)
    ElMessage.error('加载数据失败')
  }
})

onUnmounted(() => {
  isComponentMounted.value = false
  cleanupTimer()
})
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary);
  color: var(--text-primary);
  overflow: hidden;
}

.top-header {
  display: flex;
  padding: 14px 20px;
  gap: 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--panel-bg);
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
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
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
  box-shadow: 0 0 0 3px var(--accent-color-soft);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: var(--button-compact-height);
  padding: var(--button-normal-padding-y) var(--button-normal-padding-x);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-size: var(--button-font-size);
  font-weight: var(--button-font-weight);
  line-height: 1;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: var(--button-primary-gradient);
  border-color: var(--button-primary-active-border);
  color: var(--button-primary-text);
  box-shadow: var(--button-primary-shadow);
}

.btn-primary:hover {
  background: var(--button-primary-gradient-hover);
  border-color: var(--button-primary-active-border);
  box-shadow: var(--button-primary-shadow-hover);
}

.btn-secondary {
  background: var(--button-surface-bg);
  color: var(--button-surface-text);
  border-color: var(--button-surface-border);
  box-shadow: var(--button-neutral-shadow);
}

.btn-secondary:hover {
  background: var(--button-surface-hover-bg);
  border-color: var(--button-surface-hover-border);
  color: var(--button-surface-hover-text);
}

.main-content-wrapper {
  display: flex;
  flex: 1;
  min-height: 0;
}

.kanban-area {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow-x: auto;
  padding-top: 18px;
  background: var(--bg-secondary);
}

.kanban-area :deep(.workflow-timeline) {
  margin: 0 20px 12px;
  flex-shrink: 0;
  max-width: calc(100% - 40px);
}

.kanban-board {
  display: flex;
  flex: 1;
  padding: 0 20px 20px;
  gap: 16px;
  min-height: 0;
  align-content: stretch;
  overflow-x: auto;
  flex-wrap: nowrap;
}

.view-toolbar {
  margin: 0 20px;
  min-height: 40px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 0;
  box-shadow: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.view-toolbar > * {
  align-self: center;
}

.view-toggle {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.view-toggle :deep(.el-radio-group) {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 6px;
}

.view-toggle :deep(.el-radio-button) {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.view-toggle :deep(.el-radio-button__inner) {
  min-width: 88px;
  min-height: 30px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  box-sizing: border-box;
  box-shadow: none;
}

.view-toggle :deep(.el-radio-button__inner)::before {
  display: none;
}

.view-toggle :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  border-color: var(--accent-color);
  box-shadow: none;
}

.view-btn-content {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  line-height: 1;
  font-size: 12px;
}

.view-btn-content svg {
  flex-shrink: 0;
}

.iteration-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.iteration-filter > :first-child {
  width: 200px;
  flex: 0 0 200px;
}

.view-toolbar :deep(.el-select) {
  width: 100%;
}

.view-toolbar :deep(.el-input__wrapper),
.view-toolbar :deep(.el-select__wrapper) {
  width: 100%;
  min-height: 30px;
  border-radius: var(--radius-sm);
}

.view-toolbar :deep(.el-select__wrapper) {
  justify-content: space-between;
}

.view-toolbar :deep(.el-select__placeholder),
.view-toolbar :deep(.el-input__inner) {
  font-size: 12px;
  white-space: nowrap;
}

.view-toolbar :deep(.el-button) {
  min-height: var(--button-compact-height);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  padding: var(--button-tight-padding-y) var(--button-tight-padding-x);
  line-height: 1;
  font-size: var(--button-font-size);
  font-weight: var(--button-font-weight);
  flex-shrink: 0;
  box-shadow: var(--button-neutral-shadow);
}

.view-toolbar :deep(.el-button span) {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}

.view-toolbar :deep(.el-button--primary.is-plain) {
  background: var(--button-primary-plain-bg);
  border-color: var(--button-primary-plain-border);
  color: var(--button-primary-plain-text);
}

.view-toolbar :deep(.el-button--primary.is-plain:hover) {
  background: var(--button-primary-plain-hover-bg);
  border-color: var(--button-primary-plain-hover-border);
  color: var(--button-primary-plain-hover-text);
}

.view-toolbar :deep(.el-button--default) {
  background: var(--button-surface-bg);
  border-color: var(--button-surface-border);
  color: var(--button-surface-text);
}

.view-toolbar :deep(.el-button--default:hover) {
  background: var(--button-surface-hover-bg);
  border-color: var(--button-surface-hover-border);
  color: var(--button-surface-hover-text);
}

.view-toolbar :deep(.el-button--primary:not(.is-plain)) {
  background: var(--button-primary-gradient);
  border-color: var(--button-primary-active-border);
  color: var(--button-primary-text);
  box-shadow: var(--button-primary-shadow);
}

.view-toolbar :deep(.el-button--primary:not(.is-plain):hover) {
  background: var(--button-primary-gradient-hover);
  border-color: var(--button-primary-active-border);
  color: var(--button-primary-text);
  box-shadow: var(--button-primary-shadow-hover);
}

.open-iteration-manager {
  margin-left: 0 !important;
}
.view-toolbar :deep(.el-button--default span) {
  white-space: nowrap;
}

.view-toggle {
  flex-shrink: 0;
}

.view-toggle :deep(.el-radio-group) {
  flex-wrap: nowrap;
}

.view-toggle :deep(.el-radio-button__inner) {
  white-space: nowrap;
}

.view-toggle :deep(.el-radio-button) {
  flex-shrink: 0;
}

.view-toggle :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner),
.view-toggle :deep(.el-radio-button__inner) {
  overflow: visible;
}

.view-toggle :deep(.el-radio-button__inner) {
  box-sizing: border-box;
}

.view-toggle :deep(.el-radio-button) + .el-radio-button {
  margin-left: 0;
}

.view-toggle :deep(.el-radio-button:not(:first-child) .el-radio-button__inner) {
  border-left: 1px solid var(--border-color);
}

.view-toggle :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  border-left-color: var(--accent-color);
}

.view-toggle :deep(.el-radio-button:first-child .el-radio-button__inner) {
  border-top-right-radius: var(--radius-sm);
  border-bottom-right-radius: var(--radius-sm);
}

.view-toggle :deep(.el-radio-button:last-child .el-radio-button__inner) {
  border-top-left-radius: var(--radius-sm);
  border-bottom-left-radius: var(--radius-sm);
}

.view-toggle :deep(.el-radio-button:first-child .el-radio-button__inner),
.view-toggle :deep(.el-radio-button:last-child .el-radio-button__inner) {
  border-radius: var(--radius-sm);
}

.view-toggle :deep(.el-radio-button:not(:first-child) .el-radio-button__inner) {
  margin-left: 0;
}

.view-toggle :deep(.el-radio-group) {
  gap: 4px;
}

.view-toggle :deep(.el-radio-button__inner) {
  min-width: 92px;
  justify-content: center;
}

.view-toggle :deep(.el-radio-button__inner:hover) {
  z-index: 1;
}

.view-toggle :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  z-index: 2;
}

.view-toggle :deep(.el-radio-button__inner) {
  position: relative;
}

.view-toggle :deep(.el-radio-button__inner) {
  border: 1px solid var(--border-color);
}

.view-toggle :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  border-color: var(--accent-color);
}

.view-toggle :deep(.el-radio-button__inner) {
  box-shadow: none;
}

.view-toggle :deep(.el-radio-button__inner)::before {
  display: none;
}

.view-toggle :deep(.el-radio-button + .el-radio-button) {
  margin-left: 0;
}

.view-toggle :deep(.el-radio-button) {
  margin-left: 0;
}

.view-toggle :deep(.el-radio-button:first-child .el-radio-button__inner),
.view-toggle :deep(.el-radio-button:last-child .el-radio-button__inner) {
  border-radius: var(--radius-sm);
}

.view-toggle :deep(.el-radio-button:not(:first-child) .el-radio-button__inner) {
  margin-left: 0;
}

.view-toggle :deep(.el-radio-group) {
  gap: 4px;
}

.view-toggle :deep(.el-radio-button__inner) {
  padding-left: 10px;
  padding-right: 10px;
}

.view-toggle :deep(.el-radio-button__inner) {
  background-clip: padding-box;
}

.view-toggle :deep(.el-radio-button__inner) {
  overflow: hidden;
}

.view-toggle :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  overflow: hidden;
}

.view-toggle :deep(.el-radio-button__inner) {
  text-overflow: clip;
}

.view-toggle :deep(.el-radio-button__inner) {
  line-height: 1;
}

.view-toggle :deep(.el-radio-button__inner) {
  min-width: 0;
}

.view-toggle :deep(.el-radio-button) {
  min-width: 0;
}

.view-toggle :deep(.el-radio-group) {
  min-width: 0;
}

.view-toggle :deep(.el-radio-button__inner) {
  min-width: 88px;
}

.list-status-filter {
  flex-shrink: 0;
}

.list-status-filter :deep(.el-checkbox-group) {
  flex-wrap: nowrap;
}

.list-status-filter :deep(.el-checkbox-button) {
  flex-shrink: 0;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  white-space: nowrap;
  min-width: 70px;
  justify-content: center;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  box-sizing: border-box;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  overflow: hidden;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  text-overflow: clip;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  border: 1px solid var(--border-color);
}

.list-status-filter :deep(.el-checkbox-button.is-checked .el-checkbox-button__inner) {
  border-color: var(--accent-color);
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  box-shadow: none;
}

.list-status-filter :deep(.el-checkbox-button:first-child .el-checkbox-button__inner),
.list-status-filter :deep(.el-checkbox-button:last-child .el-checkbox-button__inner) {
  border-radius: var(--radius-sm);
}

.list-status-filter :deep(.el-checkbox-button:not(:first-child) .el-checkbox-button__inner) {
  margin-left: 0;
}

.list-status-filter :deep(.el-checkbox-group) {
  gap: 4px;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  padding-left: 10px;
  padding-right: 10px;
}

.list-status-filter :deep(.el-checkbox-button__inner)::before {
  display: none;
}

.list-status-filter :deep(.el-checkbox-button + .el-checkbox-button) {
  margin-left: 0;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  background-clip: padding-box;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  line-height: 1;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  min-width: 66px;
}

.list-status-filter :deep(.el-checkbox-group) {
  min-width: 0;
}

.list-status-filter :deep(.el-checkbox-button) {
  min-width: 0;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  min-width: 66px;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  border-radius: var(--radius-sm);
}

.list-status-filter :deep(.el-checkbox-button.is-checked .el-checkbox-button__inner) {
  z-index: 1;
}

.list-status-filter :deep(.el-checkbox-button__inner:hover) {
  z-index: 1;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  position: relative;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  overflow: visible;
}

.list-status-filter :deep(.el-checkbox-button.is-checked .el-checkbox-button__inner) {
  overflow: visible;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  overflow: hidden;
}

.list-status-filter :deep(.el-checkbox-button.is-checked .el-checkbox-button__inner) {
  overflow: hidden;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  display: inline-flex;
  align-items: center;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  justify-content: center;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  font-size: 11px;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  font-weight: 600;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  height: 30px;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  min-height: 30px;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  padding-top: 0;
  padding-bottom: 0;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  background: var(--panel-bg);
}

.list-status-filter :deep(.el-checkbox-button.is-checked .el-checkbox-button__inner) {
  background: var(--accent-color);
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  color: var(--text-secondary);
}

.list-status-filter :deep(.el-checkbox-button.is-checked .el-checkbox-button__inner) {
  color: #fff;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  border-color: var(--border-color);
}

.list-status-filter :deep(.el-checkbox-button.is-checked .el-checkbox-button__inner) {
  border-color: var(--accent-color);
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  box-shadow: none;
}

.list-status-filter :deep(.el-checkbox-button.is-checked .el-checkbox-button__inner) {
  box-shadow: none;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  white-space: nowrap;
}

.list-status-filter :deep(.el-checkbox-group) {
  gap: 4px;
}

.list-status-filter :deep(.el-checkbox-button:not(:first-child) .el-checkbox-button__inner) {
  margin-left: 0;
}

.list-status-filter :deep(.el-checkbox-button:first-child .el-checkbox-button__inner),
.list-status-filter :deep(.el-checkbox-button:last-child .el-checkbox-button__inner) {
  border-radius: var(--radius-sm);
}

.list-status-filter :deep(.el-checkbox-button + .el-checkbox-button) {
  margin-left: 0;
}

.list-status-filter :deep(.el-checkbox-button__inner)::before {
  display: none;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  min-width: 66px;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  padding-left: 10px;
  padding-right: 10px;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  overflow: hidden;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  text-overflow: clip;
}

.list-status-filter :deep(.el-checkbox-group) {
  display: flex;
  align-items: center;
}

.list-status-filter :deep(.el-checkbox-button) {
  display: inline-flex;
  align-items: center;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  line-height: 1;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  min-width: 66px;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  border-radius: var(--radius-sm);
}

.list-status-filter :deep(.el-checkbox-group) {
  flex-wrap: nowrap;
}

.list-status-filter :deep(.el-checkbox-button) {
  flex-shrink: 0;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  white-space: nowrap;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  height: 30px;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  min-height: 30px;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  padding-top: 0;
  padding-bottom: 0;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  padding-left: 10px;
  padding-right: 10px;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  box-sizing: border-box;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  box-shadow: none;
}

.list-status-filter :deep(.el-checkbox-button.is-checked .el-checkbox-button__inner) {
  box-shadow: none;
}

.list-status-filter :deep(.el-checkbox-button__inner)::before {
  display: none;
}

.list-status-filter :deep(.el-checkbox-button + .el-checkbox-button) {
  margin-left: 0;
}

.list-status-filter :deep(.el-checkbox-group) {
  gap: 4px;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  min-width: 66px;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  overflow: hidden;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  text-overflow: clip;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  background-clip: padding-box;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  position: relative;
}

.list-status-filter :deep(.el-checkbox-button.is-checked .el-checkbox-button__inner) {
  z-index: 1;
}

.list-status-filter :deep(.el-checkbox-button__inner:hover) {
  z-index: 1;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  border: 1px solid var(--border-color);
}

.list-status-filter :deep(.el-checkbox-button.is-checked .el-checkbox-button__inner) {
  border-color: var(--accent-color);
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  color: var(--text-secondary);
}

.list-status-filter :deep(.el-checkbox-button.is-checked .el-checkbox-button__inner) {
  color: #fff;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  background: var(--panel-bg);
}

.list-status-filter :deep(.el-checkbox-button.is-checked .el-checkbox-button__inner) {
  background: var(--accent-color);
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  font-size: 11px;
}

.list-status-filter :deep(.el-checkbox-button__inner) {
  font-weight: 600;
}

.view-toolbar :deep(.el-select__placeholder),
.view-toolbar :deep(.el-input__inner) {
  font-size: 12px;
}

.view-toolbar :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  box-shadow: none;
}

.view-toolbar :deep(.el-radio-button:first-child .el-radio-button__inner),
.view-toolbar :deep(.el-radio-button:last-child .el-radio-button__inner) {
  border-radius: var(--radius-sm);
}

.view-toolbar :deep(.el-radio-button:not(:first-child) .el-radio-button__inner) {
  margin-left: 0;
}

.view-toggle,
.list-status-filter {
  min-height: 28px;
}

.view-toolbar :deep(.el-radio-group) {
  gap: 4px;
}
.open-iteration-manager {
  margin-left: 0 !important;
}

@media (max-width: 1200px) {
  .view-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .iteration-filter {
    justify-content: space-between;
    flex-wrap: wrap;
  }
}

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
  gap: 6px;
  align-items: center;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--el-border-color-lightest);
}

.sync-preview-controls :deep(.el-button) {
  min-height: var(--button-compact-height);
  padding: var(--button-tight-padding-y) var(--button-tight-padding-x);
  font-size: var(--button-font-size);
  font-weight: var(--button-font-weight);
  border-radius: var(--radius-sm);
  background: var(--button-surface-bg);
  border-color: var(--button-surface-border);
  color: var(--button-surface-text);
  box-shadow: var(--button-neutral-shadow);
}

.sync-preview-controls :deep(.el-button:hover) {
  background: var(--button-surface-hover-bg);
  border-color: var(--button-surface-hover-border);
  color: var(--button-surface-hover-text);
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
  transition: all 0.2s ease;
}

.item-description.expanded {
  -webkit-line-clamp: unset;
  display: block;
  max-height: 300px;
  overflow-y: auto;
  text-overflow: unset;
}

.item-description.expanded::-webkit-scrollbar {
  width: 4px;
}

.item-description.expanded::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 2px;
}

.preview-description-toggle {
  font-size: 11px;
  color: #25C6C9;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0 0 4px 0;
  margin-bottom: 4px;
}

.preview-description-toggle:hover {
  color: #1EA9AC;
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

.iteration-manager-actions {
  display: flex;
  justify-content: flex-end;
  padding: 0 16px 8px;
}

.chat-container {
  background: var(--panel-bg);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  position: relative;
  flex-shrink: 0;
  box-shadow: -8px 0 24px rgba(15, 23, 42, 0.04);
}

.chat-container.collapsed {
  width: 0;
  overflow: visible;
  border-left: none;
  box-shadow: none;
}

.chat-resize-handle {
  width: 6px;
  cursor: col-resize;
  background: transparent;
  flex-shrink: 0;
  position: relative;
  z-index: 10;
  transition: background 0.2s;
}

.chat-resize-handle:hover {
  background: var(--el-color-primary, #409eff);
}

.chat-toggle-btn {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  right: 0;
  width: 28px;
  height: 56px;
  background: #111827;
  border: none;
  border-radius: 10px 0 0 10px;
  cursor: pointer;
  z-index: 100;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-left: 4px;
  box-shadow: -4px 0 14px rgba(15, 23, 42, 0.18);
}

.chat-toggle-btn:hover {
  width: 32px;
  background: #0f172a;
}

.chat-toggle-btn:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

.chat-container:not(.collapsed) .chat-toggle-btn {
  right: 0;
  border-radius: 8px 0 0 8px;
}

.chat-container.collapsed .chat-toggle-btn {
  right: 0;
  border-radius: 0 8px 8px 0;
  padding-left: 0;
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
  padding: 48px 28px;
  text-align: center;
  background: var(--panel-bg);
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
  opacity: 0.78;
}

.logo-devops,
.logo-kanban {
  font-size: 32px;
  font-weight: 800;
  background: linear-gradient(90deg, rgba(37, 198, 201, 0.78) 0%, rgba(37, 198, 201, 0.58) 40%, rgba(234, 180, 69, 0.48) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.logo-devops {
  margin-right: 4px;
}

.logo-kanban {
  margin-left: -2px;
}

.chat-welcome h2 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--text-secondary);
}

.chat-welcome p {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.6;
  max-width: 320px;
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

.step-chat-mode,
.sync-analysis-mode {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--panel-bg);
}

.step-chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--border-color);
  background: var(--panel-bg);
  flex-shrink: 0;
}

.sync-analysis-close {
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s;
}
.sync-analysis-close:hover {
  opacity: 1;
}

.step-chat-header,
.butler-header {
  box-shadow: inset 0 -1px 0 rgba(15, 23, 42, 0.02);
}

.step-header-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.step-header-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #9ca3af;
}

.step-node-detail {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.step-node-name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.step-node-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.step-status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

.step-status-badge.step-done {
  background: #eaf8f1;
  color: #059669;
}

.step-status-badge.step-in_progress {
  background: #fff4e5;
  color: #d97706;
}

.step-status-badge.step-pending {
  background: #eceff3;
  color: #6b7280;
}

.step-status-badge.step-failed,
.step-status-badge.step-rejected {
  background: #fdecec;
  color: #dc2626;
}

.step-status-badge.step-cancelled {
  background: #eceff3;
  color: #6b7280;
}

.step-status-badge.step-suspended {
  background: #fff4e5;
  color: #d97706;
}

.step-node-name {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.step-node-role,
.step-node-duration {
  font-size: 12px;
  color: #6b7280;
}

.step-session-id {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #25C6C9;
  font-weight: 500;
  padding: 2px 6px;
  background: rgba(37, 198, 201, 0.08);
  border-radius: 4px;
  transition: all 0.2s;
}

.step-session-id:hover {
  background: rgba(37, 198, 201, 0.15);
}

.step-agent-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  color: #8B5CF6;
  font-weight: 500;
  padding: 2px 6px;
  background: rgba(139, 92, 246, 0.08);
  border-radius: 4px;
}

.step-agent-badge .agent-icon {
  font-size: 12px;
}

.step-chat-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.task-chat-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  background: var(--panel-bg);
}

.task-placeholder-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  padding: 48px 32px;
  max-width: 360px;
}

.task-placeholder-content svg {
  margin-bottom: 8px;
  color: var(--text-muted);
  opacity: 0.9;
}

.task-placeholder-content h2 {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  color: var(--text-secondary);
}

.task-placeholder-content p {
  margin: 0;
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
  color: var(--text-secondary);
}

.task-placeholder-content strong {
  color: var(--accent-color);
}

.chat-welcome p,
.step-node-role,
.step-node-duration,
.butler-worktree .worktree-label,
.butler-worktree .worktree-badge {
  font-size: var(--font-size-xs);
}

.chat-welcome h2,
.step-node-name {
  font-size: 15px;
}

.butler-info h3 {
  font-size: var(--font-size-md);
}

.step-header-label {
  letter-spacing: 0.06em;
}

.step-status-badge {
  border-radius: 999px;
}

.form-group {
  margin-bottom: 18px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px var(--accent-color-soft);
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
  background: var(--accent-color-soft);
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

.node-subtitle-header {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 20px 12px;
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


.icon-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

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
  background: rgba(37, 198, 201, 0.06);
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
  background: #25C6C9;
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

.empty-column {
  text-align: center;
  padding: 32px 16px;
  color: var(--text-placeholder);
  font-size: 13px;
}

.kanban-column .requirement-card {
  margin-bottom: 12px;
}

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
  border-color: #25C6C9;
  color: #25C6C9;
  background: rgba(37, 198, 201, 0.06);
}

.delete-confirm-content {
  padding: 10px 0;
}

.delete-confirm-content p {
  margin: 0 0 16px 0;
  color: var(--text-primary);
}

.delete-worktree-checkbox {
  color: var(--text-secondary);
}

/* Task Editor Dialog - Modern Refined Style */
.task-editor-dialog :deep(.el-form) {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.task-editor-dialog :deep(.el-form-item) {
  margin-bottom: 20px;
}

.task-editor-dialog :deep(.el-form-item__label) {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.task-title-input :deep(.el-input__wrapper),
.task-description-input :deep(.el-input__wrapper) {
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  padding: 12px 14px;
  transition: all 0.2s ease;
  box-shadow: none;
}

.task-title-input :deep(.el-input__wrapper):hover,
.task-description-input :deep(.el-input__wrapper):hover {
  border-color: var(--border-color-hover);
  background: var(--bg-secondary);
}

.task-title-input :deep(.el-input__wrapper.is-focus),
.task-description-input :deep(.el-input__wrapper.is-focus) {
  border-color: #25C6C9;
  box-shadow: 0 0 0 3px rgba(37, 198, 201, 0.08);
  background: var(--bg-primary);
}

.task-title-input :deep(.el-input__inner) {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.5;
}

.task-description-input :deep(.el-input__inner) {
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-primary);
  resize: vertical;
}

.task-description-input :deep(.el-input__wrapper) {
  padding: 14px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 4px;
}

.task-editor-dialog :deep(.el-select) {
  width: 100%;
}

.task-editor-dialog :deep(.el-select__wrapper) {
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  padding: 10px 12px;
  min-height: 42px;
  transition: all 0.2s ease;
  box-shadow: none;
}

.task-editor-dialog :deep(.el-select__wrapper:hover) {
  border-color: var(--border-color-hover);
  background: var(--bg-secondary);
}

.task-editor-dialog :deep(.el-select__wrapper.is-focus) {
  border-color: #25C6C9;
  box-shadow: 0 0 0 3px rgba(37, 198, 201, 0.08);
}

.task-editor-dialog :deep(.el-select__placeholder) {
  font-size: 13px;
  color: var(--text-secondary);
}

.full-width {
  width: 100%;
}

.form-help {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 6px;
  line-height: 1.5;
}

.task-editor-dialog :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.task-editor-dialog :deep(.el-button) {
  min-height: 36px;
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.task-editor-dialog :deep(.el-button--primary) {
  background: linear-gradient(135deg, #25C6C9 0%, #1EA9AC 100%);
  border: none;
  box-shadow: 0 2px 8px rgba(37, 198, 201, 0.24);
}

.task-editor-dialog :deep(.el-button--primary:hover) {
  background: linear-gradient(135deg, #1EA9AC 0%, #189496 100%);
  box-shadow: 0 4px 12px rgba(37, 198, 201, 0.32);
  transform: translateY(-1px);
}

.task-editor-dialog :deep(.el-button--default) {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.task-editor-dialog :deep(.el-button--default:hover) {
  background: var(--bg-secondary);
  border-color: var(--border-color-hover);
  color: var(--text-primary);
}

.external-link.local-path {
  color: #909399;
  cursor: default;
  font-family: monospace;
  font-size: 12px;
}

.external-link.local-path:hover {
  text-decoration: none;
}
</style>
