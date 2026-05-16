<template>
  <div v-if="visible" class="task-source-panel">
    <div class="panel-body">
      <div v-if="taskSourceStore.loading" class="loading">{{ $t('common.loading', '加载中...') }}</div>

      <div v-else-if="taskSourceStore.taskSources.length === 0" class="empty-state">
        <div class="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
        </div>
        <div class="empty-text">{{ $t('taskSource.emptyState', '暂无任务源') }}</div>
        <el-button type="primary" size="default" @click="showAddDialog">
          {{ $t('taskSource.addFirst', '添加第一个任务源') }}
        </el-button>
      </div>

      <div v-else class="sources-grid">
        <TaskSourceCard
          v-for="source in taskSourceStore.taskSources"
          :key="source.id"
          :source="source"
          :syncing="taskSourceStore.syncing"
          @sync="handleSync"
          @sync-history="openSyncHistory"
          @edit="editSource"
          @delete="confirmDelete"
        />
        <button class="source-card source-card-add" @click="showAddDialog">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>{{ $t('taskSource.add', '添加任务源') }}</span>
        </button>
      </div>
    </div>

    <!-- Add/Edit Dialog -->
    <TaskSourceFormDialog
      v-model:visible="dialogVisible"
      :is-edit-mode="isEditMode"
      :submitting="submitting"
      :form-data="formData"
      :custom-cron="customCronExpression"
      :available-types="taskSourceStore.availableTypes"
      :agents="agentStore.agents"
      :workflow-templates="workflowTemplateStore.templates"
      :available-labels="availableLabels"
      :form-rules="formRules"
      @type-change="onTypeChange"
      @update:custom-cron="customCronExpression = $event"
      @submit="handleFormSubmit"
    />

    <!-- Sync Preview Dialog -->
    <SyncPreviewDialog
      v-model:visible="taskSourceStore.showPreviewDialog"
      :loading="taskSourceStore.syncing"
      :sync-error="taskSourceStore.syncError"
      :sync-preview-tasks="taskSourceStore.syncPreviewTasks"
      :selected-tasks="taskSourceStore.selectedSyncTasks"
      :expanded-descriptions="expandedPreviewDescriptions"
      @toggle-task="toggleSyncTask"
      @select-all="selectAllSyncTasks"
      @deselect-all="deselectAllSyncTasks"
      @confirm-import="confirmSyncImport"
      @close="closeSyncPreview"
      @toggle-description="toggleDescription"
    />

    <!-- AI Preview Dialog -->
    <AiPreviewDialog
      v-model:visible="taskSourceStore.aiPreviewDialog"
      :step="taskSourceStore.aiPreviewStep"
      :processing="taskSourceStore.aiPreviewProcessing"
      :loading="taskSourceStore.aiPreviewLoading"
      :error="taskSourceStore.aiPreviewError"
      :all-fallback="taskSourceStore.aiPreviewAllFallback"
      :prompt="taskSourceStore.aiPreviewPrompt"
      :files="taskSourceStore.aiPreviewFiles"
      :results="taskSourceStore.aiPreviewResults"
      :selected="taskSourceStore.aiPreviewSelected"
      :workflow-templates="workflowTemplateStore.templates"
      @update:prompt="taskSourceStore.aiPreviewPrompt = $event"
      @execute="executeAiPreviewAndSync"
      @confirm-import="confirmAiPreviewAndImport"
      @close="taskSourceStore.closeAiPreviewDialog()"
      @select-all="selectAllAiResults"
      @deselect-all="deselectAllAiResults"
      @toggle-ai-item="taskSourceStore.toggleAiPreviewItem($event)"
    />

    <!-- Sync History Dialog -->
    <SyncHistoryDialog
      v-model:visible="syncHistoryDialogVisible"
      :loading="taskSourceStore.syncHistoryLoading"
      :history="taskSourceStore.syncHistory"
      :pagination="taskSourceStore.syncHistoryPagination"
      @view-analysis="viewAnalysis"
      @page-change="handleSyncHistoryPageChange"
      @size-change="handleSyncHistoryPageSizeChange"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '../../stores/projectStore'
