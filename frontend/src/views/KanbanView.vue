<template>
  <div class="app-container">
    <!-- Left Sidebar - Task List -->
    <aside class="sidebar">
      <div class="sidebar-header">
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
      </div>

      <!-- Task Filters -->
      <div class="task-filters">
        <button
          v-for="filter in filters"
          :key="filter.value"
          class="filter-btn"
          :class="{ active: activeFilter === filter.value }"
          @click="activeFilter = filter.value"
        >
          {{ filter.label }}
          <span class="filter-count">{{ getTasksByFilter(filter.value).length }}</span>
        </button>
      </div>

      <!-- Task List -->
      <div class="task-list">
        <div
          v-for="task in filteredTasks"
          :key="task.id"
          class="task-item"
          :class="{
            'task-selected': selectedTask?.id === task.id,
            'task-running': isTaskRunning(task.id)
          }"
          @click="selectTask(task)"
          @dblclick="openTaskModal(task)"
        >
          <div class="task-item-content">
            <div class="task-item-main">
              <span class="task-item-status" :class="getStatusClass(task.status)"></span>
              <span class="task-item-title">{{ task.title }}</span>
              <span class="task-item-priority" :class="getPriorityClass(task.priority)">
                {{ getPriorityLabel(task.priority) }}
              </span>
            </div>
            <div class="task-item-meta">
              <button
                class="edit-btn"
                @click.stop="openTaskModal(task)"
                title="Edit Task"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button
                class="delete-btn"
                @click.stop="deleteTask(task.id)"
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
        <div v-if="filteredTasks.length === 0" class="empty-tasks">
          <p>{{ $t('task.noTasks') }}</p>
        </div>
      </div>
    </aside>

    <!-- Main Chat Area -->
    <main class="chat-main">
      <div v-if="!selectedTask" class="chat-welcome">
        <div class="welcome-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
        <h2>Welcome to DevOps Kanban</h2>
        <p>Select a task from the sidebar to start working with AI</p>
      </div>

      <div v-else class="chat-container">
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
    </main>

    <!-- Right Panel - Code Changes -->
    <aside class="changes-panel" :class="{ 'panel-collapsed': isPanelCollapsed }">
      <div class="panel-header">
        <h4>Code Changes</h4>
        <button class="collapse-btn" @click="isPanelCollapsed = !isPanelCollapsed">
          <svg v-if="!isPanelCollapsed" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"></polyline>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9,18 15,12 9,6"></polyline>
          </svg>
        </button>
      </div>
      <div class="panel-content" v-show="!isPanelCollapsed">
        <div v-if="!activeSession" class="panel-empty">
          <p>No active session</p>
        </div>
        <div v-else-if="fileChanges.length === 0" class="panel-empty">
          <p>No file changes yet</p>
        </div>
        <div v-else class="file-changes">
          <div
            v-for="file in fileChanges"
            :key="file.path"
            class="file-change"
            @click="toggleFileDiff(file.path)"
          >
            <div class="file-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14,2 14,8 20,8"></polyline>
              </svg>
              <span class="file-path">{{ file.path }}</span>
              <span class="file-status" :class="file.status">{{ file.status }}</span>
            </div>
            <div v-if="expandedDiffs.has(file.path)" class="file-diff">
              <pre class="diff-content">{{ file.diff }}</pre>
            </div>
          </div>
        </div>
      </div>
    </aside>

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
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="DONE">Done</option>
                <option value="BLOCKED">Blocked</option>
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
import projectApi from '../api/project.js'
import taskApi from '../api/task.js'
import agentApi from '../api/agent.js'
import sessionApi from '../api/session.js'
import AgentSelector from '../components/AgentSelector.vue'
import ChatBox from '../components/ChatBox.vue'

const route = useRoute()
const router = useRouter()

