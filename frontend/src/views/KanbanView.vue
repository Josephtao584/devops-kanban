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
      <button
        class="btn btn-primary btn-icon"
        @click="openTaskModal()"
        :disabled="!selectedProjectId"
        :title="$t('task.newTaskButton')"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
    </header>

    <!-- Main Content: Kanban Area + Chat -->
    <div class="main-content-wrapper">
      <!-- Left: Workflow + Kanban Board -->
      <div class="kanban-area">
        <!-- View Mode Toolbar - At the very top -->
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

          <!-- Status Filter for List View -->
          <div v-if="viewMode === 'list'" class="status-filter">
            <span class="filter-label">{{ $t('view.filterByStatus') }}:</span>
            <el-checkbox-group v-model="listStatusFilter" size="small">
              <el-checkbox-button v-for="status in allStatusOptions" :key="status" :value="status">
                {{ $t(`status.${status}`) }}
              </el-checkbox-button>
            </el-checkbox-group>
          </div>
        </div>

        <!-- Workflow Timeline - Show when a task with workflow is selected (Kanban View) -->
        <WorkflowTimeline
          v-if="currentWorkflow && viewMode === 'kanban'"
          :workflow="currentWorkflow"
          :selected-node-id="selectedNodeId"
          :default-collapsed="true"
          @select-node="onNodeSelect"
          @view-details="onNodeViewDetails"
          @start-workflow="onStartWorkflow"
        />

        <!-- Kanban Board -->
        <div v-if="viewMode === 'kanban'" class="kanban-board" ref="kanbanBoardRef">
        <!-- Requirements Column -->
        <div class="kanban-column requirement-column" data-status="REQUIREMENTS">
          <div class="column-header">
            <span class="column-status status-requirement"></span>
            <span class="column-title">{{ $t('requirement.title') }}</span>
            <span class="column-count">{{ requirements.length }}</span>
            <button
              class="toggle-converted-btn"
              :class="{ 'is-hiding': hideConvertedRequirements }"
              @click="hideConvertedRequirements = !hideConvertedRequirements"
              :title="hideConvertedRequirements ? $t('requirement.showConverted') : $t('requirement.hideConverted')"
            >
              <svg v-if="hideConvertedRequirements" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
          </div>
          <div class="column-content">
            <button class="add-requirement-btn" @click="openRequirementModal">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              {{ $t('requirement.addRequirement') }}
            </button>
            <div class="requirement-actions-row">
              <button class="sync-requirements-btn" @click="syncAllRequirements" :disabled="pendingRequirements.length === 0 || syncingAllRequirements">
                <svg v-if="syncingAllRequirements" class="icon-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
                </svg>
                <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                  <path d="M3 3v5h5"></path>
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
                  <path d="M16 16h5v5"></path>
                </svg>
                {{ $t('requirement.syncAllRequirements') }}
              </button>
              <button class="auto-assign-btn" @click="openAutoAssignDialog" :disabled="requirements.length === 0">
                {{ $t('requirement.autoAssign') }}
              </button>
            </div>
            <RequirementCard
              v-for="req in requirements"
              :key="req.id"
              :requirement="req"
              @sync="syncRequirementToTask"
              @delete="deleteRequirement"
            />
            <div v-if="requirements.length === 0" class="empty-column">
              <p>{{ $t('requirement.noRequirements') }}</p>
            </div>
          </div>
        </div>

        <!-- TODO Column -->
        <!-- TODO Column -->
        <div class="kanban-column" data-status="TODO">
          <div class="column-header">
            <span class="column-status status-todo"></span>
            <span class="column-title">{{ $t('status.TODO') }}</span>
            <span class="column-count">{{ localTodoTasks.length }}</span>
          </div>
          <div class="column-content">
            <draggable
              :list="localTodoTasks"
              group="tasks"
              :animation="200"
              ghost-class="ghost-card"
              drag-class="drag-card"
              :data-status="'TODO'"
              @end="onDragEnd"
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
                  @click="selectTask(element)"
                >
                  <div class="task-card-content">
                    <div class="task-card-main">
                      <span class="task-card-title">{{ element.title }}</span>
                      <span class="task-card-priority" :class="getPriorityClass(element.priority)">
                        {{ getPriorityLabel(element.priority) }}
                      </span>
                      <span v-if="isTaskRunning(element.id)" class="task-running-time">
                        {{ formatTaskElapsedTime(element.id) }}
                      </span>
                    </div>
                    <div v-if="element.description" class="task-card-description">
                      {{ element.description }}
                    </div>
                    <div class="task-card-actions">
                      <button
                        class="auto-transition-btn"
                        :class="{ 'active': element.autoTransitionEnabled === true }"
                        @click.stop="toggleAutoTransition(element)"
                        :title="element.autoTransitionEnabled === true ? $t('task.autoTransitionEnabled') : $t('task.autoTransitionDisabled')"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M23 4v6h-6"></path>
                          <path d="M1 20v-6h6"></path>
                          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                        </svg>
                      </button>
                      <button
                        class="edit-btn"
                        @click.stop="openTaskModal(element)"
                        :title="$t('common.edit')"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button
                        class="delete-btn"
                        @click.stop="deleteTask(element.id)"
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
              </template>
            </draggable>
            <div v-if="localTodoTasks.length === 0" class="empty-column">
              <p>{{ $t('task.noTodoTasks') }}</p>
            </div>
          </div>
        </div>

        <!-- IN_PROGRESS Column -->
        <div class="kanban-column" data-status="IN_PROGRESS">
          <div class="column-header">
            <span class="column-status status-in-progress"></span>
            <span class="column-title">{{ $t('status.IN_PROGRESS') }}</span>
            <span class="column-count">{{ localInProgressTasks.length }}</span>
          </div>
          <div class="column-content">
            <draggable
              :list="localInProgressTasks"
              group="tasks"
              :animation="200"
              ghost-class="ghost-card"
              drag-class="drag-card"
              :data-status="'IN_PROGRESS'"
              @end="onDragEnd"
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
                  @click="selectTask(element)"
                >
                  <div class="task-card-content">
                    <div class="task-card-main">
                      <span class="task-card-title">{{ element.title }}</span>
                      <span class="task-card-priority" :class="getPriorityClass(element.priority)">
                        {{ getPriorityLabel(element.priority) }}
                      </span>
                      <span v-if="isTaskRunning(element.id)" class="task-running-time">
                        {{ formatTaskElapsedTime(element.id) }}
                      </span>
                    </div>
                    <div v-if="element.description" class="task-card-description">
                      {{ element.description }}
                    </div>
                    <div class="task-card-actions">
                      <button
                        class="auto-transition-btn"
                        :class="{ 'active': element.autoTransitionEnabled === true }"
                        @click.stop="toggleAutoTransition(element)"
                        :title="element.autoTransitionEnabled === true ? $t('task.autoTransitionEnabled') : $t('task.autoTransitionDisabled')"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M23 4v6h-6"></path>
                          <path d="M1 20v-6h6"></path>
                          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                        </svg>
                      </button>
                      <button
                        class="edit-btn"
                        @click.stop="openTaskModal(element)"
                        :title="$t('common.edit')"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button
                        class="delete-btn"
                        @click.stop="deleteTask(element.id)"
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
              </template>
            </draggable>
            <div v-if="localInProgressTasks.length === 0" class="empty-column">
              <p>{{ $t('task.noTasks') }}</p>
            </div>
          </div>
        </div>

        <!-- DONE Column -->
        <div class="kanban-column" data-status="DONE">
          <div class="column-header">
            <span class="column-status status-done"></span>
            <span class="column-title">{{ $t('status.DONE') }}</span>
            <span class="column-count">{{ localDoneTasks.length }}</span>
          </div>
          <div class="column-content">
            <draggable
              :list="localDoneTasks"
              group="tasks"
              :animation="200"
              ghost-class="ghost-card"
              drag-class="drag-card"
              :data-status="'DONE'"
              @end="onDragEnd"
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
                  @click="selectTask(element)"
                >
                  <div class="task-card-content">
                    <div class="task-card-main">
                      <span class="task-card-title">{{ element.title }}</span>
                      <span class="task-card-priority" :class="getPriorityClass(element.priority)">
                        {{ getPriorityLabel(element.priority) }}
                      </span>
                      <span v-if="isTaskRunning(element.id)" class="task-running-time">
                        {{ formatTaskElapsedTime(element.id) }}
                      </span>
                    </div>
                    <div v-if="element.description" class="task-card-description">
                      {{ element.description }}
                    </div>
                    <div class="task-card-actions">
                      <button
                        class="auto-transition-btn"
                        :class="{ 'active': element.autoTransitionEnabled === true }"
                        @click.stop="toggleAutoTransition(element)"
                        :title="element.autoTransitionEnabled === true ? $t('task.autoTransitionEnabled') : $t('task.autoTransitionDisabled')"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M23 4v6h-6"></path>
                          <path d="M1 20v-6h6"></path>
                          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                        </svg>
                      </button>
                      <button
                        class="edit-btn"
                        @click.stop="openTaskModal(element)"
                        :title="$t('common.edit')"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button
                        class="delete-btn"
                        @click.stop="deleteTask(element.id)"
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
              </template>
            </draggable>
            <div v-if="localDoneTasks.length === 0" class="empty-column">
              <p>{{ $t('task.noDoneTasks') }}</p>
            </div>
          </div>
        </div>

        <!-- BLOCKED Column -->
        <div class="kanban-column" data-status="BLOCKED">
          <div class="column-header">
            <span class="column-status status-blocked"></span>
            <span class="column-title">{{ $t('status.BLOCKED') }}</span>
            <span class="column-count">{{ localBlockedTasks.length }}</span>
          </div>
          <div class="column-content">
            <draggable
              :list="localBlockedTasks"
              group="tasks"
              :animation="200"
              ghost-class="ghost-card"
              drag-class="drag-card"
              :data-status="'BLOCKED'"
              @end="onDragEnd"
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
                  @click="selectTask(element)"
                >
                  <div class="task-card-content">
                    <div class="task-card-main">
                      <span class="task-card-title">{{ element.title }}</span>
                      <span class="task-card-priority" :class="getPriorityClass(element.priority)">
                        {{ getPriorityLabel(element.priority) }}
                      </span>
                      <span v-if="isTaskRunning(element.id)" class="task-running-time">
                        {{ formatTaskElapsedTime(element.id) }}
                      </span>
                    </div>
                    <div v-if="element.description" class="task-card-description">
                      {{ element.description }}
                    </div>
                    <div class="task-card-actions">
                      <button
                        class="auto-transition-btn"
                        :class="{ 'active': element.autoTransitionEnabled === true }"
                        @click.stop="toggleAutoTransition(element)"
                        :title="element.autoTransitionEnabled === true ? $t('task.autoTransitionEnabled') : $t('task.autoTransitionDisabled')"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M23 4v6h-6"></path>
                          <path d="M1 20v-6h6"></path>
                          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                        </svg>
                      </button>
                      <button
                        class="edit-btn"
                        @click.stop="openTaskModal(element)"
                        :title="$t('common.edit')"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button
                        class="delete-btn"
                        @click.stop="deleteTask(element.id)"
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
              </template>
            </draggable>
            <div v-if="localBlockedTasks.length === 0" class="empty-column">
              <p>{{ $t('task.noTasks') }}</p>
            </div>
          </div>
        </div>

      </div>

      <!-- List View -->
      <div v-else class="task-list-view" ref="taskListRef">
        <!-- Requirements Section in List View (Collapsible) -->
        <div class="list-requirements-section" :class="{ collapsed: isListRequirementsCollapsed }">
          <div class="list-section-header" @click="isListRequirementsCollapsed = !isListRequirementsCollapsed">
            <div class="list-section-title">
              <svg class="collapse-icon" :class="{ rotated: isListRequirementsCollapsed }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
              {{ $t('requirement.title') }}
              <span class="section-count">{{ requirements.length }}</span>
            </div>
            <div class="list-section-actions" @click.stop>
              <button class="add-requirement-btn-list" @click="openRequirementModal">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                {{ $t('requirement.addRequirement') }}
              </button>
              <button class="sync-requirements-btn-list" @click="syncAllRequirements" :disabled="pendingRequirements.length === 0 || syncingAllRequirements">
                <svg v-if="syncingAllRequirements" class="icon-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
                </svg>
                <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                  <path d="M3 3v5h5"></path>
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
                  <path d="M16 16h5v5"></path>
                </svg>
                {{ $t('requirement.syncAllRequirements') }}
              </button>
              <button
                class="toggle-converted-btn-list"
                :class="{ 'is-hiding': hideConvertedRequirements }"
                @click="hideConvertedRequirements = !hideConvertedRequirements"
                :title="hideConvertedRequirements ? $t('requirement.showConverted') : $t('requirement.hideConverted')"
              >
                <svg v-if="hideConvertedRequirements" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
          <div class="list-requirements-content" v-show="!isListRequirementsCollapsed">
            <!-- Requirements in List Format -->
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
                  v-if="req.status !== 'CONVERTED'"
                  class="sync-req-btn"
                  @click="syncRequirementToTask(req)"
                  :title="$t('requirement.generateTasks')"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                    <path d="M3 3v5h5"></path>
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
                    <path d="M16 16h5v5"></path>
                  </svg>
                </button>
                <button
                  class="delete-req-btn"
                  @click="deleteRequirement(req.id)"
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
              <span class="section-count">{{ filteredTasksForList.length }}</span>
            </div>
          </div>
          <div class="task-list-container">
            <div v-if="filteredTasksForList.length === 0" class="empty-list">
              <p>{{ $t('view.noTasksFound') }}</p>
            </div>
            <div
              v-for="task in filteredTasksForList"
              :key="task.id"
              class="task-list-item"
              :class="{
                'task-selected': selectedTask?.id === task.id,
                'task-running': isTaskRunning(task.id)
              }"
              @click="selectTask(task)"
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
                <span class="running-time">{{ formatTaskElapsedTime(task.id) }}</span>
              </div>
              <div class="task-list-actions">
                <button
                  class="auto-transition-btn"
                  :class="{ 'active': task.autoTransitionEnabled === true }"
                  @click.stop="toggleAutoTransition(task)"
                  :title="task.autoTransitionEnabled === true ? $t('task.autoTransitionEnabled') : $t('task.autoTransitionDisabled')"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M23 4v6h-6"></path>
                    <path d="M1 20v-6h6"></path>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                  </svg>
                </button>
                <button
                  v-if="getTaskWorkflow(task.id)"
                  class="workflow-btn"
                  @click.stop="showTaskWorkflow(task)"
                  :title="$t('workflow.viewWorkflow')"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                </button>
                <button
                  class="edit-btn"
                  @click.stop="openTaskModal(task)"
                  :title="$t('common.edit')"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
                <button
                  class="delete-btn"
                  @click.stop="deleteTask(task.id)"
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
      </div><!-- End of .task-list-view -->
    </div><!-- End of .kanban-area -->

    <!-- Chat Container (separate on the right) - Task Butler -->
      <div class="chat-container" :class="{ collapsed: isChatCollapsed }">
        <!-- Toggle button -->
        <div class="chat-toggle-btn" @click="isChatCollapsed = !isChatCollapsed" :title="isChatCollapsed ? '展开聊天框' : '收起聊天框'">
          <svg v-if="isChatCollapsed" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>

        <!-- No task selected -->
        <div v-if="!selectedTask" class="chat-welcome">
          <div class="welcome-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <h2>{{ $t('butler.selectTask') }}</h2>
          <p>{{ $t('butler.selectTaskHint') }}</p>
        </div>

        <!-- Task Butler Chat -->
        <div v-else class="chat-content">
          <!-- Butler Header -->
          <div class="butler-header">
            <div class="butler-avatar">🤖</div>
            <div class="butler-info">
              <h3>{{ $t('butler.title') }}</h3>
              <span class="task-name">{{ selectedTask.title }}</span>
            </div>
          </div>
          <!-- TaskButlerChat Component -->
          <TaskButlerChat
            ref="butlerChatRef"
            :task="selectedTask"
            @control-workflow="handleButlerControl"
          />
        </div>
      </div>
    </div><!-- End of .main-content-wrapper -->

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

    <!-- Requirement Form Modal -->
    <RequirementForm
      v-if="showRequirementModal"
      :requirement="editingRequirement"
      :visible="showRequirementModal"
      @submit="handleRequirementSubmit"
      @cancel="closeRequirementModal"
    />

    <!-- Task Generate Dialog -->
    <TaskGenerateDialog
      v-if="generatingRequirement"
      :visible="showGenerateDialog"
      :requirement="generatingRequirement"
      @update:visible="showGenerateDialog = $event"
      @confirm="handleTaskGenerateConfirm"
    />

    <!-- Auto Assign Requirements Dialog -->
    <div v-if="showAutoAssignDialog" class="modal-overlay" @click.self="closeAutoAssignDialog">
      <div class="modal auto-assign-modal">
        <div class="modal-header">
          <h2>{{ $t('requirement.selectRequirementsTitle') }}</h2>
          <button class="modal-close" @click="closeAutoAssignDialog">&times;</button>
        </div>
        <div class="modal-body">
          <p class="dialog-hint">{{ $t('requirement.selectRequirementsHint') }}</p>

          <div class="select-actions">
            <button class="btn btn-link" @click="selectAllRequirements">{{ $t('requirement.selectAll') }}</button>
            <button class="btn btn-link" @click="deselectAllRequirements">{{ $t('requirement.deselectAll') }}</button>
          </div>

          <div class="requirements-list">
            <label
              v-for="req in pendingRequirements"
              :key="req.id"
              class="requirement-item"
              :class="{ 'is-selected': selectedRequirementIds.includes(req.id) }"
            >
              <input
                type="checkbox"
                :value="req.id"
                v-model="selectedRequirementIds"
              />
              <span class="requirement-item-content">
                <span class="requirement-item-header">
                  <span class="requirement-item-title">{{ req.title }}</span>
                  <span class="requirement-item-priority" :class="`priority-${(req.priority || 'MEDIUM').toLowerCase()}`">
                    {{ $t(`priority.${req.priority || 'MEDIUM'}`) }}
                  </span>
                </span>
                <span class="requirement-item-desc">{{ req.description }}</span>
              </span>
            </label>
          </div>

          <p v-if="selectedRequirementIds.length > 0" class="selected-count">
            {{ $t('requirement.selectedCount', { count: selectedRequirementIds.length }) }}
          </p>
        </div>
        <div class="modal-footer">
          <div class="modal-actions">
            <button class="btn btn-secondary" @click="closeAutoAssignDialog">{{ $t('common.cancel') }}</button>
            <button
              class="btn btn-primary"
              @click="confirmAutoAssign"
              :disabled="selectedRequirementIds.length === 0 || assigningRequirements"
            >
              <svg v-if="assigningRequirements" class="icon-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
                <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
              </svg>
              {{ $t('requirement.assignSelected') }}
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
              <span class="node-subtitle"><el-icon><component :is="getNodeRoleIcon(selectedNode.role)" /></el-icon> {{ selectedNode.role }} • {{ selectedNode.agentName }}</span>
            </div>
          </div>
          <button class="modal-close" @click="showNodeDialog = false">&times;</button>
        </div>
        <div class="modal-body">
          <!-- 基本信息卡片 -->
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

          <!-- 打回原因（如果有） -->
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

          <!-- 对话记录 - 可交互的 ChatBox -->
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

          <!-- 子节点信息（如果是父节点） -->
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
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Monitor, VideoPlay, Edit, Cpu,
  OfficeBuilding, User, Setting, Brush, Search, Coin, Document,
  Aim, CircleCheck, View, Lock, Promotion, Box
} from '@element-plus/icons-vue'
import draggable from 'vuedraggable/src/vuedraggable.js'
import { useProjectStore } from '../stores/projectStore'
import { useTaskStore } from '../stores/taskStore'
import { createSession, startSession, stopSession, getActiveSessionByTask, getSessionsByTask } from '../api/session.js'
import AgentSelector from '../components/AgentSelector.vue'
import ChatBox from '../components/ChatBox.vue'
import TaskButlerChat from '../components/TaskButlerChat.vue'
import WorkflowTimeline from '../components/workflow/WorkflowTimeline.vue'
import RequirementCard from '../components/requirement/RequirementCard.vue'
import RequirementForm from '../components/requirement/RequirementForm.vue'
import TaskGenerateDialog from '../components/requirement/TaskGenerateDialog.vue'
import { mockWorkflows, getWorkflowByProject, getWorkflowByTask, addNodeToWorkflow, getOrCreateWorkflowForProject } from '../mock/workflowData'
import {
  mockRequirements,
  getRequirementsByProject,
  createRequirement,
  updateRequirement,
  deleteRequirement as deleteRequirementData,
  convertRequirementToTasks
} from '../mock/requirementData'
import { analyzeRequirementToTasks } from '../mock/requirementAnalysis'
import {
  analyzeTaskCategory,
  getAssignmentRule,
  createNodeForTask,
  findSuitableStage
} from '../mock/workflowAssignment'
import { roleConfig, agentConfig, nodeStatusConfig } from '@/mock/workflowData'

