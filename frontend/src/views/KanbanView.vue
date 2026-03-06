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
        title="New Task"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
    </header>

    <!-- Main Content: Kanban Board + Chat -->
    <div class="main-content">
      <!-- Kanban Board -->
      <div class="kanban-board">
        <!-- TODO Column -->
        <div class="kanban-column" data-status="TODO">
          <div class="column-header">
            <span class="column-status status-todo"></span>
            <span class="column-title">待处理</span>
            <span class="column-count">{{ todoTasks.length }}</span>
          </div>
          <div class="column-content">
            <draggable
              v-model:list="todoTasks"
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
                  @dblclick="openTaskModal(element)"
                >
                  <div class="task-card-content">
                    <div class="task-card-main">
                      <span class="task-card-title">{{ element.title }}</span>
                      <span class="task-card-priority" :class="getPriorityClass(element.priority)">
                        {{ getPriorityLabel(element.priority) }}
                      </span>
                    </div>
                    <div class="task-card-actions">
                      <button
                        class="edit-btn"
                        @click.stop="openTaskModal(element)"
                        title="Edit Task"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button
                        class="delete-btn"
                        @click.stop="deleteTask(element.id)"
                        title="Delete Task"
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
            <div v-if="todoTasks.length === 0" class="empty-column">
              <p>暂无待处理任务</p>
            </div>
          </div>
        </div>

        <!-- DESIGN Column -->
        <div class="kanban-column" data-status="DESIGN">
          <div class="column-header">
            <span class="column-status status-design"></span>
            <span class="column-title">设计</span>
            <span class="column-count">{{ designTasks.length }}</span>
          </div>
          <div class="column-content">
            <draggable
              v-model:list="designTasks"
              group="tasks"
              :animation="200"
              ghost-class="ghost-card"
              drag-class="drag-card"
              :data-status="'DESIGN'"
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
                  @dblclick="openTaskModal(element)"
                >
                  <div class="task-card-content">
                    <div class="task-card-main">
                      <span class="task-card-title">{{ element.title }}</span>
                      <span class="task-card-priority" :class="getPriorityClass(element.priority)">
                        {{ getPriorityLabel(element.priority) }}
                      </span>
                    </div>
                    <div class="task-card-actions">
                      <button
                        class="edit-btn"
                        @click.stop="openTaskModal(element)"
                        title="Edit Task"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button
                        class="delete-btn"
                        @click.stop="deleteTask(element.id)"
                        title="Delete Task"
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
            <div v-if="designTasks.length === 0" class="empty-column">
              <p>暂无设计任务</p>
            </div>
          </div>
        </div>

        <!-- DEVELOPMENT Column -->
        <div class="kanban-column" data-status="DEVELOPMENT">
          <div class="column-header">
            <span class="column-status status-development"></span>
            <span class="column-title">开发</span>
            <span class="column-count">{{ developmentTasks.length }}</span>
          </div>
          <div class="column-content">
            <draggable
              v-model:list="developmentTasks"
              group="tasks"
              :animation="200"
              ghost-class="ghost-card"
              drag-class="drag-card"
              :data-status="'DEVELOPMENT'"
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
                  @dblclick="openTaskModal(element)"
                >
                  <div class="task-card-content">
                    <div class="task-card-main">
                      <span class="task-card-title">{{ element.title }}</span>
                      <span class="task-card-priority" :class="getPriorityClass(element.priority)">
                        {{ getPriorityLabel(element.priority) }}
                      </span>
                    </div>
                    <div class="task-card-actions">
                      <button
                        class="edit-btn"
                        @click.stop="openTaskModal(element)"
                        title="Edit Task"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button
                        class="delete-btn"
                        @click.stop="deleteTask(element.id)"
                        title="Delete Task"
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
            <div v-if="developmentTasks.length === 0" class="empty-column">
              <p>暂无开发任务</p>
            </div>
          </div>
        </div>

        <!-- TESTING Column -->
        <div class="kanban-column" data-status="TESTING">
          <div class="column-header">
            <span class="column-status status-testing"></span>
            <span class="column-title">测试</span>
            <span class="column-count">{{ testingTasks.length }}</span>
          </div>
          <div class="column-content">
            <draggable
              v-model:list="testingTasks"
              group="tasks"
              :animation="200"
              ghost-class="ghost-card"
              drag-class="drag-card"
              :data-status="'TESTING'"
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
                  @dblclick="openTaskModal(element)"
                >
                  <div class="task-card-content">
                    <div class="task-card-main">
                      <span class="task-card-title">{{ element.title }}</span>
                      <span class="task-card-priority" :class="getPriorityClass(element.priority)">
                        {{ getPriorityLabel(element.priority) }}
                      </span>
                    </div>
                    <div class="task-card-actions">
                      <button
                        class="edit-btn"
                        @click.stop="openTaskModal(element)"
                        title="Edit Task"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button
                        class="delete-btn"
                        @click.stop="deleteTask(element.id)"
                        title="Delete Task"
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
            <div v-if="testingTasks.length === 0" class="empty-column">
              <p>暂无测试任务</p>
            </div>
          </div>
        </div>

        <!-- RELEASE Column -->
        <div class="kanban-column" data-status="RELEASE">
          <div class="column-header">
            <span class="column-status status-release"></span>
            <span class="column-title">发布</span>
            <span class="column-count">{{ releaseTasks.length }}</span>
          </div>
          <div class="column-content">
            <draggable
              v-model:list="releaseTasks"
              group="tasks"
              :animation="200"
              ghost-class="ghost-card"
              drag-class="drag-card"
              :data-status="'RELEASE'"
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
                  @dblclick="openTaskModal(element)"
                >
                  <div class="task-card-content">
                    <div class="task-card-main">
                      <span class="task-card-title">{{ element.title }}</span>
                      <span class="task-card-priority" :class="getPriorityClass(element.priority)">
                        {{ getPriorityLabel(element.priority) }}
                      </span>
                    </div>
                    <div class="task-card-actions">
                      <button
                        class="edit-btn"
                        @click.stop="openTaskModal(element)"
                        title="Edit Task"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button
                        class="delete-btn"
                        @click.stop="deleteTask(element.id)"
                        title="Delete Task"
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
            <div v-if="releaseTasks.length === 0" class="empty-column">
              <p>暂无发布任务</p>
            </div>
          </div>
        </div>

        <!-- DONE Column -->
        <div class="kanban-column" data-status="DONE">
          <div class="column-header">
            <span class="column-status status-done"></span>
            <span class="column-title">已完成</span>
            <span class="column-count">{{ doneTasks.length }}</span>
          </div>
          <div class="column-content">
            <draggable
              v-model:list="doneTasks"
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
                  @dblclick="openTaskModal(element)"
                >
                  <div class="task-card-content">
                    <div class="task-card-main">
                      <span class="task-card-title">{{ element.title }}</span>
                      <span class="task-card-priority" :class="getPriorityClass(element.priority)">
                        {{ getPriorityLabel(element.priority) }}
                      </span>
                    </div>
                    <div class="task-card-actions">
                      <button
                        class="edit-btn"
                        @click.stop="openTaskModal(element)"
                        title="Edit Task"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button
                        class="delete-btn"
                        @click.stop="deleteTask(element.id)"
                        title="Delete Task"
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
            <div v-if="doneTasks.length === 0" class="empty-column">
              <p>暂无已完成任务</p>
            </div>
          </div>
        </div>

        <!-- Empty state when no tasks at all -->
        <div v-if="tasks.length === 0" class="empty-board">
          <p>{{ $t('task.noTasks') }}</p>
        </div>
      </div>

      <!-- Chat Container -->
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

        <div v-if="!selectedTask" class="chat-welcome">
          <div class="welcome-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <h2>Welcome to DevOps Kanban</h2>
          <p>选择一个任务开始与 AI 对话</p>
        </div>

        <div v-else class="chat-content">
          <!-- ChatBox Component -->
          <ChatBox
            ref="chatBoxRef"
            :task="selectedTask"
            :agent-id="selectedAgentId"
            :initial-session="activeSession"
            @session-created="onSessionCreated"
            @session-stopped="onSessionStopped"
            @status-change="onStatusChange"
            @request-agent-select="handleRequestAgentSelect"
          />
        </div>
      </div>
    </div>

    <!-- Task Modal -->
    <div v-if="showTaskModal" class="modal-overlay" @click.self="closeTaskModal">
      <div class="modal">
        <div class="modal-header">
          <h2>{{ isEditing ? 'Edit Task' : 'New Task' }}</h2>
          <button class="modal-close" @click="closeTaskModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Title</label>
            <input
              v-model="taskForm.title"
              type="text"
              placeholder="Task title"
            />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea
              v-model="taskForm.description"
              rows="4"
              placeholder="Task description"
            ></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Status</label>
              <select v-model="taskForm.status">
                <option value="TODO">待处理</option>
                <option value="DESIGN">设计</option>
                <option value="DEVELOPMENT">开发</option>
                <option value="TESTING">测试</option>
                <option value="RELEASE">发布</option>
                <option value="DONE">已完成</option>
              </select>
            </div>
            <div class="form-group">
              <label>Priority</label>
              <select v-model="taskForm.priority">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <div class="modal-actions">
            <button class="btn btn-secondary" @click="closeTaskModal">Cancel</button>
            <button class="btn btn-primary" @click="saveTask">Save</button>
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
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import draggable from 'vuedraggable'
import { useProjectStore } from '../stores/projectStore'
import { useTaskStore } from '../stores/taskStore'
import sessionApi from '../api/session.js'
import AgentSelector from '../components/AgentSelector.vue'
import ChatBox from '../components/ChatBox.vue'