// State
const projects = ref([])
const tasks = ref([])
const selectedProjectId = ref('')
const selectedTask = ref(null)
const selectedAgentId = ref(null)
const showTaskModal = ref(false)
const isEditing = ref(false)
const editingTaskId = ref(null)
const activeSession = ref(null)
const chatBoxRef = ref(null)
const isPanelCollapsed = ref(false)
const expandedDiffs = ref(new Set())
const fileChanges = ref([])
const runningTasks = ref(new Set())

// Agent selector
const showAgentSelector = ref(false)
const pendingTask = ref(null)

// Filter state
const filters = [
  { label: '全部', value: 'all' },
  { label: '待办', value: 'TODO' },
  { label: '进行中', value: 'IN_PROGRESS' },
  { label: '已完成', value: 'DONE' }
]
const activeFilter = ref('all')

const loading = reactive({
  projects: false,
  tasks: false,
  saving: false
})

const taskForm = reactive({
  title: '',
  description: '',
  status: 'TODO',
  priority: 'MEDIUM',
  assignee: ''
})

// Computed
const filteredTasks = computed(() => {
  if (activeFilter.value === 'all') return tasks.value
  return tasks.value.filter(t => t.status === activeFilter.value)
})


// Methods
const getTasksByFilter = (filter) => {
  if (filter === 'all') return tasks.value
  return tasks.value.filter(t => t.status === filter)
}

const getStatusClass = (status) => {
  const classes = {
    TODO: 'status-todo',
    IN_PROGRESS: 'status-progress',
    IN_REVIEW: 'status-review',
    DONE: 'status-done',
    BLOCKED: 'status-blocked'
  }
  return classes[status] || 'status-todo'
}

const getStatusLabel = (status) => {
  const labels = {
    TODO: 'To Do',
    IN_PROGRESS: 'In Progress',
    IN_REVIEW: 'In Review',
    DONE: 'Done',
    BLOCKED: 'Blocked'
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
  loading.projects = true
  try {
    const response = await projectApi.getAll()
    projects.value = response.data || response || []

    if (projects.value.length > 0 && !selectedProjectId.value) {
      const projectIdFromUrl = route.query.projectId
      if (projectIdFromUrl && projects.value.find(p => String(p.id) === String(projectIdFromUrl))) {
        selectedProjectId.value = projectIdFromUrl
      } else {
        selectedProjectId.value = projects.value[0].id
      }
      await fetchTasks()
    }
  } catch (error) {
    console.error('Failed to fetch projects:', error)
  } finally {
    loading.projects = false
  }
}

const fetchTasks = async () => {
  if (!selectedProjectId.value) return

  loading.tasks = true
  try {
    const response = await taskApi.getByProject(selectedProjectId.value)
    tasks.value = response.data || response || []
    await loadActiveSession()
  } catch (error) {
    console.error('Failed to fetch tasks:', error)
    tasks.value = []
  } finally {
    loading.tasks = false
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
      await taskApi.update(editingTaskId.value, taskData)
      const index = tasks.value.findIndex(t => t.id === editingTaskId.value)
      if (index !== -1) {
        tasks.value[index] = { ...tasks.value[index], ...taskData }
      }
    } else {
      const response = await taskApi.create(taskData)
      const newTask = response.data || response
      tasks.value.push(newTask)
    }

    closeTaskModal()
  } catch (error) {
    console.error('Failed to save task:', error)
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
    await taskApi.delete(taskId)
    tasks.value = tasks.value.filter(t => t.id !== taskId)
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
    }
  } catch (error) {
    console.error('Failed to load active session:', error)
  }
}

const isTaskRunning = (taskId) => {
  return runningTasks.value.has(taskId)
}
















const toggleFileDiff = (path) => {
  if (expandedDiffs.value.has(path)) {
    expandedDiffs.value.delete(path)
  } else {
    expandedDiffs.value.add(path)
  }
  expandedDiffs.value = new Set(expandedDiffs.value)
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
  height: 100%;
  background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
  color: var(--text-primary);
  overflow: hidden;
}

/* Sidebar */
.sidebar {
  width: 340px;
  min-width: 340px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 20px rgba(0, 0, 0, 0.1);
}

