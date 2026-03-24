<template>
  <div class="task-source-config">
    <div class="header">
      <h1>{{ $t('taskSource.title') }}</h1>
      <el-button v-if="selectedProjectId" type="primary" size="small" @click="showAddDialog">
        {{ $t('taskSource.add') }}
      </el-button>
    </div>

    <div class="project-selector">
      <label for="project">{{ $t('project.selectProject') }}:</label>
      <select id="project" v-model="selectedProjectId" @change="onProjectChange">
        <option value="">-- {{ $t('project.selectProject') }} --</option>
        <option v-for="project in projectStore.projectList" :key="project.id" :value="project.id">
          {{ project.name }}
        </option>
      </select>
    </div>

    <div v-if="selectedProjectId" class="task-sources-list">
      <div v-if="taskSourceStore.loading" class="loading">{{ $t('common.loading') }}</div>

      <div v-else-if="taskSourceStore.taskSources.length === 0" class="empty-state">
        {{ $t('taskSource.emptyState') }}
        <el-button type="primary" size="small" @click="showAddDialog">
          {{ $t('taskSource.addFirst') }}
        </el-button>
      </div>

      <div v-else class="sources-grid">
        <div v-for="source in taskSourceStore.taskSources" :key="source.id" class="source-card">
          <div class="source-header">
            <div>
              <h3>{{ source.name }}</h3>
              <div class="source-id">ID: {{ source.id }}</div>
            </div>
            <span class="source-type-badge">{{ getTypeLabel(source.type) }}</span>
          </div>

          <div class="source-details">
            <div class="detail-row">
              <span class="label">{{ $t('taskSource.lastSync') }}:</span>
              <span class="value">{{ formatDateTime(source.last_sync_at) || '-' }}</span>
            </div>
            <div class="detail-row">
              <span class="label">{{ $t('taskSource.status') }}:</span>
              <span class="value">{{ source.enabled ? $t('taskSource.enabled') : $t('taskSource.disabled') }}</span>
            </div>
          </div>

          <div class="source-actions">
            <el-button size="small" @click="previewAndSync(source)" :disabled="taskSourceStore.syncing">
              {{ taskSourceStore.syncing ? $t('taskSource.syncing', '同步中...') : $t('taskSource.sync') }}
            </el-button>
            <el-button size="small" @click="testSource(source)" :disabled="taskSourceStore.testing">
              {{ taskSourceStore.testing ? $t('taskSource.testing', '测试中...') : $t('taskSource.test') }}
            </el-button>
            <el-button size="small" @click="editSource(source)">
              {{ $t('taskSource.edit') }}
            </el-button>
            <el-button size="small" type="danger" @click="confirmDelete(source)">
              {{ $t('taskSource.delete') }}
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="select-project-prompt">
      {{ $t('project.noProject') }}
    </div>

    <!-- Add/Edit Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEditMode ? $t('taskSource.editTitle') : $t('taskSource.addTitle')"
      width="520px"
      class="task-source-dialog"
    >
      <div class="dialog-content">
        <el-form ref="formRef" :model="formData" :rules="formRules" label-position="top">
          <div class="form-section">
            <div class="section-title">基本信息</div>
            <el-form-item :label="$t('taskSource.name')" prop="name">
              <el-input v-model="formData.name" :placeholder="$t('taskSource.namePlaceholder')" clearable />
            </el-form-item>

            <el-form-item :label="$t('taskSource.type')" prop="type">
              <el-select v-model="formData.type" :disabled="isEditMode" @change="onTypeChange" placeholder="选择任务源类型">
                <el-option
                  v-for="type in taskSourceStore.availableTypes"
                  :key="type.key"
                  :label="type.name"
                  :value="type.key"
                >
                  <div class="type-option">
                    <span class="type-icon">{{ getTypeIcon(type.key) }}</span>
                    <span class="type-name">{{ type.name }}</span>
                  </div>
                </el-option>
              </el-select>
            </el-form-item>
          </div>

          <template v-if="selectedTypeConfig">
            <div class="form-section">
              <div class="section-title">配置信息</div>
              <el-form-item
                v-for="(field, key) in selectedTypeConfig.configFields"
                :key="key"
                :label="getFieldLabel(key, field)"
                :prop="`config.${key}`"
                :required="field.required"
              >
                <!-- State 字段使用下拉框 -->
                <el-select
                  v-if="key === 'state'"
                  v-model="formData.config[key]"
                  :placeholder="getFieldPlaceholder(key, field)"
                >
                  <el-option label="仅开放" value="open" />
                  <el-option label="仅关闭" value="closed" />
                  <el-option label="全部" value="all" />
                </el-select>
                <!-- array 类型使用多选下拉框 -->
                <el-select
                  v-else-if="field.type === 'array'"
                  v-model="formData.config[key]"
                  multiple
                  :placeholder="$t('taskSource.selectLabels')"
                >
                  <el-option
                    v-for="label in availableLabels[key]"
                    :key="label"
                    :label="label"
                    :value="label"
                  />
                </el-select>
                <!-- 默认使用输入框 -->
                <el-input
                  v-else
                  v-model="formData.config[key]"
                  :placeholder="getFieldPlaceholder(key, field)"
                  clearable
                />
              </el-form-item>
            </div>
          </template>

          <div class="form-section">
            <el-form-item :label="$t('taskSource.enabled')" prop="enabled">
              <el-switch v-model="formData.enabled" />
            </el-form-item>
          </div>
        </el-form>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">{{ $t('common.cancel') }}</el-button>
          <el-button type="primary" @click="submitForm" :disabled="submitting">
            {{ submitting ? $t('common.submitting', '提交中...') : $t('common.confirm') }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Sync Preview Dialog -->
    <el-dialog
      v-model="taskSourceStore.showPreviewDialog"
      :title="$t('taskSource.previewTitle')"
      width="650px"
      class="sync-preview-dialog"
    >
      <div v-if="taskSourceStore.syncPreviewTasks.length === 0 && !taskSourceStore.syncError" class="sync-preview-loading">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>{{ $t('common.loading') }}</span>
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
              <div v-if="task.description" class="item-description">
                {{ task.description.substring(0, 150) }}{{ task.description.length > 150 ? '...' : '' }}
              </div>
              <div class="item-meta">
                <span class="item-id">#{{ task.external_id }}</span>
                <span class="item-source">{{ task.sourceName }}</span>
                <a
                  v-if="task.external_url"
                  :href="task.external_url"
                  target="_blank"
                  class="external-link"
                  @click.stop
                >
                  {{ $t('taskSource.viewOnGitHub') }} →
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
    </el-dialog>

    <!-- Test Result Dialog -->
    <el-dialog
      v-model="testDialogVisible"
      :title="$t('taskSource.testResult')"
      width="400px"
    >
      <div v-if="testResult !== null">
        <el-result
          :icon="testResult ? 'success' : 'error'"
          :title="testResult ? $t('taskSource.connectionSuccess') : $t('taskSource.connectionFailed')"
        />
      </div>
      <template #footer>
        <el-button @click="testDialogVisible = false">{{ $t('common.close') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useProjectStore } from '../stores/projectStore'
import { useTaskSourceStore } from '../stores/taskSourceStore'
import { useTaskStore } from '../stores/taskStore'
import { ElMessageBox } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import { useToast } from '../composables/ui/useToast'

const { t } = useI18n()
const route = useRoute()
const projectStore = useProjectStore()
const taskSourceStore = useTaskSourceStore()
const taskStore = useTaskStore()
const toast = useToast()

// localStorage key for project selection persistence
const TASK_SOURCE_LAST_PROJECT_KEY = 'task-source-selected-project-id'

const selectedProjectId = ref('')

const dialogVisible = ref(false)
const isEditMode = ref(false)
const submitting = ref(false)
const formRef = ref(null)

const testDialogVisible = ref(false)
const testResult = ref(null)

const formData = ref({
  name: '',
  type: '',
  project_id: null,
  config: {},
  enabled: true
})

const formRules = {
  name: [{ required: true, message: t('taskSource.nameRequired'), trigger: 'blur' }],
  type: [{ required: true, message: t('taskSource.typeRequired'), trigger: 'change' }]
}

const availableLabels = ref({})

const selectedTypeConfig = computed(() => {
  if (!formData.value.type) return null
  return taskSourceStore.availableTypes.find(t => t.key === formData.value.type) || null
})

const formatDateTime = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString()
}

const getTypeLabel = (type) => {
  const translated = t(`taskSource.types.${type}`)
  const localizedLabel = translated === `taskSource.types.${type}` ? type : translated
  return localizedLabel === type ? type : `${type} · ${localizedLabel}`
}

const getTypeIcon = (type) => {
  const icons = {
    GITHUB: '🐙',
    JIRA: '📋',
    LINEAR: '📊'
  }
  return icons[type] || '📦'
}

const getFieldLabel = (key, field) => {
  const labels = {
    repo: '仓库',
    token: '访问令牌',
    state: 'Issue 状态',
    labels: '标签筛选',
    baseUrl: 'API 地址'
  }
  return labels[key] || field.description || key
}

const getFieldPlaceholder = (key, field) => {
  const placeholders = {
    repo: '例如: owner/repo',
    token: 'ghp_xxx...',
    state: '选择 Issue 状态',
    labels: '选择标签',
    baseUrl: 'https://gitlab.com/api/v4'
  }
  return placeholders[key] || field.description || ''
}

const loadProjects = async () => {
  try {
    await Promise.all([
      projectStore.fetchProjects(),
      taskSourceStore.loadAvailableTypes()
    ])

    // Get projectId from route or localStorage or first project
    const routeProjectId = route.params.projectId ? String(route.params.projectId) : null
    const storedProjectId = localStorage.getItem(TASK_SOURCE_LAST_PROJECT_KEY)

    let targetProjectId = routeProjectId || storedProjectId

    // Validate targetProjectId exists in projects list (compare as strings since localStorage stores strings)
    if (!targetProjectId || !projectStore.projectList.find(p => String(p.id) === targetProjectId)) {
      targetProjectId = projectStore.projectList[0]?.id ? String(projectStore.projectList[0].id) : ''
    }

    if (targetProjectId) {
      selectedProjectId.value = targetProjectId
      localStorage.setItem(TASK_SOURCE_LAST_PROJECT_KEY, targetProjectId)
      await taskSourceStore.fetchTaskSources(selectedProjectId.value)
    }
  } catch (e) {
    console.error('Failed to load projects:', e)
  }
}

const onProjectChange = async () => {
  if (selectedProjectId.value) {
    localStorage.setItem(TASK_SOURCE_LAST_PROJECT_KEY, selectedProjectId.value)
    await taskSourceStore.fetchTaskSources(selectedProjectId.value)
  } else {
    taskSourceStore.clearTaskSources()
  }
}

const onTypeChange = () => {
  // Reset config when type changes
  formData.value.config = {}
}

// Convert git_url (https://github.com/owner/repo.git) to owner/repo format
const gitUrlToRepo = (gitUrl) => {
  if (!gitUrl) return ''
  // Match both https://github.com/owner/repo.git and git@github.com:owner/repo.git
  const match = gitUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/)
  if (match) return `${match[1]}/${match[2]}`
  // If already in owner/repo format, return as-is
  return gitUrl
}

