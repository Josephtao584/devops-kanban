<template>
  <div class="kanban-view">
    <!-- Header with project selector and add task button -->
    <div class="kanban-header">
      <div class="project-selector">
        <label for="project-select">{{ $t('project.projectName') }}:</label>
        <select
          id="project-select"
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
        class="btn btn-primary add-task-btn"
        @click="openTaskModal()"
        :disabled="!selectedProjectId"
      >
        {{ $t('task.addTask') }}
      </button>
    </div>

    <!-- Loading state for projects -->
    <div v-if="loading.projects" class="loading-state">
      <div class="spinner"></div>
      <p>{{ $t('common.loading') }}</p>
    </div>

    <!-- Loading state for tasks -->
    <div v-else-if="selectedProjectId && loading.tasks" class="loading-state">
      <div class="spinner"></div>
      <p>{{ $t('common.loading') }}</p>
    </div>

    <!-- Empty state when no project selected -->
    <div v-else-if="!selectedProjectId" class="empty-state">
      <p>{{ $t('project.noProject') }}</p>
    </div>

    <!-- Kanban board -->
    <div v-else class="kanban-board">
      <div
        v-for="column in columns"
        :key="column.status"
        class="kanban-column"
        :class="column.status.toLowerCase()"
        @dragover.prevent
        @drop="onDrop($event, column.status)"
      >
        <div class="column-header">
          <span class="column-title">{{ $t(`status.${column.status}`) }}</span>
          <span class="task-count">{{ getTasksByStatus(column.status).length }}</span>
        </div>
        <div class="column-content">
          <div
            v-for="task in getTasksByStatus(column.status)"
            :key="task.id"
            class="task-card"
            draggable="true"
            @dragstart="onDragStart($event, task)"
            @click="onTaskClick(task)"
          >
            <div class="task-title">{{ task.title }}</div>
            <div class="task-meta">
              <span
                class="priority-badge"
                :class="getPriorityClass(task.priority)"
              >
                {{ $t(`priority.${task.priority}`) }}
              </span>
              <div class="task-actions">
                <button
                  class="edit-btn"
                  @click.stop="openTaskModal(task)"
                  :title="$t('task.editTask')"
                >
                  ✎
                </button>
                <button
                  class="run-btn"
                  :class="{ running: isTaskRunning(task.id) }"
                  @click.stop="onTaskRun(task)"
                  :title="isTaskRunning(task.id) ? 'Running...' : 'Run with AI'"
                >
                  <span v-if="isTaskRunning(task.id)" class="spinner-icon"></span>
                  <span v-else>&#9654;</span>
                </button>
                <span v-if="task.assignee" class="assignee">
                  {{ getAssigneeInitials(task.assignee) }}
                </span>
              </div>
            </div>
          </div>
          <div v-if="getTasksByStatus(column.status).length === 0" class="empty-column">
            <p>{{ $t('task.noTasks') }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Task detail modal -->
    <div v-if="showTaskModal" class="modal-overlay" @click.self="closeTaskModal">
      <div class="modal">
        <div class="modal-header">
          <h2>{{ isEditing ? $t('task.editTask') : $t('task.createTask') }}</h2>
          <button class="modal-close" @click="closeTaskModal">&times;</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="saveTask">
            <div class="form-group">
              <label for="task-title">{{ $t('task.taskTitle') }} *</label>
              <input
                id="task-title"
                v-model="taskForm.title"
                type="text"
                required
                :placeholder="$t('task.taskTitle')"
              />
            </div>
            <div class="form-group">
              <label for="task-description">{{ $t('task.taskDescription') }}</label>
              <textarea
                id="task-description"
                v-model="taskForm.description"
                rows="4"
                :placeholder="$t('task.taskDescription')"
              ></textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="task-status">{{ $t('task.status') }}</label>
                <select id="task-status" v-model="taskForm.status">
                  <option
                    v-for="column in columns"
                    :key="column.status"
                    :value="column.status"
                  >
                    {{ $t(`status.${column.status}`) }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label for="task-priority">{{ $t('task.priority') }}</label>
                <select id="task-priority" v-model="taskForm.priority">
                  <option value="LOW">{{ $t('priority.LOW') }}</option>
                  <option value="MEDIUM">{{ $t('priority.MEDIUM') }}</option>
                  <option value="HIGH">{{ $t('priority.HIGH') }}</option>
                  <option value="CRITICAL">{{ $t('priority.CRITICAL') }}</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label for="task-assignee">{{ $t('task.assignee') }}</label>
              <input
                id="task-assignee"
                v-model="taskForm.assignee"
                type="text"
                :placeholder="$t('task.assignee')"
              />
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button
            v-if="isEditing"
            class="btn btn-danger"
            @click="deleteTask"
            :disabled="loading.saving"
          >
            {{ $t('common.delete') }}
          </button>
          <div class="modal-actions">
            <button
              v-if="isEditing"
              class="btn btn-success"
              @click="openAgentSelectorFromModal"
              :disabled="loading.saving"
            >
              Run with AI
            </button>
            <button
              class="btn btn-secondary"
              @click="closeTaskModal"
              :disabled="loading.saving"
            >
              {{ $t('common.cancel') }}
            </button>
            <button
              class="btn btn-primary"
              @click="saveTask"
              :disabled="loading.saving"
            >
              {{ loading.saving ? $t('common.loading') : $t('common.save') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Agent Selector Dialog -->
    <AgentSelector
      v-model="showAgentSelector"
      :project-id="selectedProjectId"
      :task="selectedTask"
      @select="onAgentSelected"
    />

    <!-- Fixed Terminal Panel -->
    <TerminalPanel
      ref="terminalPanelRef"
      :sessions="activeSessions"
      :current-session-id="currentSessionId"
      @close="onSessionClose"
      @switch="onSessionSwitch"
      @stop="onSessionStop"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import projectApi from '../api/project.js'
import taskApi from '../api/task.js'
import sessionApi from '../api/session.js'
import AgentSelector from '../components/AgentSelector.vue'
import TerminalPanel from '../components/TerminalPanel.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

// Column definitions
const columns = [
  { status: 'TODO' },
  { status: 'IN_PROGRESS' },
  { status: 'IN_REVIEW' },
  { status: 'DONE' },
  { status: 'BLOCKED' }
]

// State
const projects = ref([])
const tasks = ref([])
const selectedProjectId = ref('')
const showTaskModal = ref(false)
const isEditing = ref(false)
const editingTaskId = ref(null)
const draggedTask = ref(null)

// Agent selector state
const showAgentSelector = ref(false)
const selectedTask = ref(null)

// Session state
const activeSessions = ref([])
const currentSessionId = ref(null)
const runningTasks = ref(new Set())
const terminalPanelRef = ref(null)

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

// Methods
const getTasksByStatus = (status) => {
  return tasks.value.filter(task => task.status === status)
}

const fetchProjects = async () => {
  loading.projects = true
  try {
    const response = await projectApi.getAll()
    projects.value = response.data || response || []

    if (projects.value.length > 0 && !selectedProjectId.value) {
      // Try to get project ID from URL query param
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
    // Load active sessions after tasks are loaded
    await loadActiveSessions()
  } catch (error) {
    console.error('Failed to fetch tasks:', error)
    tasks.value = []
  } finally {
    loading.tasks = false
  }
}

const onProjectChange = () => {
  // Update URL query param to persist selection
  router.replace({ query: { projectId: selectedProjectId.value } })
  fetchTasks()
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

const deleteTask = async () => {
  if (!editingTaskId.value) return
  if (!confirm(t('task.deleteConfirm'))) return

  loading.saving = true
  try {
    await taskApi.delete(editingTaskId.value)
    tasks.value = tasks.value.filter(t => t.id !== editingTaskId.value)
    closeTaskModal()
  } catch (error) {
    console.error('Failed to delete task:', error)
  } finally {
    loading.saving = false
  }
}

// Agent selector and session management
const openAgentSelectorFromModal = () => {
  selectedTask.value = tasks.value.find(t => t.id === editingTaskId.value)
  showAgentSelector.value = true
}

const onTaskRun = (task) => {
  selectedTask.value = task
  showAgentSelector.value = true
}

/**
 * Handle task card click event
 * - If has active session, switch to that session
 * - If no active session, do nothing
 */
const onTaskClick = (task) => {
  const activeSession = activeSessions.value.find(s => s.taskId === task.id)
  if (activeSession) {
    currentSessionId.value = activeSession.id
  }
}

const onAgentSelected = async ({ agentId, task }) => {
  showAgentSelector.value = false

  // 关闭任务详情弹窗，返回看板页面
  closeTaskModal()

  if (!task) {
    task = selectedTask.value
  }

  if (!task) return

  try {
    // Check if task already has an active session
    const existingResponse = await sessionApi.getActiveByTask(task.id)
    const existingSession = existingResponse.data !== undefined ? existingResponse.data : existingResponse
    // Only use existing session if it has a valid id
    if (existingSession && existingSession.id) {
      // Add to active sessions if not already there
      if (!activeSessions.value.find(s => s.id === existingSession.id)) {
        activeSessions.value.push({
          ...existingSession,
          taskTitle: task.title
        })
      }
      currentSessionId.value = existingSession.id
      runningTasks.value.add(task.id)
      return
    }

    // Create new session
    const response = await sessionApi.create(task.id, agentId)
    const session = response.data || response

    // Add to active sessions
    activeSessions.value.push({
      ...session,
      taskTitle: task.title
    })
    currentSessionId.value = session.id
    runningTasks.value.add(task.id)

    // Auto-start the session
    await sessionApi.start(session.id)

    // Send initial task description message
    const initialMessage = buildInitialTaskMessage(task)
    await sessionApi.sendInput(session.id, initialMessage)

    // Update session status
    const sessionIndex = activeSessions.value.findIndex(s => s.id === session.id)
    if (sessionIndex !== -1) {
      activeSessions.value[sessionIndex].status = 'RUNNING'
    }

    // Add initial message to TerminalPanel's output display
    if (terminalPanelRef.value) {
      terminalPanelRef.value.addOutput(session.id, {
        data: initialMessage,
        stream: 'stdin',
        timestamp: Date.now()
      })
    }
  } catch (error) {
    console.error('Failed to create/start session:', error)
  }
}

const onSessionClose = async (sessionId) => {
  const session = activeSessions.value.find(s => s.id === sessionId)

  // Stop session if running
  if (session && (session.status === 'RUNNING' || session.status === 'IDLE')) {
    try {
      await sessionApi.stop(sessionId)
    } catch (e) {
      console.error('Failed to stop session:', e)
    }
  }

  // Remove from active sessions
  activeSessions.value = activeSessions.value.filter(s => s.id !== sessionId)

  // Update running tasks
  if (session) {
    const task = tasks.value.find(t => t.title === session.taskTitle)
    if (task) {
      runningTasks.value.delete(task.id)
    }
  }

  // Switch to another session if current was closed
  if (currentSessionId.value === sessionId) {
    currentSessionId.value = activeSessions.value[0]?.id || null
  }
}

const onSessionSwitch = (sessionId) => {
  currentSessionId.value = sessionId
}

const onSessionStop = async (sessionId) => {
  try {
    await sessionApi.stop(sessionId)
    const session = activeSessions.value.find(s => s.id === sessionId)
    if (session) {
      session.status = 'STOPPED'
      const task = tasks.value.find(t => t.title === session.taskTitle)
      if (task) {
        runningTasks.value.delete(task.id)
      }
    }
  } catch (e) {
    console.error('Failed to stop session:', e)
  }
}

const isTaskRunning = (taskId) => {
  return runningTasks.value.has(taskId)
}

/**
 * Build initial task description message
 */
const buildInitialTaskMessage = (task) => {
  let message = `请帮我完成这个任务：${task.title}\n`
  if (task.description && task.description.trim()) {
    message += `\n任务描述：\n${task.description}\n`
  }
  message += '\n请分析任务需求并开始实施。'
  return message
}

const loadActiveSessions = async () => {
  if (!selectedProjectId.value) return

  try {
    // Get all tasks and check for active sessions
    for (const task of tasks.value) {
      try {
        const response = await sessionApi.getActiveByTask(task.id)
        const session = response.data !== undefined ? response.data : response
        if (session && session.id) {
          if (!activeSessions.value.find(s => s.id === session.id)) {
            activeSessions.value.push({
              ...session,
              taskTitle: task.title
            })
            runningTasks.value.add(task.id)
          }
        }
      } catch (e) {
        // No active session for this task
      }
    }

    // Set current session to first active
    if (activeSessions.value.length > 0 && !currentSessionId.value) {
      currentSessionId.value = activeSessions.value[0].id
    }
  } catch (error) {
    console.error('Failed to load active sessions:', error)
  }
}

// Drag and drop handlers
const onDragStart = (event, task) => {
  draggedTask.value = task
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', task.id)
}

const onDrop = async (event, newStatus) => {
  event.preventDefault()

  if (!draggedTask.value || draggedTask.value.status === newStatus) {
    draggedTask.value = null
    return
  }

  const task = draggedTask.value
  const oldStatus = task.status

  task.status = newStatus

  try {
    await taskApi.updateStatus(task.id, newStatus)
  } catch (error) {
    console.error('Failed to update task status:', error)
    task.status = oldStatus
  }

  draggedTask.value = null
}

// Utility functions
const getPriorityClass = (priority) => {
  const classes = {
    LOW: 'priority-low',
    MEDIUM: 'priority-medium',
    HIGH: 'priority-high',
    CRITICAL: 'priority-critical'
  }
  return classes[priority] || 'priority-medium'
}

const getAssigneeInitials = (assignee) => {
  if (!assignee) return ''
  return assignee
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('')
}

// Lifecycle
onMounted(() => {
  fetchProjects()
})

onUnmounted(() => {
  // Clean up sessions on unmount
  activeSessions.value = []
  currentSessionId.value = null
  runningTasks.value.clear()
})
</script>

<style scoped>
.kanban-view {
  padding: 1.5rem;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.kanban-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.project-selector {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.project-selector label {
  font-weight: 500;
  color: #4a5568;
}

.project-selector select {
  padding: 0.5rem 1rem;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  font-size: 0.875rem;
  background: white;
  min-width: 200px;
  cursor: pointer;
}

.project-selector select:focus {
  outline: none;
  border-color: #4299e1;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.15);
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #4299e1;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #3182ce;
}

.btn-secondary {
  background: #e2e8f0;
  color: #4a5568;
}

.btn-secondary:hover:not(:disabled) {
  background: #cbd5e0;
}

.btn-danger {
  background: #e53e3e;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c53030;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: #718096;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e2e8f0;
  border-top-color: #4299e1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.kanban-board {
  display: flex;
  gap: 1rem;
  flex: 1;
  overflow-x: auto;
  padding-bottom: 1rem;
  margin-right: 420px; /* Make room for right-side terminal panel (400px + 20px buffer) */
}

.kanban-column {
  flex: 0 0 280px;
  background: #f7fafc;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 200px);
}

.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 2px solid;
}

.column-title {
  font-weight: 600;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.task-count {
  background: rgba(0, 0, 0, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.kanban-column.todo {
  border-top: 3px solid #a0aec0;
}
.kanban-column.todo .column-header {
  border-color: #a0aec0;
  color: #4a5568;
}

.kanban-column.in_progress {
  border-top: 3px solid #4299e1;
}
.kanban-column.in_progress .column-header {
  border-color: #4299e1;
  color: #2b6cb0;
}

.kanban-column.in_review {
  border-top: 3px solid #9f7aea;
}
.kanban-column.in_review .column-header {
  border-color: #9f7aea;
  color: #6b46c1;
}

.kanban-column.done {
  border-top: 3px solid #48bb78;
}
.kanban-column.done .column-header {
  border-color: #48bb78;
  color: #276749;
}

.kanban-column.blocked {
  border-top: 3px solid #e53e3e;
}
.kanban-column.blocked .column-header {
  border-color: #e53e3e;
  color: #c53030;
}

.column-content {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.task-card {
  background: white;
  border-radius: 6px;
  padding: 0.875rem;
  margin-bottom: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid #e2e8f0;
}

.task-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.task-title {
  font-weight: 500;
  color: #2d3748;
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
  line-height: 1.4;
}

.task-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.priority-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  text-transform: uppercase;
}

.priority-low {
  background: #c6f6d5;
  color: #276749;
}

.priority-medium {
  background: #fefcbf;
  color: #975a16;
}

.priority-high {
  background: #fed7d7;
  color: #c53030;
}

.priority-critical {
  background: #c53030;
  color: white;
}

.assignee {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #4299e1;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 600;
}

.task-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.run-btn {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 4px;
  background: #48bb78;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  transition: all 0.2s ease;
}

.run-btn:hover {
  background: #38a169;
  transform: scale(1.1);
}

.run-btn.running {
  background: #718096;
  cursor: not-allowed;
}

.edit-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px 6px;
  font-size: 14px;
  color: #666;
  opacity: 0;
  transition: opacity 0.2s;
}

.task-card:hover .edit-btn {
  opacity: 1;
}

.edit-btn:hover {
  color: #409eff;
}

.spinner-icon {
  width: 12px;
  height: 12px;
  border: 2px solid white;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.btn-success {
  background: #48bb78;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #38a169;
}

.empty-column {
  text-align: center;
  padding: 2rem 1rem;
  color: #a0aec0;
  font-size: 0.875rem;
}

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
  background: white;
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.125rem;
  color: #2d3748;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #a0aec0;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.modal-close:hover {
  color: #4a5568;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
}

.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-top: 1px solid #e2e8f0;
  background: #f7fafc;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.375rem;
  font-weight: 500;
  color: #4a5568;
  font-size: 0.875rem;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  font-size: 0.875rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: #4299e1;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.15);
}

.form-group textarea {
  resize: vertical;
  min-height: 100px;
}

.form-row {
  display: flex;
  gap: 1rem;
}

.form-row .form-group {
  flex: 1;
}

@media (max-width: 768px) {
  .kanban-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }

  .project-selector {
    flex-direction: column;
    align-items: stretch;
  }

  .project-selector select {
    min-width: 100%;
  }

  .kanban-board {
    flex-direction: column;
    margin-right: 0;
    margin-bottom: 0;
  }

  .kanban-column {
    flex: 0 0 auto;
    max-height: 300px;
  }

  .form-row {
    flex-direction: column;
  }
}
</style>