// Icon mapping for agent types
const agentIconMap = {
  Monitor,
  VideoPlay,
  Edit,
  Cpu
}

// Icon mapping for role types
const roleIconMap = {
  OfficeBuilding,
  User,
  Setting,
  Brush,
  Search,
  Coin,
  Document,
  Aim,
  CircleCheck,
  View,
  Lock,
  Promotion,
  Box
}

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const emit = defineEmits(['start-workflow'])

// Use Pinia stores
const projectStore = useProjectStore()
const taskStore = useTaskStore()

// Local state
const selectedProjectId = ref('')
const selectedTask = ref(null)
const selectedAgentId = ref(null)
const showTaskModal = ref(false)
const isEditing = ref(false)
const editingTaskId = ref(null)
const activeSession = ref(null)
const chatBoxRef = ref(null)
const butlerChatRef = ref(null)
const nodeChatBoxRef = ref(null)
const runningTasks = ref(new Set())
const taskStartTimes = ref(new Map()) // Store start time for each running task
const taskElapsedSeconds = ref({}) // Reactive object for elapsed seconds display
let runningTimer = null
const isChatCollapsed = ref(false)
const kanbanBoardRef = ref(null)

// View mode state: 'kanban' | 'list'
const viewMode = ref('list')

// List mode status filter
const allStatusOptions = ['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED']
const listStatusFilter = ref(['TODO', 'IN_PROGRESS'])