const showAddDialog = () => {
  isEditMode.value = false

  // Get current project's git_url and convert to owner/repo format
  const currentProject = projectStore.projectList.find(p => String(p.id) === selectedProjectId.value)
  const gitUrl = currentProject?.git_url || ''
  const defaultRepo = gitUrlToRepo(gitUrl)

  formData.value = {
    name: '',
    type: taskSourceStore.availableTypes.length > 0 ? taskSourceStore.availableTypes[0].key : '',
    project_id: selectedProjectId.value,
    config: {
      repo: defaultRepo,
      state: 'open'
    },
    enabled: true
  }
  dialogVisible.value = true
}

const editSource = (source) => {
  isEditMode.value = true
  formData.value = {
    id: source.id,
    name: source.name,
    type: source.type,
    project_id: source.project_id,
    config: { ...source.config },
    enabled: source.enabled
  }
  dialogVisible.value = true
}

const submitForm = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
    submitting.value = true

    if (isEditMode.value) {
      await taskSourceStore.updateTaskSource(formData.value.id, formData.value)
      toast.success(t('taskSource.updateSuccess'))
    } else {
      await taskSourceStore.createTaskSource(formData.value)
      toast.success(t('taskSource.createSuccess'))
    }

    dialogVisible.value = false
  } catch (e) {
    if (e !== false) { // Validation errors return false
      console.error('Failed to save task source:', e)
    }
  } finally {
    submitting.value = false
  }
}

