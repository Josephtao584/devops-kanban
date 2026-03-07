<template>
  <el-dialog
    :model-value="true"
    :title="isNew ? $t('task.createTask') : $t('task.editTask')"
    width="600px"
    top="5vh"
    :close-on-click-modal="false"
    @close="$emit('close')"
  >
    <TaskForm
      v-if="showForm"
      ref="formRef"
      :task="task"
      @submit="handleSave"
      @cancel="$emit('close')"
    />

    <!-- AI Session Section -->
    <template v-if="!isNew && agents.length > 0">
      <el-divider>
        <el-icon><Cpu /></el-icon>
        {{ $t('session.title', 'AI Session') }}
      </el-divider>

      <div class="session-section">
        <!-- Agent Selection -->
        <div class="agent-select-row">
          <el-select
            v-model="selectedAgentId"
            :placeholder="$t('execution.selectAgent')"
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
            {{ $t('session.createSession') }}
          </el-button>
          <el-button
            v-else
            type="danger"
            @click="deleteCurrentSession"
          >
            {{ $t('session.deleteSession') }}
          </el-button>
        </div>

        <!-- Session Chat -->
        <ChatBox
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
      <TaskHistory
        v-if="sessionHistory.length > 0"
        :sessions="sessionHistory"
        :active-session-id="localSession?.id"
        :loading="historyLoading"
        @select="onSelectHistory"
        @refresh="loadSessionHistory"
      />
    </template>

    <template #footer>
      <div class="dialog-footer">
        <el-button v-if="!isNew" type="danger" @click="handleDelete">
          {{ $t('common.delete') }}
        </el-button>
        <div class="spacer"></div>
        <el-button @click="$emit('close')">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="submitForm">
          {{ isNew ? $t('common.create') : $t('common.save') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Cpu } from '@element-plus/icons-vue'
import { createTask, updateTask, deleteTask } from '../api/task'
import { getAgents } from '../api/agent'
import { getActiveSessionByTask, getSessionHistory, createSession, deleteSession } from '../api/session'
import ChatBox from './ChatBox.vue'
import TaskForm from './task/TaskForm.vue'
import TaskHistory from './task/TaskHistory.vue'
import { useToast } from '../composables/ui/useToast'

const { t } = useI18n()
const toast = useToast()

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
const showForm = ref(true)

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

watch(() => props.task, (newTask, oldTask) => {
  if (newTask && oldTask && newTask.id !== oldTask.id) {
    sessionHistory.value = []
    loadSessionForTask(newTask)
  }
}, { immediate: false })

const loadSessionForTask = async (task) => {
  if (!task?.id) return
  console.log('[TaskDetail] loadSessionForTask, task:', task.id)
  try {
    const response = await getAgents(props.projectId)
    agents.value = response.data || []
    console.log('[TaskDetail] Loaded agents:', agents.value.length)

    const sessionResponse = await getActiveSessionByTask(task.id)
    console.log('[TaskDetail] Active session response:', sessionResponse.data ? sessionResponse.data.id : null)
    if (sessionResponse.data) {
      localSession.value = sessionResponse.data
      selectedAgentId.value = sessionResponse.data.agentId
    } else if (agents.value.length > 0) {
      selectedAgentId.value = agents.value[0].id
      await createNewSession()
    }

    loadSessionHistory()
  } catch (e) {
    console.error('Failed to load agents:', e)
  }
}

onMounted(async () => {
  if (!isNew.value) {
    await loadSessionForTask(props.task)
  }
})

const loadSessionHistory = async () => {
  if (!props.task?.id) return
  historyLoading.value = true
  try {
    const response = await getSessionHistory(props.task.id)
    if (response.success && response.data) {
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

const submitForm = () => {
  formRef.value?.validate().then(() => {
    formRef.value?.$emit('submit')
  }).catch(() => {})
}

const handleSave = async (formData) => {
  const data = {
    ...formData,
    projectId: props.projectId
  }

  try {
    if (isNew.value) {
      await createTask(data)
    } else {
      await updateTask(props.task.id, data)
    }
    toast.success(isNew.value ? t('messages.created', { name: t('task.title') }) : t('messages.saved', { name: t('task.title') }))
    emit('saved')
    emit('close')
  } catch (e) {
    console.error('Failed to save task:', e)
    toast.apiError(e, t('messages.saveFailed', { name: t('task.title') }))
  }
}

const handleDelete = async () => {
  try {
    await ElMessageBox.confirm(t('task.deleteConfirm'), t('common.delete'), {
      confirmButtonText: t('common.delete'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    })
  } catch {
    return
  }

  try {
    await deleteTask(props.task.id)
    toast.success(t('messages.deleted', { name: t('task.title') }))
    emit('deleted')
    emit('close')
  } catch (e) {
    console.error('Failed to delete task:', e)
    toast.apiError(e, t('messages.deleteFailed', { name: t('task.title') }))
  }
}

const createNewSession = async () => {
  if (!selectedAgentId.value) {
    toast.warning(t('agent.selectFirst', 'Please select an agent first'))
    return
  }

  try {
    console.log('Creating session for task:', props.task.id, 'agent:', selectedAgentId.value)
    const response = await createSession(props.task.id, selectedAgentId.value)
    if (response.success && response.data) {
      localSession.value = response.data
      toast.success(t('messages.created', { name: t('session.title') }))
    } else {
      toast.error(response.message || t('messages.createFailed', { name: t('session.title') }))
    }
  } catch (e) {
    console.error('Failed to create session:', e)
    toast.apiError(e, t('messages.createFailed', { name: t('session.title') }))
  }
}

const deleteCurrentSession = async () => {
  if (!localSession.value) return

  try {
    await ElMessageBox.confirm(
      t('session.deleteConfirm', 'Are you sure you want to delete this session?'),
      t('session.deleteSession'),
      {
        confirmButtonText: t('common.delete'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
  } catch {
    return
  }

  try {
    await deleteSession(localSession.value.id)
    localSession.value = null
    toast.success(t('messages.deleted', { name: t('session.title') }))
  } catch (e) {
    console.error('Failed to delete session:', e)
    toast.apiError(e, t('messages.deleteFailed', { name: t('session.title') }))
  }
}

const onSessionCreated = (session) => {
  localSession.value = session
}

const onSessionStopped = () => {
  loadSessionHistory()
}

const onStatusChange = (status) => {
  if (localSession.value) {
    localSession.value.status = status
  }
}

const onSelectHistory = (session) => {
  // Load selected history session into view
  console.log('Selected history session:', session.id)
}
</script>

<style scoped>
:deep(.el-dialog__body) {
  max-height: 70vh;
  overflow-y: auto;
  padding-bottom: 16px;
}

.session-section {
  margin-top: 8px;
  height: 350px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.session-section .chat-box {
  flex: 1;
  min-height: 0;
}

.agent-select-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.dialog-footer {
  display: flex;
  width: 100%;
}

.spacer {
  flex: 1;
}
</style>