// Computed property: filtered tasks for list view
const filteredTasksForList = computed(() => {
  if (listStatusFilter.value.length === 0) return []
  return taskStore.tasks.filter(task => listStatusFilter.value.includes(task.status))
})

// Workflow state
const selectedNodeId = ref(null)
const selectedNode = ref(null)  // Currently selected workflow node
const showNodeDialog = ref(false)  // Node detail dialog visibility
const workflowVersion = ref(0)  // For reactive workflow updates
const currentWorkflow = computed(() => {
  // Depend on workflowVersion to trigger reactivity
  void workflowVersion.value
  // Use selected task's workflow if available
  if (selectedTask.value) {
    return getWorkflowByTask(selectedTask.value.id)
  }
  // Fallback to project workflow
  if (!selectedProjectId.value) return null
  return getWorkflowByProject(selectedProjectId.value)
})

// Node selection handler - highlights the node and shows chat panel
const onNodeSelect = (node) => {
  selectedNodeId.value = node.id
  selectedNode.value = node

  // Check if this is a parent node (from parallel stage)
  const isParentNode = node.isParent || String(node.id).startsWith('parent-')

  // Update chat messages to show selected node's conversation
  if (node.messages && node.messages.length > 0) {
    // Convert node messages to chat format
    let chatMessages = node.messages.map(msg => ({
      id: `msg-${node.id}-${msg.id}`,
      role: msg.from === 'user' ? 'user' : 'assistant',
      content: msg.content,
      timestamp: new Date().toISOString()
    }))

    // For parent nodes, add child node summary info at the end if not already included
    if (isParentNode && node.childNodes && node.childNodes.length > 0) {
      // Check if summary already exists in messages
      const hasSummary = node.messages.some(msg =>
        msg.content.includes('**完成情况**') ||
        msg.content.includes('**进度汇报**') ||
        msg.content.includes('子节点')
      )

      if (!hasSummary) {
        // Add child node summary
        const completedCount = node.childNodes.filter(n => n.status === 'DONE').length
        const inProgressCount = node.childNodes.filter(n => n.status === 'IN_PROGRESS').length
        const childSummary = node.childNodes.map(n => {
          const icon = n.status === 'DONE' ? '✅' : n.status === 'IN_PROGRESS' ? '🔄' : '⏳'
          return `${icon} **${n.name}** (${n.agentName}) - ${n.status === 'DONE' ? '已完成' : n.status === 'IN_PROGRESS' ? '进行中' : '待处理'}`
        }).join('\n')

        chatMessages.push({
          id: `msg-${node.id}-summary`,
          role: 'assistant',
          content: `**📊 子节点完成情况**\n\n${childSummary}\n\n**总进度:** ${completedCount}/${node.childNodes.length} 完成`,
          timestamp: new Date().toISOString()
        })
      }
    }

    // Update chatBox if available
    if (chatBoxRef.value && chatBoxRef.value.setMessages) {
      chatBoxRef.value.setMessages(chatMessages, node)
    }
  } else {
    // No messages - clear chat
    if (chatBoxRef.value && chatBoxRef.value.setMessages) {
      chatBoxRef.value.setMessages([], node)
    }
  }
}

// Handler for viewing node details - opens the detail dialog
const onNodeViewDetails = (node) => {
  console.log('[KanbanView] View node details:', node.id, node.name)
  selectedNodeId.value = node.id
  selectedNode.value = node
  showNodeDialog.value = true  // Open node detail dialog
}

// Handler for butler control commands
const handleButlerControl = ({ action, taskId }) => {
  console.log('[KanbanView] Butler control:', action, taskId)

  switch (action) {
    case 'start':
      if (currentWorkflow.value) {
        onStartWorkflow(currentWorkflow.value)
      }
      break
    case 'pause':
      ElMessage.info(t('butler.workflowPaused'))
      break
    case 'continue':
      ElMessage.info(t('butler.workflowContinued'))
      break
    case 'stop':
      ElMessage.info('工作流已停止')
      break
    case 'retry':
      ElMessage.info('正在重试...')
      break
    default:
      console.log('[KanbanView] Unknown butler action:', action)
  }
}

// Handler for node session creation
const onNodeSessionCreated = (session) => {
  console.log('[KanbanView] Node session created:', session.id)
}

// Handler for starting workflow
const onStartWorkflow = (workflow) => {
  console.log('[KanbanView] Start workflow:', workflow.id, workflow.name)

  // TODO: Implement actual workflow start logic
  // For now, just show a success message
  ElMessage.success('工作流已启动，开始执行任务节点...')

  // Update workflow status - change first node to IN_PROGRESS
  // This is a mock implementation - replace with actual API call
  if (workflow?.stages?.[0]?.nodes?.[0]) {
    workflow.stages[0].nodes[0].status = 'IN_PROGRESS'
    workflow.currentNodeId = workflow.stages[0].nodes[0].id
  }

  // Refresh workflow by incrementing version
  workflowVersion.value++
}

