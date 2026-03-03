<template>
  <el-dialog
    :model-value="true"
    :title="isNew ? 'Create Task' : 'Task Details'"
    width="500px"
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
          :rows="4"
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

      <!-- Agent Execution Section -->
      <el-divider v-if="!isNew && agents.length > 0">
        <el-icon><Cpu /></el-icon>
        Execute with Agent
      </el-divider>

      <div v-if="!isNew && agents.length > 0" class="execution-section">
        <el-row :gutter="8">
          <el-col :span="16">
            <el-select v-model="selectedAgentId" placeholder="Select an agent..." style="width: 100%">
              <el-option
                v-for="agent in agents"
                :key="agent.id"
                :label="`${agent.name} (${agent.type})`"
                :value="agent.id"
              />
            </el-select>
          </el-col>
          <el-col :span="8">
            <el-button
              type="success"
              :disabled="!selectedAgentId || isExecuting"
              :loading="isExecuting"
              @click="executeTask"
            >
              Execute
            </el-button>
          </el-col>
        </el-row>

        <!-- Execution Status -->
        <el-alert
          v-if="currentExecution"
          :type="executionAlertType"
          :title="`Status: ${currentExecution.status}`"
          class="execution-status"
          show-icon
        >
          <template v-if="currentExecution.output" #default>
            <el-scrollbar max-height="200px">
              <pre class="execution-output">{{ currentExecution.output }}</pre>
            </el-scrollbar>
          </template>
        </el-alert>
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
import { Cpu } from '@element-plus/icons-vue'
import { taskApi } from '../api/task'
import { agentApi } from '../api/agent'
import { executionApi } from '../api/execution'

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
const isExecuting = ref(false)
const currentExecution = ref(null)
let eventSource = null

const executionAlertType = computed(() => {
  if (!currentExecution.value) return 'info'
  const status = currentExecution.value.status?.toLowerCase()
  if (status === 'running') return 'warning'
  if (status === 'success' || status === 'completed') return 'success'
  if (status === 'failed') return 'error'
  return 'info'
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
    } catch (e) {
      console.error('Failed to load agents:', e)
    }
  }
})

onUnmounted(() => {
  if (eventSource) {
    eventSource.close()
  }
})

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

const executeTask = async () => {
  if (!selectedAgentId.value) return

  isExecuting.value = true
  try {
    const response = await executionApi.start(props.task.id, selectedAgentId.value)
    currentExecution.value = response.data

    // Setup SSE for real-time updates
    eventSource = executionApi.getOutputStream(currentExecution.value.id)
    eventSource.addEventListener('status', (e) => {
      if (currentExecution.value) {
        currentExecution.value.status = e.data
      }
    })
    eventSource.addEventListener('output', (e) => {
      if (currentExecution.value) {
        currentExecution.value.output = e.data
      }
    })
    eventSource.onerror = () => {
      eventSource.close()
    }
  } catch (e) {
    console.error('Failed to execute task:', e)
    ElMessage.error('Failed to start execution')
  } finally {
    isExecuting.value = false
  }
}
</script>

<style scoped>
.execution-section {
  margin-top: 8px;
}

.execution-status {
  margin-top: 12px;
}

.execution-output {
  margin: 0;
  padding: 8px;
  background: var(--el-bg-color-page);
  border-radius: 4px;
  font-size: 12px;
  white-space: pre-wrap;
  font-family: monospace;
}

.dialog-footer {
  display: flex;
  width: 100%;
}

.spacer {
  flex: 1;
}
</style>