import { useTaskSourceStore } from '../../stores/taskSourceStore'
import { useTaskStore } from '../../stores/taskStore'
import { useAgentStore } from '../../stores/agentStore'
import { useWorkflowTemplateStore } from '../../stores/workflowTemplateStore'
import { ElMessageBox } from 'element-plus'
import { useToast } from '../../composables/ui/useToast'
import TaskSourceCard from './TaskSourceCard.vue'
import TaskSourceFormDialog from './TaskSourceFormDialog.vue'
import SyncPreviewDialog from './SyncPreviewDialog.vue'
import AiPreviewDialog from './AiPreviewDialog.vue'
import SyncHistoryDialog from './SyncHistoryDialog.vue'

const props = defineProps({
  projectId: { type: String, default: '' },
  visible: { type: Boolean, default: false }
})

const emit = defineEmits(['update:visible', 'tasks-imported'])

const { t } = useI18n()
const projectStore = useProjectStore()
const taskSourceStore = useTaskSourceStore()
const taskStore = useTaskStore()
const agentStore = useAgentStore()
const workflowTemplateStore = useWorkflowTemplateStore()
const toast = useToast()

const dialogVisible = ref(false)
const isEditMode = ref(false)
const submitting = ref(false)

const syncHistoryDialogVisible = ref(false)
const currentSourceId = ref(null)

const expandedPreviewDescriptions = ref(new Set())

const availableLabels = ref({})

const customCronExpression = ref('')

const formData = ref({
  name: '',
  type: '',
  project_id: null,
  config: {},
  enabled: true,
  sync_schedule: null,
  default_workflow_template_id: null,
})

const formRules = {
  name: [{ required: true, message: '请输入任务源名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择任务源类型', trigger: 'change' }]
}

// --- Data loading ---
const loadData = async () => {
  if (!props.projectId) return
  await Promise.all([
    taskSourceStore.fetchTaskSources(props.projectId),
    taskSourceStore.loadAvailableTypes()
  ])
  await taskSourceStore.fetchAllScheduleStatuses()
}

watch(() => props.visible, async (newVal) => {
  if (newVal) {
    taskSourceStore.closePreviewDialog()
    await loadData()
  }
})

onMounted(() => {
  if (props.visible && props.projectId) {
    loadData()
  }
})

watch(() => props.projectId, async (newVal) => {
  if (props.visible && newVal) {
    await loadData()
  }
})

// Auto-match scenario tags to template IDs when AI results load
watch(() => taskSourceStore.aiPreviewResults, (results) => {
  const allTags = [...new Set(workflowTemplateStore.templates.flatMap(t => t.tags || []))]
  for (const r of results) {
    if (r.scenarioTag && !r.recommendedWorkflowTemplateId && allTags.includes(r.scenarioTag)) {
      const matched = workflowTemplateStore.templates.find(t => (t.tags || []).includes(r.scenarioTag))
      if (matched) {
        r.recommendedWorkflowTemplateId = matched.template_id
      }
    }
  }
}, { deep: false })

// --- Collapse ---
const handleCollapse = () => {
  taskSourceStore.closePreviewDialog()
  emit('update:visible', false)
}

// --- Form ---
const buildDefaultConfig = (typeKey) => {
  const typeConfig = taskSourceStore.availableTypes.find(type => type.key === typeKey)
  const defaults = {}

  if (!typeConfig?.configFields) {
    return defaults
  }

  Object.entries(typeConfig.configFields).forEach(([key, field]) => {
    if (field?.default !== undefined) {
      defaults[key] = field.default
    } else if (field?.type === 'array') {
      defaults[key] = []
    }
  })

  return defaults
}

const onTypeChange = () => {
  formData.value.config = buildDefaultConfig(formData.value.type)
}

const gitUrlToRepo = (gitUrl) => {
  if (!gitUrl) return ''
  const match = gitUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/)
  if (match) return `${match[1]}/${match[2]}`
  return gitUrl
}