const confirmDelete = (source) => {
  ElMessageBox.confirm(
    t('taskSource.deleteConfirm', { name: source.name }),
    t('taskSource.deleteConfirmTitle'),
    {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    }
  ).then(async () => {
    try {
      await taskSourceStore.deleteTaskSource(source.id)
      toast.success(t('taskSource.deleteSuccess'))
    } catch (e) {
      console.error('Failed to delete task source:', e)
    }
  }).catch(() => {})
}

// Preview and import tasks from a source
const previewAndSync = async (source) => {
  try {
    const tasks = await taskSourceStore.openSyncPreviewForSource(source)
    if (tasks.length === 0) {
      taskSourceStore.closePreviewDialog()
    }
  } catch (err) {
    console.error('Failed to sync task source:', err)
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
    const totalImported = await taskSourceStore.importSelectedPreviewTasks(selectedProjectId.value)
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

const testSource = async (source) => {
  testResult.value = null
  testDialogVisible.value = true

  try {
    const response = await taskSourceStore.testTaskSource(source.id)
    if (response && response.success) {
      testResult.value = response.data?.connected || false
    } else {
      testResult.value = false
    }
  } catch (e) {
    testResult.value = false
  }
}

onMounted(loadProjects)
</script>

<style scoped>
.task-source-config {
  padding: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.header h1 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.project-selector {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--bg-primary);
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.project-selector label {
  font-weight: 500;
  color: var(--text-secondary);
  font-size: 12px;
  margin: 0;
  white-space: nowrap;
}

.project-selector select {
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  min-width: 200px;
  font-size: 13px;
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.project-selector select:hover {
  border-color: var(--accent-color);
}

.project-selector select:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
}

.task-sources-list {
  background: var(--bg-secondary);
  flex: 1;
  overflow: auto;
}

.loading, .empty-state, .select-project-prompt {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary);
  font-size: 13px;
  background: var(--bg-secondary);
}

.sources-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 16px;
  padding: 16px;
  background: var(--bg-secondary);
}

.source-card {
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid var(--border-color);
  transition: all 0.2s;
  position: relative;
}

.source-card:hover {
  border-color: var(--accent-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.source-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color);
  gap: 12px;
}

.source-header h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.source-id {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-secondary);
  word-break: break-all;
}