const route = useRoute()
const router = useRouter()

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
const runningTasks = ref(new Set())
const isChatCollapsed = ref(false)

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
  status: 'TODO',
  priority: 'MEDIUM',
  assignee: ''
})

// Computed - get tasks by status from store
const tasks = computed(() => taskStore.tasks)
const projects = computed(() => projectStore.projects)

// Refs for each column - these will be updated when tasks change
const todoTasks = ref(taskStore.tasksByStatus.TODO || [])
const designTasks = ref(taskStore.tasksByStatus.DESIGN || [])
const developmentTasks = ref(taskStore.tasksByStatus.DEVELOPMENT || [])
const testingTasks = ref(taskStore.tasksByStatus.TESTING || [])
const releaseTasks = ref(taskStore.tasksByStatus.RELEASE || [])
const doneTasks = ref(taskStore.tasksByStatus.DONE || [])

// Flag to prevent watch from firing during drag operations
let isDragging = false

// Watch for changes in taskStore and update column refs
watch(
  () => taskStore.tasks,
  () => {
    if (isDragging) return
    todoTasks.value = taskStore.tasksByStatus.TODO || []
    designTasks.value = taskStore.tasksByStatus.DESIGN || []
    developmentTasks.value = taskStore.tasksByStatus.DEVELOPMENT || []
    testingTasks.value = taskStore.tasksByStatus.TESTING || []
    releaseTasks.value = taskStore.tasksByStatus.RELEASE || []
    doneTasks.value = taskStore.tasksByStatus.DONE || []
  },
  { deep: true }
)

