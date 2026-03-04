<template>
  <el-dialog
    :model-value="true"
    :title="isNew ? 'Create Task' : 'Task Details'"
    width="600px"
    :close-on-click-modal="false"
    @close="$emit('close')"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
    >
      <el-form-item label="Title" prop="title">
        <el-input v-model="form.title" placeholder="Enter task title" />
      </el-form-item>

      <el-form-item label="Description">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="Enter task description"
        />
      </el-form-item>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="Status">
            <el-select v-model="form.status" style="width: 100%">
              <el-option label="To Do" value="TODO" />
              <el-option label="In Progress" value="IN_PROGRESS" />
              <el-option label="In Review" value="IN_REVIEW" />
              <el-option label="Done" value="DONE" />
              <el-option label="Blocked" value="BLOCKED" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="Priority">
            <el-select v-model="form.priority" style="width: 100%">
              <el-option label="Low" value="LOW">
                <el-tag type="info" size="small">Low</el-tag>
              </el-option>
              <el-option label="Medium" value="MEDIUM">
                <el-tag type="primary" size="small">Medium</el-tag>
              </el-option>
              <el-option label="High" value="HIGH">
                <el-tag type="warning" size="small">High</el-tag>
              </el-option>
              <el-option label="Critical" value="CRITICAL">
                <el-tag type="danger" size="small">Critical</el-tag>
              </el-option>
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="Assignee">
        <el-input v-model="form.assignee" placeholder="Enter assignee name" />
      </el-form-item>

      <!-- AI Session Section -->
      <el-divider v-if="!isNew && agents.length > 0">
        <el-icon><Cpu /></el-icon>
        AI Session
      </el-divider>

      <div v-if="!isNew && agents.length > 0" class="session-section">
        <!-- Agent Selection -->
        <div class="agent-select-row">
          <el-select
            v-model="selectedAgentId"
            placeholder="Select an agent..."
            style="flex: 1"
            :disabled="hasActiveSession"
          >
            <el-option
              v-for="agent in agents"
              :key="agent.id"
              :label="`${agent.name} (${agent.type})`"
              :value="agent.id"
            />
          </el-select>
          <el-button
            v-if="!hasActiveSession"
            type="primary"
            :disabled="!selectedAgentId"
            @click="createNewSession"
          >
            Create Session
          </el-button>
          <el-button
            v-else
            type="danger"
            @click="deleteCurrentSession"
          >
            Delete Session
          </el-button>
        </div>

        <!-- Session Terminal -->
        <SessionTerminal
          v-if="hasActiveSession || localSession"
          ref="terminalRef"
          :task="task"
          :agent-id="selectedAgentId"
          :initial-session="localSession"
          @session-created="onSessionCreated"
          @session-stopped="onSessionStopped"
          @status-change="onStatusChange"
        />
      </div>

      <!-- Session History -->
      <el-divider v-if="!isNew && sessionHistory.length > 0">
        <el-icon><Clock /></el-icon>
        Session History
      </el-divider>

      <div v-if="!isNew && sessionHistory.length > 0" class="history-section">
        <el-collapse v-loading="historyLoading">
          <el-collapse-item
            v-for="session in sessionHistory"
            :key="session.id"
            :name="session.id"
          >
            <template #title>
              <div class="history-item-title">
                <el-tag :type="getStatusTagType(session.status)" size="small">
                  {{ session.status }}
                </el-tag>
                <span class="history-time">
                  {{ formatTime(session.startedAt) }}
                </span>
                <span v-if="session.stoppedAt" class="history-duration">
                  ({{ formatDuration(session.startedAt, session.stoppedAt) }})
                </span>
              </div>
            </template>
            <div class="history-output">
              <pre v-if="session.output">{{ session.output }}</pre>
              <el-empty v-else description="No output recorded" :image-size="40" />
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button v-if="!isNew" type="danger" @click="handleDelete">
          Delete
        </el-button>
        <div class="spacer"></div>
        <el-button @click="$emit('close')">Cancel</el-button>
        <el-button type="primary" @click="handleSave">
          {{ isNew ? 'Create' : 'Save' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Cpu, Clock } from '@element-plus/icons-vue'
import { taskApi } from '../api/task'
import { agentApi } from '../api/agent'
import sessionApi from '../api/session'
import SessionTerminal from './SessionTerminal.vue'

const props = defineProps({
  task: {
    type: Object,
    default: null
  },
  projectId: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['close', 'saved', 'deleted'])

const formRef = ref(null)
const terminalRef = ref(null)
const isNew = computed(() => !props.task?.id)

const form = ref({
  title: '',
  description: '',
  status: 'TODO',
  priority: 'MEDIUM',
  assignee: ''
})

const rules = {
  title: [
    { required: true, message: 'Title is required', trigger: 'blur' }
  ]
}

const agents = ref([])
const selectedAgentId = ref(null)
const localSession = ref(null)
const sessionHistory = ref([])
const historyLoading = ref(false)

const hasActiveSession = computed(() => {
  if (localSession.value) {
    const status = localSession.value.status
    return ['CREATED', 'RUNNING', 'IDLE'].includes(status)
  }
  return false
})

watch(() => props.task, (newTask) => {
  if (newTask) {
    form.value = {
      title: newTask.title || '',
      description: newTask.description || '',
      status: newTask.status || 'TODO',
      priority: newTask.priority || 'MEDIUM',
      assignee: newTask.assignee || ''
    }
  }
}, { immediate: true })

onMounted(async () => {
  if (!isNew.value) {
    try {
      const response = await agentApi.getByProject(props.projectId)
      agents.value = response.data || []

      // Check for active session
      const sessionResponse = await sessionApi.getActiveByTask(props.task.id)
      if (sessionResponse.data) {
        localSession.value = sessionResponse.data
        selectedAgentId.value = sessionResponse.data.agentId
      }

      // Load session history
      loadSessionHistory()
    } catch (e) {
      console.error('Failed to load agents:', e)
    }
  }
})

const loadSessionHistory = async () => {
  if (!props.task?.id) return
  historyLoading.value = true
  try {
    const response = await sessionApi.getHistory(props.task.id)
    if (response.success && response.data) {
      // Filter out active session and sort by startedAt descending
      sessionHistory.value = response.data
        .filter(s => !localSession.value || s.id !== localSession.value.id)
        .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
    }
  } catch (e) {
    console.error('Failed to load session history:', e)
  } finally {
    historyLoading.value = false
  }
}

const handleSave = async () => {
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  const data = {
    ...form.value,
    projectId: props.projectId
  }

  try {
    if (isNew.value) {
      await taskApi.create(data)
    } else {
      await taskApi.update(props.task.id, data)
    }
    ElMessage.success(isNew.value ? 'Task created' : 'Task saved')
    emit('saved')
    emit('close')
  } catch (e) {
    console.error('Failed to save task:', e)
    ElMessage.error('Failed to save task')
  }
}

const handleDelete = async () => {
  try {
    await ElMessageBox.confirm('Are you sure you want to delete this task?', 'Delete Task', {
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      type: 'warning'
    })
  } catch {
    return
  }

  try {
    await taskApi.delete(props.task.id)
    ElMessage.success('Task deleted')
    emit('deleted')
    emit('close')
  } catch (e) {
    console.error('Failed to delete task:', e)
    ElMessage.error('Failed to delete task')
  }
}

const createNewSession = async () => {
  if (!selectedAgentId.value) {
    ElMessage.warning('Please select an agent first')
    return
  }

  try {
    console.log('Creating session for task:', props.task.id, 'agent:', selectedAgentId.value)
    const response = await sessionApi.create(props.task.id, selectedAgentId.value)
    console.log('Create session response:', response)
    if (response.success && response.data) {
      localSession.value = response.data
      ElMessage.success('Session created')
    } else {
      ElMessage.error(response.message || 'Failed to create session')
    }
  } catch (e) {
    console.error('Failed to create session:', e)
    ElMessage.error(e.response?.data?.message || e.message || 'Failed to create session')
  }
}

const deleteCurrentSession = async () => {
  if (!localSession.value) return

  try {
    await ElMessageBox.confirm(
      'Are you sure you want to delete this session? All output will be lost.',
      'Delete Session',
      {
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
        type: 'warning'
      }
    )
  } catch {
    return
  }

  try {
    await sessionApi.delete(localSession.value.id)
    localSession.value = null
    ElMessage.success('Session deleted')
  } catch (e) {
    console.error('Failed to delete session:', e)
    ElMessage.error('Failed to delete session')
  }
}

const onSessionCreated = (session) => {
  localSession.value = session
}

const onSessionStopped = () => {
  // Session stopped, refresh history
  loadSessionHistory()
}

const onStatusChange = (status) => {
  if (localSession.value) {
    localSession.value.status = status
  }
}

// Helper functions for history display
const getStatusTagType = (status) => {
  const types = {
    'CREATED': 'info',
    'RUNNING': 'success',
    'IDLE': 'warning',
    'STOPPED': '',
    'ERROR': 'danger'
  }
  return types[status] || 'info'
}

const formatTime = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleString()
}

const formatDuration = (startStr, endStr) => {
  if (!startStr || !endStr) return ''
  const start = new Date(startStr)
  const end = new Date(endStr)
  const diffMs = end - start
  const diffMins = Math.floor(diffMs / 60000)
  const diffSecs = Math.floor((diffMs % 60000) / 1000)
  if (diffMins > 0) {
    return `${diffMins}m ${diffSecs}s`
  }
  return `${diffSecs}s`
}
</script>

<style scoped>
.session-section {
  margin-top: 8px;
}

.agent-select-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.history-section {
  margin-top: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.history-item-title {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.history-time {
  color: #606266;
  font-size: 12px;
}

.history-duration {
  color: #909399;
  font-size: 11px;
}

.history-output {
  background: #f5f7fa;
  border-radius: 4px;
  padding: 8px 12px;
  max-height: 200px;
  overflow-y: auto;
}

.history-output pre {
  margin: 0;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
}

.dialog-footer {
  display: flex;
  width: 100%;
}

.spacer {
  flex: 1;
}
</style>
