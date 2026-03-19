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

    <!-- Git Changes Section -->
    <template v-if="!isNew && hasWorktree">
      <el-divider>
        <el-icon><Document /></el-icon>
        {{ $t('git.changes', 'Git Changes') }}
      </el-divider>

      <div class="git-section">
        <div v-if="gitLoading" class="git-loading">
          <el-icon class="is-loading"><Loading /></el-icon>
          {{ $t('common.loading') }}
        </div>

        <div v-else-if="gitStatus" class="git-status">
          <div class="status-header">
            <el-tag type="info" size="small">
              <el-icon><Branch /></el-icon>
              {{ gitStatus.branch }}
            </el-tag>
            <div class="change-counts">
              <el-tag v-if="gitStatus.added?.length" type="success" size="small">
                +{{ gitStatus.added.length }}
              </el-tag>
              <el-tag v-if="gitStatus.modified?.length" type="warning" size="small">
                ~{{ gitStatus.modified.length }}
              </el-tag>
              <el-tag v-if="gitStatus.deleted?.length" type="danger" size="small">
                -{{ gitStatus.deleted.length }}
              </el-tag>
              <el-tag v-if="gitStatus.untracked?.length" type="info" size="small">
                ?{{ gitStatus.untracked.length }}
              </el-tag>
            </div>
          </div>

          <div v-if="gitStatus.hasUncommittedChanges" class="changes-preview">
            <el-scrollbar max-height="120px">
              <div class="file-list">
                <div v-for="file in gitStatus.added" :key="'add-'+file.path" class="file-item added">
                  <el-icon><Plus /></el-icon>
                  {{ file.path }}
                </div>
                <div v-for="file in gitStatus.modified" :key="'mod-'+file.path" class="file-item modified">
                  <el-icon><Edit /></el-icon>
                  {{ file.path }}
                </div>
                <div v-for="file in gitStatus.deleted" :key="'del-'+file.path" class="file-item deleted">
                  <el-icon><Minus /></el-icon>
                  {{ file.path }}
                </div>
                <div v-for="file in gitStatus.untracked" :key="'untr-'+file.path" class="file-item untracked">
                  <el-icon><QuestionFilled /></el-icon>
                  {{ file.path }}
                </div>
              </div>
            </el-scrollbar>
          </div>

          <el-empty v-else :description="$t('git.noChanges')" :image-size="60" />

          <div class="git-actions">
            <el-button size="small" @click="showDiffDialog">
              <el-icon><View /></el-icon>
              {{ $t('git.viewDiff', 'View Diff') }}
            </el-button>
            <el-button size="small" type="primary" @click="openCommitDialog" :disabled="!gitStatus.hasUncommittedChanges">
              <el-icon><Check /></el-icon>
              {{ $t('git.commit') }}
            </el-button>
          </div>
        </div>

        <el-empty v-else :description="$t('git.noWorktree', 'No worktree for this task')" :image-size="60" />
      </div>
    </template>

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

  <!-- Diff Dialog -->
  <el-dialog
    v-model="diffDialogVisible"
    :title="$t('git.diff', 'Code Changes')"
    width="80%"
    top="5vh"
  >
    <div class="diff-stats" v-if="diffContent">
      <el-tag type="success">
        <el-icon><Plus /></el-icon>
        {{ (diffContent.match(/^\+/gm) || []).length }} additions
      </el-tag>
      <el-tag type="danger">
        <el-icon><Minus /></el-icon>
        {{ (diffContent.match(/^-/gm) || []).length }} deletions
      </el-tag>
    </div>
    <el-scrollbar height="60vh">
      <pre class="diff-content">{{ diffContent }}</pre>
    </el-scrollbar>
    <template #footer>
      <el-button @click="diffDialogVisible = false">{{ $t('common.close') }}</el-button>
    </template>
  </el-dialog>

  <!-- Commit Dialog -->
  <CommitDialog
    v-if="commitDialogVisible"
    :project-id="projectId"
    :task-id="task.id"
    :current-branch="gitStatus?.branch || ''"
    @close="commitDialogVisible = false"
    @committed="handleCommitted"
  />
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Cpu, Document, Loading, Branch, Plus, Minus, Edit, QuestionFilled, View, Check } from '@element-plus/icons-vue'
import { createTask, updateTask, deleteTask } from '../api/task'
import { getAgents } from '../api/agent'
import { getActiveSessionByTask, getSessionHistory, createSession, deleteSession } from '../api/session'
import { getStatus, getDiff } from '../api/git'
import ChatBox from './ChatBox.vue'
import TaskForm from './task/TaskForm.vue'
import TaskHistory from './task/TaskHistory.vue'
import CommitDialog from './CommitDialog.vue'
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