const showAddDialog = () => {
  isEditMode.value = false
  agentStore.fetchAgents()

  const currentProject = projectStore.projectList.find(p => String(p.id) === props.projectId)
  const gitUrl = currentProject?.git_url || ''
  const defaultRepo = gitUrlToRepo(gitUrl)
  const type = taskSourceStore.availableTypes.length > 0 ? taskSourceStore.availableTypes[0].key : ''
  const defaultConfig = buildDefaultConfig(type)

  if (defaultRepo && type === 'GITHUB') {
    defaultConfig.repo = defaultRepo
  }

  formData.value = {
    name: '',
    type,
    project_id: props.projectId,
    config: defaultConfig,
    enabled: true,
    sync_schedule: null,
    default_workflow_template_id: null,
  }
  customCronExpression.value = ''
  dialogVisible.value = true
  loadWorkflowTemplates()
}

const editSource = (source) => {
  isEditMode.value = true
  agentStore.fetchAgents()
  const config = { ...source.config }

  if (typeof config.token === 'string' && config.token) {
    config.token = '****'
  }

  const presetCrons = ['*/5 * * * *', '*/15 * * * *', '*/30 * * * *', '0 * * * *', '0 */6 * * *', '0 0 * * *']
  let scheduleValue = source.sync_schedule || null
  let customCron = ''

  if (scheduleValue && !presetCrons.includes(scheduleValue)) {
    customCron = scheduleValue
    scheduleValue = '__custom__'
  }

  formData.value = {
    id: source.id,
    name: source.name,
    type: source.type,
    project_id: source.project_id,
    config,
    enabled: source.enabled,
    sync_schedule: scheduleValue,
    default_workflow_template_id: source.default_workflow_template_id || null,
  }
  customCronExpression.value = customCron
  dialogVisible.value = true
  loadWorkflowTemplates()
}

const sanitizeTokenForSubmit = (payload, originalSource) => {
  if (!payload?.config || typeof payload.config !== 'object') {
    return payload
  }

  if (payload.config.token !== '****') {
    return payload
  }

  const nextPayload = {
    ...payload,
    config: { ...payload.config }
  }

  if (originalSource?.config && typeof originalSource.config.token === 'string') {
    nextPayload.config.token = originalSource.config.token
  } else {
    delete nextPayload.config.token
  }

  return nextPayload
}

const findCurrentSource = (sourceId) => {
  return taskSourceStore.taskSources.find(source => source.id === sourceId) || null
}

const handleFormSubmit = async (formRef) => {
  if (!formRef) return

  try {
    await formRef.validate()
    submitting.value = true

    const payload = { ...formData.value }

    if (payload.sync_schedule === '__custom__') {
      payload.sync_schedule = customCronExpression.value || null
    }

    if (isEditMode.value) {
      const currentSource = findCurrentSource(payload.id)
      const sanitized = sanitizeTokenForSubmit(payload, currentSource)
      await taskSourceStore.updateTaskSource(payload.id, sanitized)
      toast.success('更新成功')
    } else {
      await taskSourceStore.createTaskSource(payload)
      toast.success('创建成功')
    }

    dialogVisible.value = false
  } catch (e) {
    if (e !== false) {
      console.error('Failed to save task source:', e)
    }
  } finally {
    submitting.value = false
  }
}

const confirmDelete = (source) => {
  ElMessageBox.confirm(
    `确定要删除任务源 "${source.name}" 吗？`,
    '确认删除',
    {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      await taskSourceStore.deleteTaskSource(source.id)
      toast.success('删除成功')
    } catch (e) {
      console.error('Failed to delete task source:', e)
    }
  }).catch(() => {})
}

// --- Sync ---
const handleSync = async (source) => {
  const isLocalAiMode = source.type === 'LOCAL_DIRECTORY' && source.config?.descriptionMode === 'ai'
  if (isLocalAiMode) {
    loadWorkflowTemplates()
    try {
      const opened = await taskSourceStore.openAiPreview(source.id)
      if (!opened) {
        toast.info(t('taskSource.noNewFiles', '没有新文件'))
      }
    } catch (err) {
      console.error('Failed to open AI preview:', err)
      toast.error('预览失败: ' + (err.message || '未知错误'))
    }
  } else {
    await previewAndSync(source)
  }
}

