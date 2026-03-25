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
            <el-button size="small" type="success" @click="openMergeDialog">
              <el-icon><Connection /></el-icon>
              {{ $t('git.mergeBranch', 'Merge') }}
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
              :label="`${agent.name} (${formatExecutorTypeLabel(agent)})`"
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

  <el-dialog
    v-model="diffDialogVisible"
    :title="$t('git.diff', 'Code Changes')"
    width="90%"
    top="5vh"
  >
    <GitDiffViewer
      :file-items="taskDetailFileItems"
      :diffs-by-path="diffData?.diffs || {}"
      :loading="diffLoading"
      :selected-file-path="selectedDiffFile"
      :selectable="false"
      :title="$t('git.diff', 'Code Changes')"
      @update:selected-file-path="selectedDiffFile = $event"
    />

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

  <!-- Merge Dialog -->
  <el-dialog
    v-model="mergeDialogVisible"
    :title="$t('git.mergeBranch', 'Merge Branch')"
    width="500px"
  >
    <div class="merge-content">
      <el-form label-width="auto">
        <el-form-item :label="$t('git.sourceBranch', 'Source Branch')">
          <el-tag type="info">{{ mergeSourceBranch }}</el-tag>
        </el-form-item>
        <el-form-item :label="$t('git.targetBranch', 'Target Branch')">
          <el-select
            v-model="mergeTargetBranch"
            :placeholder="$t('git.selectTargetBranch', 'Select target branch')"
            filterable
            class="target-select"
          >
            <el-option
              v-for="branch in mainBranches"
              :key="branch.fullName"
              :label="branch.name"
              :value="branch.fullName"
            >
              <span>{{ branch.name }}</span>
              <el-tag v-if="branch.isCurrent" size="small" type="success" class="current-tag">
                {{ $t('git.current', 'Current') }}
              </el-tag>
            </el-option>
          </el-select>
        </el-form-item>
      </el-form>

      <el-alert
        v-if="mergeError"
        :title="mergeError"
        type="warning"
        show-icon
        :closable="false"
        class="merge-error"
      />

      <div v-if="mergeConflicts.length > 0" class="merge-conflicts">
        <el-alert
          :title="$t('git.mergeConflict', 'Merge Conflict')"
          type="warning"
          :description="$t('git.mergeConflictHint', { count: mergeConflicts.length })"
          show-icon
        />
        <ul class="conflict-list">
          <li v-for="file in mergeConflicts" :key="file">{{ file }}</li>
        </ul>
      </div>
    </div>
    <template #footer>
      <el-button @click="mergeDialogVisible = false">{{ $t('common.cancel') }}</el-button>
      <el-button
        type="primary"
        :disabled="!mergeTargetBranch || mergeLoading"
        @click="handleMerge"
      >
        {{ mergeLoading ? $t('git.merging', 'Merging...') : $t('git.mergeBranch', 'Merge') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Cpu, Document, Loading, Branch, Plus, Minus, Edit, QuestionFilled, View, Check, Connection } from '@element-plus/icons-vue'
import { createTask, updateTask, deleteTask } from '../api/task'
import { getAgents } from '../api/agent'
import { getActiveSessionByTask, getSessionHistory, createSession, deleteSession } from '../api/session'
import { getStatus, getDiff, mergeBranch, listBranches } from '../api/git'
import ChatBox from './ChatBox.vue'
import TaskForm from './task/TaskForm.vue'
import TaskHistory from './task/TaskHistory.vue'
import CommitDialog from './CommitDialog.vue'
import GitDiffViewer from './GitDiffViewer.vue'
import { useToast } from '../composables/ui/useToast'

const { t } = useI18n()
const toast = useToast()

const getApiData = (response, fallbackMessageKey) => {
  if (!response?.success) {
    throw new Error(response?.message || t(fallbackMessageKey))
  }

  return response?.data
}

const formatExecutorTypeLabel = (agent) => {
  const executorType = agent?.executorType || agent?.type
  if (!executorType) {
    return t('common.none')
  }

  return t(`agent.types.${executorType}`)
}

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
const diffData = ref(null)
const diffLoading = ref(false)
const selectedDiffFile = ref('')
const commitDialogVisible = ref(false)
const mergeDialogVisible = ref(false)
const mainBranches = ref([])
const mergeSourceBranch = ref('')
const mergeTargetBranch = ref('')
const mergeLoading = ref(false)
const mergeError = ref('')
const mergeConflicts = ref([])

const hasActiveSession = computed(() => {
  if (localSession.value) {
    const status = localSession.value.status
    return ['CREATED', 'RUNNING', 'IDLE'].includes(status)
  }
  return false
})

const taskDetailFileItems = computed(() => {
  const files = diffData.value?.files || []
  return files.map(file => ({
    path: file.path,
    displayName: file.path.replace(/\/+$/, '').split('/').pop() || file.path,
    status: ['modified', 'added', 'deleted', 'untracked'].includes(file.status) ? file.status : 'modified',
    additions: file.additions || 0,
    deletions: file.deletions || 0
  }))
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
    const loadedAgents = getApiData(response, 'agent.loadFailed')
    agents.value = Array.isArray(loadedAgents) ? loadedAgents : []
    console.log('[TaskDetail] Loaded agents:', agents.value.length)

    const sessionResponse = await getActiveSessionByTask(task.id)
    const activeSession = getApiData(sessionResponse, 'common.error')
    console.log('[TaskDetail] Active session response:', activeSession ? activeSession.id : null)
    if (activeSession) {
      localSession.value = activeSession
      selectedAgentId.value = activeSession.agentId
    } else if (agents.value.length > 0) {
      selectedAgentId.value = agents.value[0].id
      await createNewSession()
    }

    loadSessionHistory()
    loadGitStatus()
  } catch (e) {
    agents.value = []
    localSession.value = null
    selectedAgentId.value = null
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

  diffData.value = null
  selectedDiffFile.value = ''
  diffDialogVisible.value = true
  diffLoading.value = true

  try {
    const response = await getDiff(props.projectId, props.task.id)
    if (response.success && response.data) {
      diffData.value = response.data
      selectedDiffFile.value = response.data.files?.[0]?.path || ''
    } else {
      diffData.value = null
      selectedDiffFile.value = ''
      toast.error(response.message || t('git.diffFailed'))
    }
  } catch (e) {
    diffData.value = null
    selectedDiffFile.value = ''
    toast.apiError(e, t('git.diffFailed'))
  } finally {
    diffLoading.value = false
  }
}

const openCommitDialog = () => {
  commitDialogVisible.value = true
}

const handleCommitted = () => {
  loadGitStatus()
  toast.success(t('git.commitSuccess'))
}

const openMergeDialog = async () => {
  if (!gitStatus.value?.branch) return

  mergeSourceBranch.value = gitStatus.value.branch
  mergeTargetBranch.value = ''
  mergeError.value = ''
  mergeConflicts.value = []

  // 加载分支列表
  try {
    const response = await listBranches(props.projectId)
    if (response.success) {
      // 过滤出主分支（main, master, develop）
      mainBranches.value = response.data.filter(b => {
        const name = b.name.toLowerCase()
        return !b.isRemote && (name === 'main' || name === 'master' || name === 'develop' || name === 'dev')
      })
      // 如果没有找到主分支，显示所有非当前分支的本地分支
      if (mainBranches.value.length === 0) {
        mainBranches.value = response.data.filter(b => !b.isRemote && b.name !== gitStatus.value.branch)
      }
    }
  } catch (e) {
    console.error('Failed to load branches:', e)
  }

  mergeDialogVisible.value = true
}

const handleMerge = async () => {
  if (!mergeSourceBranch.value || !mergeTargetBranch.value) {
    return
  }

  mergeLoading.value = true
  mergeError.value = ''
  mergeConflicts.value = []

  try {
    const response = await mergeBranch(props.projectId, mergeSourceBranch.value, mergeTargetBranch.value)

    if (response.success) {
      toast.success(t('git.mergeSuccess', 'Branch merged successfully'))
      mergeDialogVisible.value = false
    } else if (response.data?.hasConflicts) {
      mergeConflicts.value = response.data.conflicts || []
      mergeError.value = t('git.mergeConflict', 'Merge conflicts detected')
    } else {
      toast.error(response.message || t('git.mergeFailed', 'Merge failed'))
    }
  } catch (e) {
    console.error('Merge failed:', e)
    toast.apiError(e, t('git.mergeFailed', 'Merge failed'))
  } finally {
    mergeLoading.value = false
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

.merge-content {
  padding: 10px 0;
}

.target-select {
  width: 100%;
}

.current-tag {
  margin-left: 8px;
}

.merge-error {
  margin-top: 16px;
}

.merge-conflicts {
  margin-top: 16px;
}

.conflict-list {
  margin: 12px 0 0 20px;
  padding: 0;
}

.conflict-list li {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 12px;
  color: #e6a23c;
  margin: 4px 0;
}
</style>