// Auto scroll when chat expands
watch(isChatCollapsed, (collapsed, oldCollapsed) => {
  // Only scroll when expanding (from collapsed to expanded)
  if (!collapsed && oldCollapsed && kanbanBoardRef.value) {
    // Wait for layout to update after chat expands
    setTimeout(() => {
      if (kanbanBoardRef.value) {
        const board = kanbanBoardRef.value
        board.scrollLeft = board.scrollWidth - board.clientWidth
      }
    }, 100)
  }
})

// Helper functions for workflow node display

// Get role icon from roleConfig
const getNodeRoleIcon = (role) => {
  if (!role) return Document
  const iconName = roleConfig[role]?.icon || 'Document'
  return roleIconMap[iconName] || Document
}

// Get agent icon from agentConfig
const getAgentIcon = (agentType) => {
  if (!agentType) return Monitor
  const iconName = agentConfig[agentType]?.icon || 'Monitor'
  return agentIconMap[iconName] || Monitor
}

// Get status text with translation support
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

const isSessionLoading = ref(false)

// Agent selector
const showAgentSelector = ref(false)
const pendingTask = ref(null)

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
  autoAssignWorkflow: true
})

// Requirements state
const hideConvertedRequirements = ref(false)
const isListRequirementsCollapsed = ref(true) // Default collapsed

const allRequirements = computed(() => {
  if (!selectedProjectId.value) return []
  return getRequirementsByProject(selectedProjectId.value)
})

const requirements = computed(() => {
  if (hideConvertedRequirements.value) {
    return allRequirements.value.filter(r => r.status !== 'CONVERTED')
  }
  return allRequirements.value
})

const pendingRequirements = computed(() => {
  return allRequirements.value.filter(r => r.status === 'NEW')
})

const syncingAllRequirements = ref(false)

const showRequirementModal = ref(false)
const editingRequirement = ref(null)

// Task Generate Dialog
const showGenerateDialog = ref(false)
const generatingRequirement = ref(null)

// Requirement methods
const openRequirementModal = (requirement = null) => {
  editingRequirement.value = requirement
  showRequirementModal.value = true
}

const closeRequirementModal = () => {
  showRequirementModal.value = false
  editingRequirement.value = null
}

const handleRequirementSubmit = async (data) => {
  try {
    if (editingRequirement.value) {
      updateRequirement(editingRequirement.value.id, data)
      ElMessage.success(t('requirement.updated'))
    } else {
      createRequirement({
        ...data,
        projectId: selectedProjectId.value
      })
      ElMessage.success(t('requirement.created'))
    }
    closeRequirementModal()
  } catch (error) {
    console.error('Failed to save requirement:', error)
    ElMessage.error(t('requirement.saveFailed'))
  }
}

const syncRequirementToTask = (requirement) => {
  // Open the task generate dialog
  generatingRequirement.value = requirement
  showGenerateDialog.value = true
}

// Internal function to actually generate tasks from requirement
const generateTasksFromRequirement = async (requirement, agentIds = []) => {
  // Analyze requirement and get task templates
  const analysisResult = analyzeRequirementToTasks(requirement)

  // Create tasks from analysis result
  const createdTaskIds = []
  for (const taskTemplate of analysisResult.tasks) {
    const task = await taskStore.createTask({
      ...taskTemplate,
      projectId: selectedProjectId.value,
      requirementId: requirement.id,
      assignedAgentIds: agentIds
    })
    createdTaskIds.push(task.id)

    // Auto-assign to workflow if enabled
    autoAssignTaskToWorkflow(task)
  }

  // Update requirement status
  convertRequirementToTasks(requirement.id, createdTaskIds, analysisResult)

  return analysisResult.taskCount
}

// Handle task generation confirmation from dialog
const handleTaskGenerateConfirm = async ({ requirement, workflow, agentIds }) => {
  try {
    const taskCount = await generateTasksFromRequirement(requirement, agentIds)

    showGenerateDialog.value = false
    generatingRequirement.value = null
    ElMessage.success(t('requirement.syncSuccess', { count: taskCount }))
  } catch (error) {
    console.error('Failed to generate tasks:', error)
    ElMessage.error(t('requirement.syncFailed'))
  }
}

const autoAssignAllRequirements = async () => {
  // Legacy function - now handled by dialog
  openAutoAssignDialog()
}

// Auto Assign Dialog
const showAutoAssignDialog = ref(false)
const selectedRequirementIds = ref([])
const assigningRequirements = ref(false)