const previewAndSync = async (source) => {
  try {
    const tasks = await taskSourceStore.openSyncPreviewForSource(source)
    if (tasks.length === 0) {
      taskSourceStore.closePreviewDialog()
    }
  } catch (err) {
    console.error('Failed to sync task source:', err)
    toast.error('同步失败: ' + (err.message || '未知错误'))
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
    const totalImported = await taskSourceStore.importSelectedPreviewTasks(props.projectId)
    await taskStore.fetchTasks(props.projectId)
    if (totalImported > 0) {
      toast.success(`成功导入 ${totalImported} 个任务`)
    }
    emit('tasks-imported')
  } catch (err) {
    console.error('Failed to import tasks:', err)
    toast.error('导入失败')
  }
}

const closeSyncPreview = () => {
  taskSourceStore.closePreviewDialog()
}

const openSyncHistory = async (source) => {
  syncHistoryDialogVisible.value = true
  currentSourceId.value = source.id
  taskSourceStore.syncHistoryPagination.page = 1
  await taskSourceStore.fetchSyncHistory(source.id, 1)
}

const handleSyncHistoryPageChange = (page) => {
  taskSourceStore.syncHistoryPagination.page = page
  taskSourceStore.fetchSyncHistory(currentSourceId.value, page)
}

const handleSyncHistoryPageSizeChange = (pageSize) => {
  taskSourceStore.syncHistoryPagination.pageSize = pageSize
  taskSourceStore.syncHistoryPagination.page = 1
  taskSourceStore.fetchSyncHistory(currentSourceId.value, 1)
}

const testSource = async (source) => {
  try {
    const result = await taskSourceStore.testTaskSource(source.id)
    toast.success(result?.data?.message || '连接测试成功')
  } catch (err) {
    toast.error('连接测试失败: ' + (err.message || '未知错误'))
  }
}

const viewAnalysis = async (sessionId) => {
  syncHistoryDialogVisible.value = false
  await loadWorkflowTemplates()
  await taskSourceStore.reopenAiResults(currentSourceId.value, sessionId)
}

// --- Description expand/collapse ---
const toggleDescription = (externalId) => {
  const newSet = new Set(expandedPreviewDescriptions.value)
  if (newSet.has(externalId)) {
    newSet.delete(externalId)
  } else {
    newSet.add(externalId)
  }
  expandedPreviewDescriptions.value = newSet
}

const loadWorkflowTemplates = async () => {
  try {
    await workflowTemplateStore.fetchTemplates()
  } catch (e) {
    console.warn('Failed to load workflow templates:', e)
  }
}

const executeAiPreviewAndSync = async () => {
  try {
    await taskSourceStore.startAiPreview()
    toast.info(t('taskSource.aiProcessingInBackground', 'AI 正在后台分析，可关闭对话框稍后查看'))
  } catch (err) {
    console.error('Failed to start AI preview:', err)
    toast.error('AI 分析启动失败: ' + (err.message || '未知错误'))
  }
}

const confirmAiPreviewAndImport = async () => {
  try {
    const result = await taskSourceStore.confirmAiPreviewImport()
    if (result?.created > 0) {
      toast.success(`成功导入 ${result.created} 个任务`)
      await taskStore.fetchTasks(props.projectId)
      emit('tasks-imported')
    } else {
      toast.info('没有新任务被创建')
    }
  } catch (err) {
    console.error('Confirm import failed:', err)
    toast.error('导入失败: ' + (err.message || '未知错误'))
  }
}

const selectAllAiResults = () => {
  taskSourceStore.aiPreviewSelected = new Set(
    taskSourceStore.aiPreviewResults.map(r => r.externalId)
  )
}

const deselectAllAiResults = () => {
  taskSourceStore.aiPreviewSelected = new Set()
}
</script>

<style scoped>
.task-source-panel {
  background: var(--bg-primary);
}

.panel-body {
  width: 100%;
}

.loading, .empty-state {
  width: 100%;
  text-align: center;
  padding: 48px 20px;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.empty-state {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
}

.empty-icon {
  color: var(--text-muted);
  opacity: 0.6;
}

.empty-text {
  font-size: 14px;
  color: var(--text-secondary);
}

.sources-grid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.source-card-add {
  min-height: 180px;
  background: transparent;
  border: 1px dashed var(--border-color);
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  transition: all 0.15s;
}

.source-card-add:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
  background: var(--accent-color-soft);
}

.source-card-add svg {
  opacity: 0.7;
}

.source-card-add:hover svg {
  opacity: 1;
}
</style>