// Git status
const gitLoading = ref(false)
const gitStatus = ref(null)
const hasWorktree = ref(false)
const diffDialogVisible = ref(false)
const diffContent = ref('')
const commitDialogVisible = ref(false)

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
    const response = await getAgents()
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
    loadGitStatus()
  } catch (e) {
    console.error('Failed to load agents:', e)
  }
}

const loadGitStatus = async () => {
  if (!props.task?.id) return
  gitLoading.value = true
  try {
    const response = await getStatus(props.projectId, props.task.id)
    if (response.success && response.data) {
      gitStatus.value = response.data
      hasWorktree.value = true
    } else {
      hasWorktree.value = false
    }
  } catch (e) {
    console.log('No worktree for this task:', e)
    hasWorktree.value = false
  } finally {
    gitLoading.value = false
  }
}

const showDiffDialog = async () => {
  if (!props.task?.id) return
  try {
    const response = await getDiff(props.projectId, props.task.id)
    if (response.success && response.data) {
      diffContent.value = response.data.content || ''
      diffDialogVisible.value = true
    } else {
      toast.error(response.message || t('git.diffFailed'))
    }
  } catch (e) {
    toast.apiError(e, t('git.diffFailed'))
  }
}

const openCommitDialog = () => {
  commitDialogVisible.value = true
}

const handleCommitted = () => {
  loadGitStatus()
  toast.success(t('git.commitSuccess'))
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
    let response
    if (isNew.value) {
      response = await createTask(data)
    } else {
      response = await updateTask(props.task.id, data)
    }
    // Check response.success to handle cases where backend returns { success: false }
    if (response && response.success) {
      toast.success(isNew.value ? t('messages.created', { name: t('task.title') }) : t('messages.saved', { name: t('task.title') }))
      emit('saved')
      emit('close')
    } else {
      // Backend returned success: false
      console.error('Save task failed:', response?.message)
      toast.error(response?.message || t('messages.saveFailed', { name: t('task.title') }))
    }
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
    const response = await deleteTask(props.task.id)
    if (response && response.success) {
      toast.success(t('messages.deleted', { name: t('task.title') }))
      emit('deleted')
      emit('close')
    } else {
      toast.error(response?.message || t('messages.deleteFailed', { name: t('task.title') }))
    }
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
    const response = await deleteSession(localSession.value.id)
    if (response && response.success) {
      localSession.value = null
      toast.success(t('messages.deleted', { name: t('session.title') }))
    } else {
      toast.error(response?.message || t('messages.deleteFailed', { name: t('session.title') }))
    }
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

/* Git Section Styles */
.git-section {
  margin-top: 8px;
}

.git-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-secondary);
  padding: 16px;
  justify-content: center;
}

.git-status {
  background: var(--el-bg-color-page);
  border-radius: 8px;
  padding: 12px;
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.change-counts {
  display: flex;
  gap: 4px;
}

.changes-preview {
  margin: 8px 0;
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  background: var(--el-bg-color);
}

.file-list {
  padding: 8px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  font-size: 12px;
  font-family: monospace;
  border-radius: 3px;
  margin-bottom: 2px;
}

.file-item.added {
  background: rgba(103, 194, 58, 0.1);
  color: #67c23a;
}

.file-item.modified {
  background: rgba(230, 162, 60, 0.1);
  color: #e6a23c;
}

.file-item.deleted {
  background: rgba(245, 108, 108, 0.1);
  color: #f56c6c;
}

.file-item.untracked {
  background: rgba(144, 147, 153, 0.1);
  color: #909399;
}

.git-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  justify-content: flex-end;
}

/* Diff Styles */
.diff-stats {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.diff-content {
  margin: 0;
  padding: 16px;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  background: #1e1e1e;
  color: #d4d4d4;
  border-radius: 8px;
}
</style>