const syncAllRequirements = async () => {
  if (pendingRequirements.value.length === 0) {
    ElMessage.info(t('requirement.noPendingRequirements'))
    return
  }

  try {
    await ElMessageBox.confirm(
      t('requirement.syncAllConfirmMessage', { count: pendingRequirements.value.length }),
      t('requirement.syncAllConfirmTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
  } catch {
    return
  }

  syncingAllRequirements.value = true
  let processedCount = 0

  try {
    for (const req of pendingRequirements.value) {
      try {
        await generateTasksFromRequirement(req)
        processedCount++
      } catch (error) {
        console.error('Failed to sync requirement:', req.id, error)
      }
    }

    ElMessage.success(t('requirement.allSynced', { count: processedCount }))
  } finally {
    syncingAllRequirements.value = false
  }
}

const openAutoAssignDialog = () => {
  selectedRequirementIds.value = []
  showAutoAssignDialog.value = true
}

const closeAutoAssignDialog = () => {
  showAutoAssignDialog.value = false
  selectedRequirementIds.value = []
}

const selectAllRequirements = () => {
  selectedRequirementIds.value = pendingRequirements.value.map(r => r.id)
}

const deselectAllRequirements = () => {
  selectedRequirementIds.value = []
}

const confirmAutoAssign = async () => {
  if (selectedRequirementIds.value.length === 0) {
    ElMessage.warning(t('requirement.noRequirementsSelected'))
    return
  }

  assigningRequirements.value = true
  let processedCount = 0

  try {
    for (const reqId of selectedRequirementIds.value) {
      const req = requirements.value.find(r => r.id === reqId)
      if (req) {
        try {
          await generateTasksFromRequirement(req)
          processedCount++
        } catch (error) {
          console.error('Failed to process requirement:', reqId, error)
        }
      }
    }

    ElMessage.success(t('requirement.allSynced', { count: processedCount }))
    closeAutoAssignDialog()
  } finally {
    assigningRequirements.value = false
  }
}

const handleDeleteRequirement = async (requirement) => {
  try {
    await ElMessageBox.confirm(
      t('requirement.deleteConfirmMessage'),
      t('requirement.deleteConfirmTitle'),
      {
        confirmButtonText: t('common.delete'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )

    deleteRequirementData(requirement.id)
    ElMessage.success(t('requirement.deleted'))
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to delete requirement:', error)
      ElMessage.error(t('requirement.deleteFailed'))
    }
  }
}

// Computed - get tasks by status from store
const tasks = computed(() => taskStore.tasks)
const projects = computed(() => projectStore.projects)

// Computed for each column - directly from store
const todoTasks = computed(() => taskStore.tasksByStatus.TODO || [])
const inProgressTasks = computed(() => taskStore.tasksByStatus.IN_PROGRESS || [])
const doneTasks = computed(() => taskStore.tasksByStatus.DONE || [])
const blockedTasks = computed(() => taskStore.tasksByStatus.BLOCKED || [])

// Local reactive arrays for draggable (synced from computed)
const localTodoTasks = ref([])
const localInProgressTasks = ref([])
const localDoneTasks = ref([])
const localBlockedTasks = ref([])

// Watch store changes and sync to local arrays
watch(todoTasks, (newVal) => { localTodoTasks.value = [...newVal] }, { immediate: true })
watch(inProgressTasks, (newVal) => { localInProgressTasks.value = [...newVal] }, { immediate: true })
watch(doneTasks, (newVal) => { localDoneTasks.value = [...newVal] }, { immediate: true })
watch(blockedTasks, (newVal) => { localBlockedTasks.value = [...newVal] }, { immediate: true })

// Helper to update all column refs from store (kept for other uses)
const updateColumnRefs = () => {
  localTodoTasks.value = [...(taskStore.tasksByStatus.TODO || [])]
  localInProgressTasks.value = [...(taskStore.tasksByStatus.IN_PROGRESS || [])]
  localDoneTasks.value = [...(taskStore.tasksByStatus.DONE || [])]
  localBlockedTasks.value = [...(taskStore.tasksByStatus.BLOCKED || [])]
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

const getStatusLabel = (status) => {
  return t(`status.${status}`)
}

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
  return t(`priority.${priority}`)
}

// Requirement status helpers
const getReqStatusClass = (status) => {
  const classes = {
    NEW: 'req-status-new',
    ANALYZING: 'req-status-analyzing',
    CONVERTED: 'req-status-converted',
    ARCHIVED: 'req-status-archived'
  }
  return classes[status] || 'req-status-new'
}

const getReqStatusLabel = (status) => {
  return t(`requirement.statuses.${status}`)
}

const fetchProjects = async () => {
  try {
    await projectStore.fetchProjects()

    if (projectStore.projects.length > 0 && !selectedProjectId.value) {
      // 优先使用路径参数，其次使用查询参数
      const projectIdFromUrl = route.params.projectId || route.query.projectId
      if (projectIdFromUrl && projectStore.projects.find(p => String(p.id) === String(projectIdFromUrl))) {
        selectedProjectId.value = projectIdFromUrl
      } else {
        selectedProjectId.value = projectStore.projects[0].id
      }
      await fetchTasks()
    }
  } catch (error) {
    console.error('Failed to fetch projects:', error)
    ElMessage.error(t('project.loadFailed'))
  }
}

const fetchTasks = async () => {
  if (!selectedProjectId.value) return

  try {
    await taskStore.fetchTasks(selectedProjectId.value)
    updateColumnRefs()
    await loadActiveSession()
  } catch (error) {
    console.error('Failed to fetch tasks:', error)
    ElMessage.error(t('task.loadFailed'))
  }
}

const onProjectChange = () => {
  router.replace({ path: `/kanban/${selectedProjectId.value}` })
  fetchTasks()
}

const selectTask = async (task) => {
  // Don't expand chat panel - only select task to show workflow
  selectedTask.value = task
}

// Show task workflow in a modal dialog (for list view)
const showTaskWorkflow = (task) => {
  selectedTask.value = task
  // Show the workflow timeline in the task detail dialog
  showNodeDialog.value = true
}

// Get workflow for a specific task (for list view button visibility)
const getTaskWorkflow = (taskId) => {
  return getWorkflowByTask(taskId)
}

const openTaskModal = (task = null) => {
  if (task) {
    isEditing.value = true
    editingTaskId.value = task.id
    taskForm.title = task.title || ''
    taskForm.description = task.description || ''
    taskForm.category = task.category || ''
    taskForm.status = task.status || 'TODO'
    taskForm.priority = task.priority || 'MEDIUM'
    taskForm.assignee = task.assignee || ''
    taskForm.autoAssignWorkflow = task.autoAssignWorkflow !== false
  } else {
    isEditing.value = false
    editingTaskId.value = null
    resetTaskForm()
  }
  showTaskModal.value = true
}

const closeTaskModal = () => {
  showTaskModal.value = false
  resetTaskForm()
}

const resetTaskForm = () => {
  taskForm.title = ''
  taskForm.description = ''
  taskForm.category = ''
  taskForm.status = 'TODO'
  taskForm.priority = 'MEDIUM'
  taskForm.assignee = ''
  taskForm.autoAssignWorkflow = true
}

/**
 * Auto-assign task to workflow
 * @param {Object} task - The created task object
 * @returns {Object|null} Created node or null
 */
const autoAssignTaskToWorkflow = (task) => {
  try {
    // Get or create workflow for the project
    const workflow = getOrCreateWorkflowForProject(selectedProjectId.value)
    if (!workflow) {
      console.warn('Failed to get or create workflow for project')
      return null
    }

    // Analyze task category (use provided category or auto-detect)
    const category = task.category || analyzeTaskCategory(task.title, task.description)

    // Get assignment rule
    const rule = getAssignmentRule(category)

    // Find suitable stage
    const stage = findSuitableStage(workflow, rule.preferredStage)
    if (!stage) {
      console.warn('No suitable stage found for task')
      return null
    }

    // Create workflow node
    const node = createNodeForTask(task, category, rule)

    // Add node to workflow stage
    const addedNode = addNodeToWorkflow(workflow.id, node, rule.preferredStage)

    // Trigger workflow reactivity update
    workflowVersion.value++

    console.log(`Auto-assigned task "${task.title}" to workflow stage "${stage.name}" with agent type ${rule.preferredAgentType}`)

    return addedNode
  } catch (error) {
    console.error('Failed to auto-assign task to workflow:', error)
    return null
  }
}

const saveTask = async () => {
  if (!taskForm.title.trim()) return

  loading.saving = true
  try {
    // Auto-detect category if not set
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

    // Auto-assign to workflow if enabled and it's a new task
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

const toggleAutoTransition = async (task) => {
  const newValue = task.autoTransitionEnabled === true ? false : true
  try {
    await taskStore.updateTask(task.id, {
      ...task,
      autoTransitionEnabled: newValue
    })
    ElMessage.success(newValue ? t('task.autoTransitionEnabled') : t('task.autoTransitionDisabled'))
  } catch (e) {
    console.error('Failed to toggle auto transition:', e)
    ElMessage.error(t('messages.updateFailed', { name: t('task.title') }))
  }
}

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
    return // User cancelled
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
  // Get the new status from the target column's data-status attribute
  // evt.to is the draggable container, need to find parent .kanban-column
  const newStatus = evt.to?.closest('.kanban-column')?.getAttribute('data-status')

  if (!newStatus) {
    ElMessage.error(t('task.cannotDetermineStatus'))
    return
  }

  // Get taskId from the dragged element
  const taskId = evt.item?.getAttribute('data-id')

  if (!taskId) {
    ElMessage.error(t('task.cannotGetTaskId'))
    return
  }

  // Find the task
  const task = taskStore.tasks.find(t => String(t.id) === String(taskId))
  if (!task) {
    ElMessage.error(t('task.taskNotFound'))
    return
  }

  // If status hasn't changed, no need to update
  if (task.status === newStatus) {
    return
  }

  // Call API to persist (vuedraggable already updated the local arrays)
  try {
    await taskStore.updateTaskStatus(taskId, newStatus)
    ElMessage.success(t('task.taskMoved', { status: t(`status.${newStatus}`) }))
  } catch (error) {
    // Revert on error - sync local arrays back from store
    updateColumnRefs()
    console.error('Failed to update task status:', error)
    ElMessage.error(t('task.statusUpdateFailed'))
  }
}

// ChatBox event handlers
const onSessionCreated = async (session) => {
  activeSession.value = session;
  // Start timer if session is already running
  if (session.status === 'RUNNING' || session.status === 'IDLE') {
    startTaskTimer(session.taskId)
  }
  // Refresh task to get updated worktreePath
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
};

const onSessionStopped = () => {
  // Session stopped, stop timer for current task
  if (selectedTask.value) {
    stopTaskTimer(selectedTask.value.id)
  }
};

const onSessionDeleted = async () => {
  // Session deleted - refresh task to ensure worktree info is still available
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
};

const onStatusChange = (status) => {
  if (activeSession.value) {
    activeSession.value.status = status;
  }
  // Start/stop timer based on status
  if (selectedTask.value) {
    if (status === 'RUNNING' || status === 'IDLE') {
      startTaskTimer(selectedTask.value.id)
    } else if (status === 'STOPPED' || status === 'ERROR' || status === 'COMPLETED') {
      stopTaskTimer(selectedTask.value.id)
    }
  }
};
const handleAgentSelect = ({ agentId, agent, task }) => {
  // Set selected agent and pending task, ChatBox will handle session creation
  selectedAgentId.value = agentId
  pendingTask.value = task
  showAgentSelector.value = false
}

const handleRequestAgentSelect = (task) => {
  console.log('handleRequestAgentSelect called, task:', task?.id, 'projectId:', selectedProjectId.value)
  // Show agent selector when ChatBox requests it
  pendingTask.value = task
  showAgentSelector.value = true
}

const loadActiveSession = async () => {
  if (!selectedTask.value) return
  try {
    const response = await getActiveSessionByTask(selectedTask.value.id)
    if (response.success && response.data) {
      activeSession.value = response.data
    } else {
      activeSession.value = null  // Ensure invalid sessions are cleared
    }
  } catch (error) {
    console.error('Failed to load active session:', error)
    activeSession.value = null  // Clear on error as well
  }
}

const isTaskRunning = (taskId) => {
  return runningTasks.value.has(taskId)
}

// Start task running timer
const startTaskTimer = (taskId) => {
  runningTasks.value.add(taskId)
  taskStartTimes.value.set(taskId, Date.now())
  taskElapsedSeconds.value[taskId] = 0

  // Start global timer if not running
  if (!runningTimer) {
    runningTimer = setInterval(() => {
      const now = Date.now()
      runningTasks.value.forEach(id => {
        const startTime = taskStartTimes.value.get(id)
        if (startTime) {
          taskElapsedSeconds.value[id] = Math.floor((now - startTime) / 1000)
        }
      })
    }, 1000)
  }
}

// Stop task running timer
const stopTaskTimer = (taskId) => {
  runningTasks.value.delete(taskId)
  taskStartTimes.value.delete(taskId)
  delete taskElapsedSeconds.value[taskId]

  // Stop global timer if no tasks running
  if (runningTasks.value.size === 0 && runningTimer) {
    clearInterval(runningTimer)
    runningTimer = null
  }
}

// Format elapsed time for display
const formatTaskElapsedTime = (taskId) => {
  const seconds = taskElapsedSeconds.value[taskId] || 0
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

// Lifecycle
onMounted(() => {
  fetchProjects()
})

onUnmounted(() => {
  // Clean up timer
  if (runningTimer) {
    clearInterval(runningTimer)
    runningTimer = null
  }
})

</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: var(--bg-primary);
  color: var(--text-primary);
  overflow-y: auto;
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

/* Main Content Wrapper: Kanban Area + Chat */
.main-content-wrapper {
  display: flex;
  flex: 1;
  min-height: 0;
}

/* Kanban Area: Workflow + Board */
.kanban-area {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow-x: auto; /* 允许横向滚动 */
}

/* Override WorkflowTimeline margin to fit in kanban-area */
.kanban-area :deep(.workflow-timeline) {
  margin: 12px;
  margin-bottom: 8px;
  flex-shrink: 0;
  max-width: calc(100% - 24px); /* 与下方看板区域对齐 */
}

/* Kanban Board */
.kanban-board {
  display: flex;
  flex: 1;
  padding: 12px;
  gap: 12px;
  min-height: 0;
  align-content: stretch;
  overflow-x: auto; /* 允许横向滚动 */
  flex-wrap: nowrap; /* 防止换行 */
}

/* Kanban Column */
.kanban-column {
  min-width: 320px;
  width: 320px;
  background: var(--bg-secondary);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  flex-shrink: 0;
  transition: all 0.3s ease;
  overflow: hidden;
  position: relative;
}

/* Subtle top accent for regular task columns */
.kanban-column:not(.requirement-column)::before {
  content: '';
  position: absolute;
  top: 0;
  left: 16px;
  right: 16px;
  height: 2px;
  border-radius: 2px;
  transition: all 0.3s ease;
}

/* Column-specific accent colors */
.kanban-column[data-status="TODO"]::before {
  background: linear-gradient(90deg, transparent, #6b7280, transparent);
}
.kanban-column[data-status="IN_PROGRESS"]::before {
  background: linear-gradient(90deg, transparent, #3b82f6, transparent);
}
.kanban-column[data-status="DONE"]::before {
  background: linear-gradient(90deg, transparent, #22c55e, transparent);
}
.kanban-column[data-status="BLOCKED"]::before {
  background: linear-gradient(90deg, transparent, #ef4444, transparent);
}

/* Hover effect for regular columns */
.kanban-column:not(.requirement-column):hover {
  border-color: var(--border-color-hover);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.column-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  border-radius: 12px 12px 0 0;
  transition: all 0.3s ease;
}

/* Enhanced header backgrounds for each status */
.kanban-column[data-status="TODO"] .column-header {
  background: linear-gradient(135deg, rgba(107, 114, 128, 0.1) 0%, rgba(107, 114, 128, 0.05) 100%);
  border-bottom-color: rgba(107, 114, 128, 0.2);
}
.kanban-column[data-status="IN_PROGRESS"] .column-header {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%);
  border-bottom-color: rgba(59, 130, 246, 0.2);
}
.kanban-column[data-status="DONE"] .column-header {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%);
  border-bottom-color: rgba(34, 197, 94, 0.2);
}
.kanban-column[data-status="BLOCKED"] .column-header {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%);
  border-bottom-color: rgba(239, 68, 68, 0.2);
}

.column-status {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 8px currentColor;
  position: relative;
}

/* Pulsing animation for status indicators */
.column-status::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.3;
  animation: status-pulse 2s ease-in-out infinite;
}

@keyframes status-pulse {
  0%, 100% {
    transform: translate(-50%, -50%) scale(0.8);
    opacity: 0.3;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.2);
    opacity: 0;
  }
}

.status-todo { background: #6b7280; color: #6b7280; }
.status-in-progress { background: #3b82f6; color: #3b82f6; }
.status-done { background: #22c55e; color: #22c55e; }
.status-blocked { background: #ef4444; color: #ef4444; }
.status-requirement { background: #f59e0b; color: #f59e0b; }

/* Requirements Column - Enhanced with layers and visual hierarchy */
.requirement-column {
  background: linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%);
  border-radius: 16px;
  border: 2px solid #fcd34d;
  box-shadow:
    0 4px 6px -1px rgba(245, 158, 11, 0.15),
    0 2px 4px -1px rgba(245, 158, 11, 0.1),
    inset 0 0 0 1px rgba(255, 255, 255, 0.5);
  position: relative;
  overflow: visible;
}

/* Top decorative bar for requirement column */
.requirement-column::before {
  content: '';
  position: absolute;
  top: -2px;
  left: 16px;
  right: 16px;
  height: 4px;
  background: linear-gradient(90deg, #f59e0b, #fbbf24, #f59e0b);
  border-radius: 4px 4px 0 0;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
}

/* Subtle pattern overlay */
.requirement-column::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    radial-gradient(circle at 20% 30%, rgba(245, 158, 11, 0.04) 0%, transparent 50%),
    radial-gradient(circle at 80% 70%, rgba(245, 158, 11, 0.04) 0%, transparent 50%);
  border-radius: 16px;
  pointer-events: none;
}

.requirement-column .column-content {
  position: relative;
  z-index: 1;
}

.requirement-column .column-header {
  flex-wrap: wrap;
  gap: 8px;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(251, 191, 36, 0.1) 100%);
  border-bottom: 2px solid rgba(245, 158, 11, 0.2);
  border-radius: 14px 14px 0 0;
  padding: 16px;
  backdrop-filter: blur(4px);
}

.toggle-converted-btn {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 4px;
  cursor: pointer;
  color: #6b7280;
  margin-left: auto;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toggle-converted-btn:hover {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
  border-color: rgba(245, 158, 11, 0.3);
}

.toggle-converted-btn.is-hiding {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
  border-color: rgba(245, 158, 11, 0.4);
}

.sync-requirements-btn {
  background: #3b82f6;
  color: white;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.sync-requirements-btn:hover:not(:disabled) {
  background: #2563eb;
}

.sync-requirements-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.auto-assign-btn {
  background: #f59e0b;
  color: white;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.auto-assign-btn:hover:not(:disabled) {
  background: #d97706;
}

.auto-assign-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.add-requirement-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 10px;
  margin-bottom: 10px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px dashed #f59e0b;
  border-radius: 8px;
  color: #92400e;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.add-requirement-btn:hover {
  background: rgba(245, 158, 11, 0.2);
  border-style: solid;
}

.requirement-actions-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.requirement-actions-row .sync-requirements-btn,
.requirement-actions-row .auto-assign-btn {
  flex: 1;
  justify-content: center;
}

.empty-column {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100px;
  color: var(--text-muted);
  font-size: 13px;
}

.column-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}

.column-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--bg-primary);
  padding: 4px 10px;
  border-radius: 12px;
  transition: all 0.3s ease;
  box-shadow: inset 0 -1px 2px rgba(0, 0, 0, 0.05);
}

/* Status-specific count badge colors */
.kanban-column[data-status="TODO"] .column-count {
  background: linear-gradient(135deg, #9ca3af 0%, #6b7280 100%);
  color: white;
}
.kanban-column[data-status="IN_PROGRESS"] .column-count {
  background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
  color: white;
}
.kanban-column[data-status="DONE"] .column-count {
  background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
  color: white;
}
.kanban-column[data-status="BLOCKED"] .column-count {
  background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
  color: white;
}
.requirement-column .column-count {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: white;
}

.column-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  min-height: 200px; /* 确保空列也能接收拖拽 */
}

/* 让 draggable 组件填满列区域，确保整个区域都能接收拖拽 */
.column-content > div:first-child {
  min-height: 180px;
  padding-bottom: 60px; /* 底部留足空间，支持从下往上拖入 */
}

/* Task Card */
.task-card {
  padding: 16px 18px;
  margin-bottom: 14px;
  border-radius: 10px;
  cursor: grab;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  background: var(--bg-primary);
  position: relative;
}

/* Enhanced task cards in requirement column */
.requirement-column .task-card {
  background: linear-gradient(135deg, #ffffff 0%, #fffbeb 100%);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-left: 3px solid #f59e0b;
  box-shadow: 0 2px 4px rgba(245, 158, 11, 0.1);
}

.requirement-column .task-card:hover {
  border-color: rgba(245, 158, 11, 0.4);
  box-shadow: 0 4px 8px rgba(245, 158, 11, 0.2);
}

/* Task card status-specific left border accent */
.kanban-column[data-status="TODO"] .task-card {
  border-left: 3px solid #6b7280;
}
.kanban-column[data-status="IN_PROGRESS"] .task-card {
  border-left: 3px solid #3b82f6;
}
.kanban-column[data-status="DONE"] .task-card {
  border-left: 3px solid #22c55e;
}
.kanban-column[data-status="BLOCKED"] .task-card {
  border-left: 3px solid #ef4444;
}

.task-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: var(--border-color);
}

.task-card:active {
  cursor: grabbing;
}

.task-card.task-selected {
  background: rgba(99, 102, 241, 0.08);
  border-color: var(--accent-color);
  box-shadow: 0 0 0 1px var(--accent-color);
}

.task-card.task-running {
  border-color: #22c55e;
  animation: pulse-border 2s infinite;
}

@keyframes pulse-border {
  0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.2); }
  50% { box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.1); }
}

.task-card-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.task-card-main {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.task-card-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.4;
  flex: 1;
  word-break: break-word;
  text-rendering: optimizeLegibility;
}

.task-card-priority {
  font-size: 11px;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.priority-low { background: rgba(16, 185, 129, 0.12); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); }
.priority-medium { background: rgba(245, 158, 11, 0.12); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2); }
.priority-high { background: rgba(239, 68, 68, 0.12); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
.priority-critical { background: rgba(239, 68, 68, 0.2); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.3); }

/* Task Card Description */
.task-card-description {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.auto-transition-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  color: var(--el-text-color-placeholder);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.auto-transition-btn:hover {
  background: rgba(64, 158, 255, 0.1);
  color: var(--el-color-primary);
}

.auto-transition-btn.active {
  color: var(--el-color-primary);
}

.task-running-time {
  font-size: 11px;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: 6px;
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.3);
  flex-shrink: 0;
  animation: pulse-green 2s infinite;
}

@keyframes pulse-green {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.task-card-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.edit-btn,
.delete-btn {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: 0.6;
}

.edit-btn {
  color: var(--accent-color);
}

.edit-btn:hover {
  background: rgba(92, 92, 255, 0.1);
  border-color: rgba(92, 92, 255, 0.2);
  opacity: 1;
}

.workflow-btn {
  color: #8b5cf6;
}

.workflow-btn:hover {
  background: rgba(139, 92, 246, 0.1);
  border-color: rgba(139, 92, 246, 0.2);
  opacity: 1;
}

.delete-btn {
  color: #ef4444;
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.2);
  opacity: 1;
}

/* Drag and drop styles */
.ghost-card {
  opacity: 0.5;
  background: var(--accent-color) !important;
  border: 2px dashed var(--accent-color) !important;
}

.drag-card {
  transform: rotate(3deg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2) !important;
}

.empty-column {
  text-align: center;
  padding: 40px 16px;
  color: var(--text-muted);
  font-size: 13px;
}

.empty-board {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: var(--text-muted);
  font-size: 14px;
}

/* Chat Container - Separate on the far right */
.chat-container {
  width: 450px;
  min-width: 350px;
  max-width: 550px;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--border-color);
  background: var(--bg-primary);
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
  transition: width 0.3s ease, min-width 0.3s ease, max-width 0.3s ease;
}

.chat-container.collapsed {
  width: 24px;
  min-width: 24px;
  max-width: 24px;
}

.chat-container.collapsed .chat-welcome,
.chat-container.collapsed .chat-content {
  display: none;
}

/* Chat toggle button - on the right edge */
.chat-toggle-btn {
  position: absolute;
  right: 0;
  top: 0;
  width: 24px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: var(--bg-tertiary);
  border-left: 1px solid var(--border-color);
  z-index: 10;
  transition: background-color 0.2s ease;
}

.chat-toggle-btn:hover {
  background: var(--bg-secondary);
}

.chat-toggle-btn svg {
  color: var(--text-muted);
  transition: color 0.2s ease;
}

.chat-toggle-btn:hover svg {
  color: var(--text-primary);
}

.chat-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: var(--text-muted);
  padding: 24px;
}