const getStatusClass = (status) => {
  const classes = {
    TODO: 'status-todo',
    DESIGN: 'status-design',
    DEVELOPMENT: 'status-development',
    TESTING: 'status-testing',
    RELEASE: 'status-release',
    DONE: 'status-done'
  }
  return classes[status] || 'status-todo'
}

const getStatusLabel = (status) => {
  const labels = {
    TODO: '待处理',
    DESIGN: '设计',
    DEVELOPMENT: '开发',
    TESTING: '测试',
    RELEASE: '发布',
    DONE: '已完成'
  }
  return labels[status] || status
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
  const labels = {
    LOW: '低',
    MEDIUM: '中',
    HIGH: '高',
    CRITICAL: '紧急'
  }
  return labels[priority] || 'M'
}

const fetchProjects = async () => {
  try {
    await projectStore.fetchProjects()

    if (projectStore.projects.length > 0 && !selectedProjectId.value) {
      const projectIdFromUrl = route.query.projectId
      if (projectIdFromUrl && projectStore.projects.find(p => String(p.id) === String(projectIdFromUrl))) {
        selectedProjectId.value = projectIdFromUrl
      } else {
        selectedProjectId.value = projectStore.projects[0].id
      }
      await fetchTasks()
    }
  } catch (error) {
    console.error('Failed to fetch projects:', error)
    ElMessage.error('Failed to load projects')
  }
}