.sidebar-header {
  display: flex;
  padding: 16px;
  gap: 10px;
  border-bottom: 1px solid var(--border-color);
  background: linear-gradient(180deg, var(--bg-tertiary) 0%, transparent 100%);
}

.project-selector {
  flex: 1;
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

.btn-danger {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
}

.btn-danger:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
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

.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
}

.btn-ghost:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.btn-sm {
  padding: 8px 14px;
  font-size: 12px;
  border-radius: 8px;
}

.btn-icon {
  padding: 10px;
  width: 40px;
  height: 40px;
  justify-content: center;
  border-radius: 10px;
}

/* Task Filters */
.task-filters {
  display: flex;
  padding: 12px 16px 12px 12px;
  gap: 6px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-tertiary);
}

.filter-btn {
  flex: 1;
  padding: 12px 8px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 4px;
}

.filter-btn:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.filter-btn.active {
  background: var(--accent-color);
  color: white;
  box-shadow: 0 2px 8px rgba(92, 92, 255, 0.25);
}

.filter-count {
  background: rgba(255, 255, 255, 0.15);
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

.filter-btn:not(.active) .filter-count {
  background: var(--bg-primary);
}

/* Task List */
.task-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.task-item {
  padding: 14px 16px;
  margin-bottom: 8px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  background: var(--bg-primary);
  position: relative;
  overflow: hidden;
}

.task-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: transparent;
  transition: all 0.2s ease;
}

.task-item:hover {
  transform: translateX(2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border-color: var(--border-color);
}

.task-item:hover::before {
  background: var(--accent-color);
}

.task-item.task-selected {
  background: linear-gradient(135deg, rgba(92, 92, 255, 0.08) 0%, rgba(92, 92, 255, 0.03) 100%);
  border-color: var(--accent-color);
  box-shadow: 0 0 0 1px var(--accent-color);
}

.task-item.task-selected::before {
  background: var(--accent-color);
}

.task-item.task-running {
  border-color: #22c55e;
  animation: pulse-border 2s infinite;
}

.task-item.task-running::before {
  background: #22c55e;
}

@keyframes pulse-border {
  0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.2); }
  50% { box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.1); }
}

.task-item-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-item-main {
  display: flex;
  align-items: center;
  gap: 10px;
}

.task-item-status {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 8px currentColor;
}

.status-todo { background: #6b7280; color: #6b7280; }
.status-progress { background: #3b82f6; color: #3b82f6; }
.status-review { background: #a78bfa; color: #a78bfa; }
.status-done { background: #22c55e; color: #22c55e; }
.status-blocked { background: #ef4444; color: #ef4444; }

.task-item-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.4;
  flex: 1;
}

.task-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 16px;
}

.task-item-priority {
  font-size: 10px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.priority-low { background: rgba(16, 185, 129, 0.12); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); }
.priority-medium { background: rgba(245, 158, 11, 0.12); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2); }
.priority-high { background: rgba(239, 68, 68, 0.12); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
.priority-critical { background: rgba(239, 68, 68, 0.2); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.3); }

.edit-btn {
  background: rgba(92, 92, 255, 0.1);
  border: 1px solid rgba(92, 92, 255, 0.2);
  border-radius: 6px;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--accent-color);
}

.edit-btn:hover {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
  transform: scale(1.05);
}

.delete-btn {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 6px;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #ef4444;
}

.delete-btn:hover {
  background: #ef4444;
  color: white;
  border-color: #ef4444;
  transform: scale(1.05);
}

.run-btn {
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 6px;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #22c55e;
}

.run-btn:hover {
  background: #22c55e;
  color: white;
  border-color: #22c55e;
  transform: scale(1.05);
}

.running-indicator {
  color: #3b82f6;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-tasks {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-muted);
  font-size: 13px;
}

/* Chat Main */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  background: var(--bg-primary);
}