.source-type-badge {
  background: var(--accent-color);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  color: white;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  white-space: nowrap;
}

.source-details {
  background: var(--bg-tertiary);
  padding: 8px;
  border-radius: 6px;
  margin-bottom: 10px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  padding: 2px 0;
  gap: 12px;
}

.detail-row .label {
  color: var(--text-secondary);
  font-weight: 500;
}

.detail-row .value {
  color: var(--text-primary);
  font-weight: 500;
  text-align: right;
}

.source-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* Sync Preview Dialog */
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
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lightest);
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
  flex-shrink: 0;
  padding-top: 2px;
}

.item-checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
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
  color: var(--text-primary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-status {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
  flex-shrink: 0;
}

.item-status.todo {
  background: var(--el-color-info-light-9);
  color: var(--el-color-info);
}

.item-status.in_progress {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}

.item-status.done {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.item-status.blocked {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.imported-badge {
  display: inline-block;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
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
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
}

.item-description {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
  line-height: 1.4;
}

.item-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}

.item-id {
  font-family: monospace;
}

.external-link {
  color: var(--el-color-primary);
  text-decoration: none;
}

.external-link:hover {
  text-decoration: underline;
}

.sync-preview-empty {
  text-align: center;
  padding: 40px;
  color: var(--el-text-color-placeholder);
}

.empty-state {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
}

/* Dialog Styling */
:deep(.task-source-dialog) {
  .el-dialog__header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color);
    margin-right: 0;
  }

  .el-dialog__title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .el-dialog__body {
    padding: 0;
  }

  .el-dialog__footer {
    padding: 12px 20px;
    border-top: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }
}

.dialog-content {
  padding: 16px 20px;
}

.form-section {
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.type-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
}

.type-icon {
  font-size: 16px;
}

.type-name {
  font-size: 13px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

:deep(.el-form-item) {
  margin-bottom: 14px;

  &:last-child {
    margin-bottom: 0;
  }
}

:deep(.el-form-item__label) {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  padding-bottom: 4px;
}

:deep(.el-input__inner) {
  font-size: 13px;
}

:deep(.el-select) {
  width: 100%;
}
</style>