const fetchTasks = async () => {
  if (!selectedProjectId.value) return

  try {
    await taskStore.fetchTasks(selectedProjectId.value)
    await loadActiveSession()
  } catch (error) {
    console.error('Failed to fetch tasks:', error)
    ElMessage.error('Failed to load tasks')
  }
}

const onProjectChange = () => {
  router.replace({ query: { projectId: selectedProjectId.value } })
  fetchTasks()
}

const selectTask = (task) => {
  selectedTask.value = task
  loadActiveSession()
}

const openTaskModal = (task = null) => {
  if (task) {
    isEditing.value = true
    editingTaskId.value = task.id
    taskForm.title = task.title || ''
    taskForm.description = task.description || ''
    taskForm.status = task.status || 'TODO'
    taskForm.priority = task.priority || 'MEDIUM'
    taskForm.assignee = task.assignee || ''
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
  taskForm.status = 'TODO'
  taskForm.priority = 'MEDIUM'
  taskForm.assignee = ''
}

const saveTask = async () => {
  if (!taskForm.title.trim()) return

  loading.saving = true
  try {
    const taskData = {
      ...taskForm,
      projectId: selectedProjectId.value
    }

    if (isEditing.value) {
      await taskStore.updateTask(editingTaskId.value, taskData)
    } else {
      await taskStore.createTask(taskData)
    }

    closeTaskModal()
    ElMessage.success(isEditing.value ? 'Task updated' : 'Task created')
  } catch (error) {
    console.error('Failed to save task:', error)
    ElMessage.error('Failed to save task')
  } finally {
    loading.saving = false
  }
}

const deleteTask = async (taskId) => {
  try {
    await ElMessageBox.confirm(
      'Are you sure you want to delete this task? This action cannot be undone.',
      'Delete Task',
      {
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
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
    ElMessage.success('Task deleted successfully')
  } catch (error) {
    console.error('Failed to delete task:', error)
    ElMessage.error('Failed to delete task')
  } finally {
    loading.saving = false
  }
}

// Drag and drop handler
const onDragEnd = async (evt) => {
  // Get the new status from the target column's data-status attribute
  const newStatus = evt.to?.getAttribute('data-status')

  if (!newStatus) {
    ElMessage.error('无法确定目标列状态')
    return
  }

  // Get taskId from the dragged element
  const taskId = evt.item?.getAttribute('data-id')

  if (!taskId) {
    ElMessage.error('无法获取任务 ID')
    return
  }

  // Find the task
  const task = taskStore.tasks.find(t => String(t.id) === String(taskId))
  if (!task) {
    ElMessage.error('找不到任务')
    return
  }

  // If status hasn't changed, no need to update
  if (task.status === newStatus) {
    return
  }

  // Prevent watch from overwriting the drag changes
  isDragging = true

  // Update task status in store (this will trigger the watch, but it's blocked by isDragging)
  const index = taskStore.tasks.findIndex(t => String(t.id) === String(taskId))
  if (index !== -1) {
    taskStore.tasks[index] = { ...taskStore.tasks[index], status: newStatus }
  }

  // Call API to persist
  try {
    await taskStore.updateTaskStatus(taskId, newStatus)
    ElMessage.success(`任务已移动到 ${getStatusLabel(newStatus)}`)
  } catch (error) {
    // Revert on error
    if (index !== -1) {
      taskStore.tasks[index] = { ...taskStore.tasks[index], status: task.status }
    }
    console.error('Failed to update task status:', error)
    ElMessage.error('更新任务状态失败')
  } finally {
    // Allow watch to sync after a short delay
    setTimeout(() => {
      isDragging = false
    }, 100)
  }
}

// ChatBox event handlers
const onSessionCreated = (session) => {
  activeSession.value = session;
};

const onSessionStopped = () => {
  // Session stopped, refresh if needed
};

const onStatusChange = (status) => {
  if (activeSession.value) {
    activeSession.value.status = status;
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
    const response = await sessionApi.getActiveByTask(selectedTask.value.id)
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

// Lifecycle
onMounted(() => {
  fetchProjects()
})

onUnmounted(() => {

})

</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
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
  background: linear-gradient(135deg, #6366f1 0%, #5c5cff 100%);
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

/* Main Content: Kanban Board + Chat */
.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

/* Kanban Board */
.kanban-board {
  display: flex;
  flex: 1;
  padding: 16px;
  gap: 16px;
  overflow-x: auto;
  min-height: 0;
}

/* Kanban Column */
.kanban-column {
  min-width: 280px;
  width: 280px;
  background: var(--bg-secondary);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  flex-shrink: 0;
}

.column-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  background: linear-gradient(180deg, var(--bg-tertiary) 0%, transparent 100%);
  border-radius: 12px 12px 0 0;
}

.column-status {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 8px currentColor;
}

.status-todo { background: #6b7280; color: #6b7280; }
.status-design { background: #8b5cf6; color: #8b5cf6; }
.status-development { background: #3b82f6; color: #3b82f6; }
.status-testing { background: #f59e0b; color: #f59e0b; }
.status-release { background: #f97316; color: #f97316; }
.status-done { background: #22c55e; color: #22c55e; }

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
}

.column-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  min-height: 0;
}

/* Task Card */
.task-card {
  padding: 14px 16px;
  margin-bottom: 10px;
  border-radius: 10px;
  cursor: grab;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  background: var(--bg-primary);
  position: relative;
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
  background: linear-gradient(135deg, rgba(92, 92, 255, 0.08) 0%, rgba(92, 92, 255, 0.03) 100%);
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
  gap: 8px;
}

.task-card-main {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.task-card-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.4;
  flex: 1;
  word-break: break-word;
}

.task-card-priority {
  font-size: 10px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.priority-low { background: rgba(16, 185, 129, 0.12); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); }
.priority-medium { background: rgba(245, 158, 11, 0.12); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2); }
.priority-high { background: rgba(239, 68, 68, 0.12); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
.priority-critical { background: rgba(239, 68, 68, 0.2); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.3); }

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

/* Chat Container */
.chat-container {
  width: 500px;
  min-width: 400px;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--border-color);
  background: var(--bg-primary);
  flex-shrink: 0;
  transition: width 0.3s ease, min-width 0.3s ease;
  position: relative;
  overflow: hidden;
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

/* Chat toggle button - on the left edge */
.chat-toggle-btn {
  position: absolute;
  left: 0;
  top: 0;
  width: 24px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: var(--bg-tertiary);
  border-right: 1px solid var(--border-color);
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
  background: linear-gradient(135deg, var(--text-primary) 0%, var(--accent-color) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
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
  padding-left: 24px;
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
  background: linear-gradient(180deg, var(--bg-tertiary) 0%, transparent 100%);
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
    min-width: 250px;
    width: 250px;
  }
}

@media (max-width: 900px) {
  .main-content {
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
</style>