.chat-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
  background: linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
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
  font-size: 28px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
  background: linear-gradient(135deg, var(--text-primary) 0%, var(--accent-color) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.chat-welcome p {
  font-size: 14px;
  color: var(--text-secondary);
}

/* Chat Container */
.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-color);
  background: linear-gradient(180deg, var(--bg-secondary) 0%, transparent 100%);
}

.chat-header-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.chat-task-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.chat-session-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  padding: 4px 10px;
  background: var(--bg-tertiary);
  border-radius: 20px;
  width: fit-content;
}







/* Task Summary */
.task-summary {
  padding: 16px 24px;
  margin: 0 24px;
  background: linear-gradient(135deg, rgba(92, 92, 255, 0.05) 0%, rgba(92, 92, 255, 0.02) 100%);
  border: 1px solid rgba(92, 92, 255, 0.15);
  border-radius: 12px;
}

.task-summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.task-summary-title{
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.task-summary-meta{
  display: flex;
  gap: 8px;
}

.task-summary-status{
  font-size: 11px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 20px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.task-summary-status.status-todo{
  background: rgba(107, 114, 128, 0.15);
  color: #6b7280;
}

.task-summary-status.status-progress{
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.task-summary-status.status-review{
  background: rgba(167, 139, 250, 0.15);
  color: #a78bfa;
}

.task-summary-status.status-done{
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.task-summary-status.status-blocked{
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.task-summary-priority{
  font-size: 11px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 20px;
}

.task-summary-description{
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.task-summary-description .description-label {
  color: var(--text-muted);
  margin-right: 4px;
}









/* Changes Panel */
.changes-panel {
  width: 320px;
  min-width: 320px;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
  box-shadow: -2px 0 20px rgba(0, 0, 0, 0.1);
}

.changes-panel.panel-collapsed {
  width: 48px;
  min-width: 48px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-color);
  background: linear-gradient(180deg, var(--bg-tertiary) 0%, transparent 100%);
}

.panel-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.collapse-btn {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.collapse-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border-color: var(--accent-color);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
}

.panel-empty {
  text-align: center;
  color: var(--text-muted);
  padding: 60px 20px;
  font-size: 13px;
}

.file-changes {
  padding: 12px;
}

.file-change {
  margin-bottom: 8px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.file-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: var(--bg-tertiary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.file-header:hover {
  background: var(--hover-bg);
}

.file-path {
  flex: 1;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-status {
  font-size: 10px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.file-status.added {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.file-status.modified {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.file-status.deleted {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.file-diff {
  background: var(--bg-primary);
  border-radius: 0 0 10px 10px;
}

.diff-content {
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 11px;
  line-height: 1.6;
  color: var(--text-secondary);
  margin: 0;
  padding: 14px;
  overflow-x: auto;
  white-space: pre;
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
@media (max-width: 1024px) {
  .changes-panel {
    position: fixed;
    right: 0;
    top: 0;
    bottom: 0;
    z-index: 99;
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
  }

  .changes-panel.panel-collapsed {
    width: 0;
    min-width: 0;
    overflow: hidden;
  }
}

@media (max-width: 768px) {
  .app-container{
    flex-direction: column;
  }

  .sidebar{
    width: 100%;
    min-width: 100%;
    height: 220px;
    min-height: 220px;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
  }

  .task-list{
    padding: 8px;
  }

  .task-item{
    padding: 12px 14px;
    border-radius: 10px;
  }

  .task-item-title{
    font-size: 12px;
  }

  

  .chat-task-title{
    font-size: 15px;
  }

  

  

  .message{
    max-width: 92%;
  }

  

  .modal{
    max-width: calc(100% - 32px);
    margin: 16px;
    border-radius: 14px;
  }

  .form-row{
    flex-direction: column;
    gap: 0;
  }

  .changes-panel{
    width: 100%;
    min-width: 100%;
  }

  .changes-panel.panel-collapsed{
    height: 48px;
  }

  .welcome-icon svg{
    width: 48px;
    height: 48px;
  }
}
</style>