.welcome-icon {
  color: var(--accent-color);
  margin-bottom: 24px;
  opacity: 0.6;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.chat-welcome h2 {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
  text-align: center;
}

.chat-welcome p {
  font-size: 14px;
  color: var(--text-secondary);
  text-align: center;
}

.chat-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  padding-right: 24px;
}

/* Butler Header */
.butler-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.08));
  border-bottom: 1px solid var(--border-color);
}

.butler-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(99, 102, 241, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.butler-info {
  flex: 1;
}

.butler-info h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.butler-info .task-name {
  font-size: 12px;
  color: var(--text-secondary);
  display: block;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Node Chat Card in Dialog */
.chat-card {
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.node-chat-container {
  height: 300px;
  min-height: 200px;
  max-height: 400px;
  overflow: hidden;
  border-radius: 8px;
  background: var(--bg-primary);
}

/* Node Info Header */
.node-info-header {
  padding: 16px;
  background: var(--bg-secondary, #f9fafb);
  border-radius: 8px;
  margin-bottom: 12px;
}

.node-info-header h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: var(--text-primary, #1f2937);
}

.node-meta {
  display: flex;
  gap: 12px;
  align-items: center;
}

.node-role {
  font-size: 13px;
  color: var(--text-secondary, #6b7280);
  background: var(--bg-tertiary, #e5e7eb);
  padding: 4px 8px;
  border-radius: 4px;
}

.node-status {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 4px;
}

.node-status.status-done {
  background: #d1fae5;
  color: #10b981;
}

.node-status.status-in_progress {
  background: #dbeafe;
  color: #3b82f6;
}

.node-status.status-pending {
  background: #f3f4f6;
  color: #6b7280;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal {
  background: var(--bg-secondary);
  border-radius: 16px;
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 24px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-tertiary);
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-close {
  background: transparent;
  border: none;
  font-size: 20px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px 8px;
  line-height: 1;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.modal-close:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 18px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 12px 14px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
  transition: all 0.2s ease;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px rgba(92, 92, 255, 0.1);
}

.form-group textarea {
  resize: vertical;
  min-height: 100px;
}

.form-row {
  display: flex;
  gap: 16px;
}

.form-row .form-group {
  flex: 1;
}

.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 24px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-tertiary);
}

.modal-actions {
  display: flex;
  gap: 10px;
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background-color: var(--bg-tertiary);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #4a4a4a;
}

/* Mobile responsive styles */
@media (max-width: 1200px) {
  .chat-container {
    width: 400px;
    min-width: 350px;
  }

  .chat-container.collapsed {
    width: 24px;
    min-width: 24px;
  }

  .kanban-column {
    min-width: 200px;
    width: 200px;
  }
}

@media (max-width: 900px) {
  .kanban-layout {
    flex-direction: column;
  }

  .kanban-board {
    min-height: 400px;
    overflow-x: auto;
    overflow-y: auto;
    flex-wrap: nowrap;
  }

  .chat-container {
    width: 100%;
    min-width: 100%;
    max-width: 100%;
    height: 300px;
    min-height: 200px;
    border-left: none;
    border-top: 1px solid var(--border-color);
  }

  .chat-container.collapsed {
    width: 100%;
    min-width: 100%;
    height: 32px;
    min-height: 32px;
  }

  .chat-toggle-btn {
    width: 100%;
    height: 32px;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
  }
}

@media (max-width: 600px) {
  .kanban-column {
    min-width: 220px;
    width: 220px;
  }

  .modal {
    max-width: calc(100% - 32px);
    margin: 16px;
    border-radius: 14px;
  }

  .form-row {
    flex-direction: column;
    gap: 0;
  }

  .welcome-icon svg {
    width: 48px;
    height: 48px;
  }
}

/* Auto Assign Dialog styles */
.auto-assign-modal {
  width: 560px;
  max-width: 90vw;
}

.auto-assign-modal .modal-body {
  max-height: 60vh;
  overflow-y: auto;
}

.dialog-hint {
  color: var(--text-secondary, #6b7280);
  font-size: 14px;
  margin-bottom: 16px;
  line-height: 1.5;
}

.select-actions {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.select-actions .btn-link {
  background: none;
  border: none;
  color: var(--accent-color, #3b82f6);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.select-actions .btn-link:hover {
  background-color: var(--hover-bg, #eff6ff);
}

.requirements-list {
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  background: var(--bg-secondary, #fff);
}

.requirement-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.requirement-item:last-child {
  border-bottom: none;
}

.requirement-item:hover {
  background-color: var(--hover-bg, #fef3c7);
}

.requirement-item.is-selected {
  background-color: var(--selected-bg, #fef9c7);
}

.requirement-item input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  margin-top: 2px;
  flex-shrink: 0;
}

.requirement-item-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.requirement-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.requirement-item-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #1f2937);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.requirement-item-desc {
  font-size: 13px;
  color: var(--text-secondary, #6b7280);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.requirement-item-priority {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 500;
  flex-shrink: 0;
}

.requirement-item-priority.priority-high,
.requirement-item-priority.priority-critical {
  background-color: #fef2f2;
  color: #dc2626;
}

.requirement-item-priority.priority-medium {
  background-color: #fef3c7;
  color: #d97706;
}

.requirement-item-priority.priority-low {
  background-color: #f3f4f6;
  color: #6b7280;
}

.selected-count {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--accent-color, #3b82f6);
  margin-top: 16px;
  padding: 8px 12px;
  background: var(--accent-light, #eff6ff);
  border-radius: 6px;
}

.icon-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* ========== Workflow Node Detail Modal ========== */
.node-detail-modal {
  max-width: 640px;
  width: 90%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.15);
}

.node-detail-modal .modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
  border-radius: 12px 12px 0 0;
}

.node-detail-modal .header-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.node-detail-modal .header-icon {
  font-size: 24px;
  line-height: 1;
}

.node-detail-modal .modal-header h2 {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
}

.node-detail-modal .node-subtitle {
  font-size: 13px;
  color: #64748b;
  background: #e2e8f0;
  padding: 3px 8px;
  border-radius: 4px;
}

.node-detail-modal .modal-close {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  font-size: 24px;
  color: #64748b;
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.node-detail-modal .modal-close:hover {
  background: #e2e8f0;
  color: #1e293b;
}

.node-detail-modal .modal-body {
  padding: 20px 24px;
  overflow-y: auto;
  max-height: calc(85vh - 140px);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Info Card */
.node-detail-modal .info-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px;
}

.node-detail-modal .info-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 14px 0;
  font-size: 14px;
  font-weight: 600;
  color: #334155;
}

.node-detail-modal .info-card-title svg {
  color: #6366f1;
}

/* Info Grid */
.node-detail-modal .info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
}

.node-detail-modal .info-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.node-detail-modal .info-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
}

.node-detail-modal .info-label svg {
  color: #94a3b8;
}

.node-detail-modal .info-value {
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
}

/* Status Badge */
.node-detail-modal .status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
}

.node-detail-modal .status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.node-detail-modal .status-badge.status-done {
  background: #dcfce7;
  color: #16a34a;
}

.node-detail-modal .status-badge.status-in_progress {
  background: #dbeafe;
  color: #2563eb;
}

.node-detail-modal .status-badge.status-pending {
  background: #f1f5f9;
  color: #64748b;
}

.node-detail-modal .status-badge.status-rejected {
  background: #fef3c7;
  color: #d97706;
}

.node-detail-modal .status-badge.status-failed {
  background: #fee2e2;
  color: #dc2626;
}

/* Rejected Reason Card */
.node-detail-modal .rejected-reason-card {
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.node-detail-modal .rejected-title {
  color: #dc2626;
  font-weight: 600;
}

.node-detail-modal .rejected-reason-text {
  color: #991b1b;
  font-size: 14px;
  line-height: 1.6;
  padding: 8px 0;
}

/* Agent Badge */
.node-detail-modal .agent-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background: #e0e7ff;
  color: #4338ca;
  border-radius: 6px;
  font-weight: 600;
  font-size: 13px;
}

.node-detail-modal .agent-icon {
  font-size: 14px;
}

/* Duration Value */
.node-detail-modal .duration-value {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  background: #fef3c7;
  color: #d97706;
  border-radius: 6px;
  font-weight: 600;
  font-size: 13px;
}

/* Messages Card */
.node-detail-modal .messages-card {
  max-height: 320px;
  display: flex;
  flex-direction: column;
}

.node-detail-modal .message-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.node-detail-modal .message-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
}

.node-detail-modal .message-item.message-from-user {
  background: #eff6ff;
  border-color: #bfdbfe;
}

.node-detail-modal .message-item.message-from-agent {
  background: #fef2f2;
  border-color: #fecaca;
}

.node-detail-modal .message-avatar {
  font-size: 20px;
  flex-shrink: 0;
}

.node-detail-modal .message-content-wrapper {
  flex: 1;
  min-width: 0;
}

.node-detail-modal .message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.node-detail-modal .message-sender {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.node-detail-modal .message-time {
  font-size: 11px;
  color: #94a3b8;
}

.node-detail-modal .message-content {
  font-size: 13px;
  color: #475569;
  line-height: 1.6;
  word-wrap: break-word;
  white-space: pre-wrap;
}

/* Child Nodes List */
.node-detail-modal .child-nodes-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.node-detail-modal .child-node-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  transition: all 0.2s ease;
}

.node-detail-modal .child-node-item:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.node-detail-modal .child-node-item.status-rejected {
  background: #fffbeb;
  border-color: #fcd34d;
}

.node-detail-modal .child-node-item.status-failed {
  background: #fef2f2;
  border-color: #fca5a5;
}

.node-detail-modal .child-status-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.node-detail-modal .child-node-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.node-detail-modal .child-node-name {
  font-size: 13px;
  font-weight: 500;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-detail-modal .child-node-agent {
  font-size: 11px;
  color: #64748b;
}

.node-detail-modal .child-node-status {
  font-size: 11px;
  padding: 3px 8px;
  flex-shrink: 0;
}

.node-detail-modal .child-node-status.status-done {
  background: #dcfce7;
  color: #16a34a;
}

.node-detail-modal .child-node-status.status-in_progress {
  background: #dbeafe;
  color: #2563eb;
}

.node-detail-modal .child-node-status.status-pending {
  background: #f1f5f9;
  color: #64748b;
}

.node-detail-modal .child-node-status.status-rejected {
  background: #fef3c7;
  color: #d97706;
}

.node-detail-modal .child-node-status.status-failed {
  background: #fee2e2;
  color: #dc2626;
}

.node-detail-modal .modal-footer {
  display: flex;
  justify-content: flex-end;
  padding: 16px 24px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 0 0 12px 12px;
}

.node-detail-modal .btn-close {
  min-width: 100px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.node-detail-modal .btn-close:hover {
  background: #4f46e5;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);
  transform: translateY(-1px);
}

/* View Mode Toolbar */
.view-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  gap: 16px;
  flex-wrap: wrap;
}

.view-toggle {
  display: flex;
  align-items: center;
}

.view-btn-content {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-filter {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

/* List View */
.task-list-view {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.task-list-container {
  flex: 1;
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.task-list-item {
  display: flex;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.2s ease;
  gap: 16px;
}

.task-list-item:last-child {
  border-bottom: none;
}

.task-list-item:hover {
  background: var(--hover-bg);
}

.task-list-item.task-selected {
  background: rgba(99, 102, 241, 0.08);
  border-left: 3px solid var(--accent-color);
  padding-left: 15px;
}

.task-list-item.task-running {
  background: rgba(34, 197, 94, 0.05);
}

.task-list-status {
  flex-shrink: 0;
}

.status-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 5px 10px;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-badge.status-todo {
  background: rgba(107, 114, 128, 0.12);
  color: #6b7280;
  border: 1px solid rgba(107, 114, 128, 0.2);
}

.status-badge.status-in-progress {
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.status-badge.status-done {
  background: rgba(34, 197, 94, 0.12);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.status-badge.status-blocked {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.task-list-priority {
  flex-shrink: 0;
}

.priority-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.priority-badge.priority-low {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.priority-badge.priority-medium {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.priority-badge.priority-high {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.priority-badge.priority-critical {
  background: rgba(239, 68, 68, 0.2);
  color: #dc2626;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.task-list-content {
  flex: 1;
  min-width: 0;
}

.task-list-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-list-description {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 4px;
}

.task-list-running {
  flex-shrink: 0;
}

.task-list-running .running-time {
  font-size: 11px;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: 6px;
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.3);
  animation: pulse-green 2s infinite;
}

.task-list-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.empty-list {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: var(--text-muted);
  font-size: 14px;
  padding: 40px;
}

/* List View Requirements Section */
.list-requirements-section {
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  margin-bottom: 12px;
  overflow: hidden;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.list-requirements-section.collapsed .list-section-header {
  border-bottom: none;
}

.list-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  user-select: none;
  transition: background 0.2s ease;
}

.list-section-header:hover {
  background: var(--hover-bg);
}

.list-section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.collapse-icon {
  transition: transform 0.3s ease;
  color: #6b7280;
}

.collapse-icon.rotated {
  transform: rotate(-90deg);
}

.section-icon {
  font-size: 16px;
}

.section-count {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 12px;
}

.list-section-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.add-requirement-btn-list {
  background: #f59e0b;
  color: white;
  border: none;
  font-size: 11px;
  padding: 5px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.add-requirement-btn-list:hover {
  background: #d97706;
}

.sync-requirements-btn-list {
  background: #3b82f6;
  color: white;
  font-size: 11px;
  padding: 5px 10px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.sync-requirements-btn-list:hover:not(:disabled) {
  background: #2563eb;
}

.sync-requirements-btn-list:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle-converted-btn-list {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 5px 8px;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toggle-converted-btn-list:hover {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
  border-color: rgba(245, 158, 11, 0.3);
}

.toggle-converted-btn-list.is-hiding {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
  border-color: rgba(245, 158, 11, 0.4);
}

.list-requirements-content {
  display: flex;
  flex-direction: column;
  max-height: 250px;
  overflow-y: auto;
}

/* Requirement List Item */
.requirement-list-item {
  display: flex;
  align-items: center;
  padding: 12px 18px;
  border-bottom: 1px solid var(--border-color);
  transition: all 0.2s ease;
  gap: 12px;
  background: var(--bg-primary);
}

.requirement-list-item:last-child {
  border-bottom: none;
}

.requirement-list-item:hover {
  background: var(--hover-bg);
}

.requirement-list-item.is-converted {
  opacity: 0.7;
  background: rgba(34, 197, 94, 0.03);
}

.requirement-list-status {
  flex-shrink: 0;
}

.req-status-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.req-status-badge.req-status-new {
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.req-status-badge.req-status-analyzing {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.req-status-badge.req-status-converted {
  background: rgba(34, 197, 94, 0.12);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.req-status-badge.req-status-archived {
  background: rgba(107, 114, 128, 0.12);
  color: #6b7280;
  border: 1px solid rgba(107, 114, 128, 0.2);
}

.requirement-list-priority {
  flex-shrink: 0;
}

.requirement-list-content {
  flex: 1;
  min-width: 0;
}

.requirement-list-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.requirement-list-desc {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
}

.requirement-list-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.sync-req-btn,
.delete-req-btn {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: 0.6;
}

.sync-req-btn {
  color: #3b82f6;
}

.sync-req-btn:hover {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.2);
  opacity: 1;
}

.delete-req-btn {
  color: #ef4444;
}

.delete-req-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.2);
  opacity: 1;
}

.empty-requirements-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: var(--text-muted);
  font-size: 13px;
  background: var(--bg-primary);
}

.empty-requirements-list svg {
  width: 28px;
  height: 28px;
  color: #d1d5db;
  margin-bottom: 6px;
}

.list-tasks-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
</style>

