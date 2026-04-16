<template>
  <div v-if="visible" class="task-source-panel">
    <div class="panel-header">
      <span class="panel-title">{{ $t('taskSource.manageTitle', '任务源管理') }}</span>
      <div class="panel-actions">
        <el-button class="add-source-btn" type="primary" size="small" @click="showAddDialog">
          {{ $t('taskSource.add', '添加任务源') }}
        </el-button>
        <el-button class="collapse-btn" size="small" @click="handleCollapse">
          {{ $t('taskSource.collapse', '收起') }} ▲
        </el-button>
      </div>
    </div>

    <div v-if="taskSourceStore.loading" class="loading">{{ $t('common.loading', '加载中...') }}</div>

    <div v-else-if="taskSourceStore.taskSources.length === 0" class="empty-state">
      {{ $t('taskSource.emptyState', '暂无任务源') }}
      <el-button type="primary" size="small" @click="showAddDialog">
        {{ $t('taskSource.addFirst', '添加第一个任务源') }}
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
            <span class="label">{{ $t('taskSource.lastSync', '最后同步') }}:</span>
            <span class="value">{{ formatDateTimeWithFallback(source.last_sync_at) }}</span>
          </div>
          <div class="detail-row">
            <span class="label">{{ $t('taskSource.status', '状态') }}:</span>
            <span class="value">{{ source.enabled ? $t('taskSource.enabled', '已启用') : $t('taskSource.disabled', '已禁用') }}</span>
          </div>
        </div>

        <div v-if="source.sync_schedule" class="source-schedule-badge">
          <span class="schedule-dot"></span>
          <span class="schedule-text">{{ formatScheduleLabel(source.sync_schedule) }}</span>
        </div>

        <div class="source-actions">
          <el-button size="small" @click="handleSync(source)" :disabled="taskSourceStore.syncing">
            {{ taskSourceStore.syncing ? '同步中...' : $t('taskSource.sync', '同步') }}
          </el-button>
          <el-button size="small" @click="openSyncHistory(source)">
            {{ $t('taskSource.syncHistory', '同步历史') }}
          </el-button>
          <el-button size="small" @click="editSource(source)">
            {{ $t('taskSource.edit', '编辑') }}
          </el-button>
          <el-button size="small" type="danger" @click="confirmDelete(source)">
            {{ $t('taskSource.delete', '删除') }}
          </el-button>
        </div>
      </div>
    </div>

    <!-- Add/Edit Dialog -->
    <BaseDialog
      v-model="dialogVisible"
      :title="isEditMode ? $t('taskSource.editTitle', '编辑任务源') : $t('taskSource.addTitle', '添加任务源')"
      width="520px"
      custom-class="task-source-dialog"
      :body-padding="false"
      append-to-body
    >
      <div class="dialog-content">
        <el-form ref="formRef" :model="formData" :rules="formRules" label-position="top" size="small">
          <div class="form-section">
            <div class="section-title">基本信息</div>
            <el-form-item :label="$t('taskSource.name', '名称')" prop="name">
              <el-input v-model="formData.name" :placeholder="$t('taskSource.namePlaceholder', '输入任务源名称')" clearable />
            </el-form-item>

            <el-form-item :label="$t('taskSource.type', '类型')" prop="type">
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
              <template
                v-for="(field, key) in selectedTypeConfig.configFields"
                :key="key"
              >
                <el-form-item
                  v-if="field && !field.hidden && !isFieldHidden(key)"
                  :label="getFieldLabel(key, field)"
                  :prop="`config.${key}`"
                  :required="field.required"
                >
                  <el-input
                    v-if="key === 'token'"
                    v-model="formData.config[key]"
                    type="password"
                    :placeholder="getFieldPlaceholder(key, field)"
                  />
                  <el-select
                    v-else-if="key === 'state'"
                    v-model="formData.config[key]"
                    :placeholder="getFieldPlaceholder(key, field)"
                  >
                    <el-option label="仅开放" value="open" />
                    <el-option label="仅关闭" value="closed" />
                    <el-option label="全部" value="all" />
                  </el-select>
                  <el-select
                    v-else-if="field.type === 'array'"
                    v-model="formData.config[key]"
                    multiple
                    :placeholder="$t('taskSource.selectLabels', '选择标签')"
                  >
                    <el-option
                      v-for="label in availableLabels[key]"
                      :key="label"
                      :label="label"
                      :value="label"
                    />
                  </el-select>
                  <el-switch
                    v-else-if="field.type === 'boolean'"
                    v-model="formData.config[key]"
                  />
                  <el-select
                    v-else-if="field.options && field.options.length > 0"
                    v-model="formData.config[key]"
                    :placeholder="getFieldPlaceholder(key, field)"
                  >
                    <el-option
                      v-for="opt in field.options"
                      :key="opt.value"
                      :label="opt.label"
                      :value="opt.value"
                    />
                  </el-select>
                  <el-select
                    v-else-if="key === 'agentId'"
                    v-model="formData.config[key]"
                    :placeholder="getFieldPlaceholder(key, field)"
                    clearable
                  >
                    <el-option
                      v-for="agent in agents"
                      :key="agent.id"
                      :label="agent.name"
                      :value="agent.id"
                    />
                  </el-select>
                  <el-input
                    v-else
                    v-model="formData.config[key]"
                    :placeholder="getFieldPlaceholder(key, field)"
                    clearable
                  />
                </el-form-item>
              </template>
            </div>
          </template>

          <div class="form-section">
            <el-form-item :label="$t('taskSource.enabled', '启用')" prop="enabled">
              <el-switch v-model="formData.enabled" />
            </el-form-item>
          </div>

          <div class="form-section">
            <el-form-item :label="$t('taskSource.syncFrequency', '同步频率')">
              <el-select v-model="formData.sync_schedule" clearable :placeholder="$t('taskSource.scheduleDisabled', '不启用')">
                <el-option :label="$t('taskSource.scheduleDisabled', '不启用')" :value="null" />
                <el-option label="每 5 分钟" value="*/5 * * * *" />
                <el-option label="每 15 分钟" value="*/15 * * * *" />
                <el-option label="每 30 分钟" value="*/30 * * * *" />
                <el-option label="每小时" value="0 * * * *" />
                <el-option label="每 6 小时" value="0 */6 * * *" />
                <el-option label="每天" value="0 0 * * *" />
                <el-option label="自定义" value="__custom__" />
              </el-select>
              <el-input
                v-if="formData.sync_schedule === '__custom__'"
                v-model="customCronExpression"
                style="margin-top: 8px;"
                :placeholder="$t('taskSource.scheduleCustomPlaceholder', '输入 cron 表达式')"
              />
            </el-form-item>

            <el-form-item v-if="formData.sync_schedule && formData.sync_schedule !== '__custom__'" :label="$t('taskSource.defaultWorkflowTemplate', '默认工作流模板')">
              <el-select v-model="formData.default_workflow_template_id" :placeholder="$t('taskSource.autoWorkflowNone', '不自动触发')" clearable style="width: 100%;">
                <el-option
                  v-for="tpl in workflowTemplates"
                  :key="tpl.template_id"
                  :label="tpl.name"
                  :value="tpl.template_id"
                />
              </el-select>
            </el-form-item>
          </div>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ $t('common.cancel', '取消') }}</el-button>
        <el-button type="primary" @click="submitForm" :disabled="submitting">
          {{ submitting ? '提交中...' : $t('common.confirm', '确认') }}
        </el-button>
      </template>
    </BaseDialog>

    <!-- Sync Preview Dialog -->
    <BaseDialog
      v-model="taskSourceStore.showPreviewDialog"
      :title="$t('taskSource.previewTitle', '同步预览')"
      width="650px"
      custom-class="sync-preview-dialog"
      append-to-body
    >
      <div v-if="taskSourceStore.syncPreviewTasks.length === 0 && !taskSourceStore.syncError" class="sync-preview-loading">
        <span>{{ $t('common.loading', '加载中...') }}</span>
      </div>
      <div v-else-if="taskSourceStore.syncError" class="sync-preview-error">
        {{ taskSourceStore.syncError }}
      </div>
      <div v-else>
        <div class="sync-preview-controls">
          <el-button size="small" @click="selectAllSyncTasks">{{ $t('taskSource.selectAll', '全选') }}</el-button>
          <el-button size="small" @click="deselectAllSyncTasks">{{ $t('taskSource.deselectAll', '取消全选') }}</el-button>
          <span class="selected-count">
            {{ taskSourceStore.selectedSyncTasks.size }} / {{ taskSourceStore.syncPreviewTasks.filter(t => !t.imported).length }} {{ $t('taskSource.selected', '已选') }}
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
              <span v-if="task.imported" class="imported-badge">{{ $t('taskSource.imported', '已导入') }}</span>
              <div class="item-labels" v-if="task.labels && task.labels.length > 0">
                <span v-for="label in task.labels.slice(0, 5)" :key="label" class="label-badge">{{ label }}</span>
              </div>
              <div v-if="task.description" class="item-description-wrapper">
                <div
                  :ref="el => setDescriptionRef(el, task.external_id)"
                  class="item-description"
                  :class="{ expanded: expandedPreviewDescriptions.has(task.external_id) }"
                  v-html="formatTaskDescription(task.description || '')"
                ></div>
                <button
                  v-if="descriptionOverflow(task.external_id) || expandedPreviewDescriptions.has(task.external_id)"
                  class="description-toggle-btn"
                  @click.stop="toggleDescription(task.external_id)"
                >
                  {{ expandedPreviewDescriptions.has(task.external_id) ? '收起 ↑' : '展开 ↓' }}
                </button>
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
                  {{ $t('taskSource.viewExternalItem', '查看外部条目') }} →
                </a>
              </div>
            </div>
          </div>
          <div v-if="taskSourceStore.syncPreviewTasks.length === 0" class="sync-preview-empty">
            {{ $t('taskSource.noTasksToImport', '没有可导入的任务') }}
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="closeSyncPreview">{{ $t('common.cancel', '取消') }}</el-button>
        <el-button
          type="primary"
          @click="confirmSyncImport"
          :disabled="taskSourceStore.selectedSyncTasks.size === 0"
        >
          {{ $t('taskSource.confirmImport', '确认导入') }} ({{ taskSourceStore.selectedSyncTasks.size }})
        </el-button>
      </template>
    </BaseDialog>

    <!-- Sync History Dialog -->
    <BaseDialog
      v-model="syncHistoryDialogVisible"
      :title="$t('taskSource.syncHistoryTitle', '同步历史')"
      width="600px"
      append-to-body
    >
      <div v-if="taskSourceStore.syncHistoryLoading" class="sync-history-loading">
        {{ $t('taskSource.syncHistoryLoading', '加载中...') }}
      </div>
      <div v-else-if="taskSourceStore.syncHistory.length === 0" class="sync-history-empty">
        {{ $t('taskSource.syncHistoryEmpty', '暂无同步记录') }}
      </div>
      <el-table v-else :data="taskSourceStore.syncHistory" size="small" stripe>
        <el-table-column :label="$t('taskSource.syncHistoryTime', '时间')" prop="startedAt" width="180">
          <template #default="{ row }">
            {{ row.startedAt ? new Date(row.startedAt).toLocaleString() : '-' }}
          </template>
        </el-table-column>
        <el-table-column :label="$t('taskSource.syncHistoryMode', '模式')" width="80">
          <template #default="{ row }">
            <el-tag :type="row.mode === 'ai' ? 'success' : 'info'" size="small">
              {{ row.mode === 'ai' ? $t('taskSource.syncHistoryModeAi', 'AI') : $t('taskSource.syncHistoryModeFixed', '固定') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('taskSource.syncHistoryFiles', '文件数')" prop="fileCount" width="80" />
        <el-table-column :label="$t('taskSource.syncHistoryStatus', '状态')" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'COMPLETED' ? 'success' : row.status === 'FAILED' ? 'danger' : 'warning'" size="small">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('taskSource.syncHistoryViewAnalysis', '查看分析')" width="100">
          <template #default="{ row }">
            <el-button v-if="row.mode === 'ai'" link type="primary" size="small" @click="viewAnalysis(row.sessionId)">
              {{ $t('taskSource.syncHistoryViewAnalysis', '查看分析') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="syncHistoryDialogVisible = false">{{ $t('common.close', '关闭') }}</el-button>
      </template>
    </BaseDialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '../../stores/projectStore'
import { useTaskSourceStore } from '../../stores/taskSourceStore'
import { useTaskStore } from '../../stores/taskStore'
import BaseDialog from '../BaseDialog.vue'
import { ElMessageBox } from 'element-plus'
import { formatTaskDescription } from '../../utils/taskDescriptionFormatter'
import { useToast } from '../../composables/ui/useToast'
import { formatDateTime } from '../../utils/dateFormat'
import api from '../../api/index.js'

const props = defineProps({
  projectId: {
    type: String,
    default: ''
  },
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:visible', 'tasks-imported'])

const { t } = useI18n()
const projectStore = useProjectStore()
const taskSourceStore = useTaskSourceStore()
const taskStore = useTaskStore()
const toast = useToast()

const dialogVisible = ref(false)
const isEditMode = ref(false)
const submitting = ref(false)
const formRef = ref(null)

const syncHistoryDialogVisible = ref(false)

const expandedPreviewDescriptions = ref(new Set())
const descriptionOverflowState = ref({})
const descriptionRefs = ref({})

const availableLabels = ref({})

const customCronExpression = ref('')
const workflowTemplates = ref([])

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

const selectedTypeConfig = computed(() => {
  if (!formData.value.type) return null
  return taskSourceStore.availableTypes.find(t => t.key === formData.value.type) || null
})

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

// --- Collapse ---
const handleCollapse = () => {
  taskSourceStore.closePreviewDialog()
  emit('update:visible', false)
}

// --- Helpers ---
const formatDateTimeWithFallback = (dateStr) => formatDateTime(dateStr, { fallback: '-' })

const scheduleLabels = {
  '*/5 * * * *': '每5分钟',
  '*/15 * * * *': '每15分钟',
  '*/30 * * * *': '每30分钟',
  '0 * * * *': '每小时',
  '0 */6 * * *': '每6小时',
  '0 0 * * *': '每天',
}

const formatScheduleLabel = (cronExpr) => {
  return scheduleLabels[cronExpr] || cronExpr
}

const loadWorkflowTemplates = async () => {
  try {
    const response = await api.get('/workflow-template')
    if (response?.success) {
      workflowTemplates.value = response.data || []
    }
  } catch (e) {
    console.warn('Failed to load workflow templates:', e)
  }
}

const getTypeLabel = (type) => {
  const translated = t(`taskSource.types.${type}`)
  return translated === `taskSource.types.${type}` ? type : translated
}

const getTypeIcon = (_type) => {
  return ''
}

const getFieldLabel = (key, field) => {
  const commonLabels = {
    repo: '仓库',
    token: '访问令牌',
    state: 'Issue 状态',
    labels: '标签筛选',
    baseUrl: 'API 地址',
    userId: '用户标识',
    category: '分类',
    status: '状态',
    pageSize: '每页数量',
    listPath: '列表路径',
    detailPath: '详情路径',
    detailIdField: '详情 ID 字段',
    rejectUnauthorized: '接受自签名证书',
    directoryPath: '目录路径',
    fileExtensions: '文件扩展名',
    descriptionMode: '描述模式',
    descriptionTemplate: '描述模板',
    agentId: '分析 Agent'
  }

  const internalApiLabels = {
    baseUrl: 'API 基础地址',
    listPath: '列表接口路径',
    detailPath: '详情接口路径模板',
    detailIdField: '详情ID字段'
  }

  if (formData.value.type === 'INTERNAL_API' && internalApiLabels[key]) {
    return internalApiLabels[key]
  }

  return commonLabels[key] || field.description || key
}

const getFieldPlaceholder = (key, field) => {
  const commonPlaceholders = {
    repo: '例如: owner/repo',
    token: 'ghp_xxx...',
    state: '选择 Issue 状态',
    labels: '选择标签',
    baseUrl: 'https://codehub.huawei.com/api/v4',
    userId: '输入用户标识',
    category: '例如: 5',
    pageSize: '例如: 10',
    listPath: '/devops-workitem/api/v1/query/workitems',
    detailPath: '/devops-workitem/api/v1/query/{number}/document_detail',
    detailIdField: '例如: number',
    rejectUnauthorized: '关闭后接受自签名证书',
    directoryPath: '服务器本地目录的绝对路径',
    fileExtensions: '如 txt,md,pdf',
    descriptionTemplate: '支持 {filename} 等变量',
    agentId: '选择 Agent'
  }

  const internalApiPlaceholders = {
    baseUrl: '例如: https://internal.example.com',
    token: '例如: Bearer xxx 或 ApiKey xxx',
    listPath: '例如: /api/tasks',
    detailPath: '例如: /api/tasks/{id}',
    detailIdField: '例如: id 或 data.taskId'
  }

  if (field?.default !== undefined) {
    return `默认: ${field.default}`
  }

  if (formData.value.type === 'INTERNAL_API' && internalApiPlaceholders[key]) {
    return internalApiPlaceholders[key]
  }

  return commonPlaceholders[key] || field.description || ''
}

const isFieldHidden = (key) => {
  const mode = formData.value.config?.descriptionMode
  if (key === 'descriptionTemplate' && mode === 'ai') return true
  if (key === 'agentId' && mode !== 'ai') return true
  return false
}

// --- Agents ---
const agents = ref([])

const loadAgents = async () => {
  try {
    const { default: api } = await import('../../api/index.js')
    const response = await api.get('/agents')
    agents.value = response.data?.data || response.data || []
  } catch {
    agents.value = []
  }
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
  loadAgents()

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
  loadAgents()
  const config = { ...source.config }

  if (typeof config.token === 'string' && config.token) {
    config.token = '****'
  }

  // Detect if schedule is a custom (non-preset) cron expression
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

const submitForm = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
    submitting.value = true

    const payload = { ...formData.value }

    // Handle custom cron expression
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
    try {
      const response = await taskSourceStore.syncTaskSource(source.id)
      if (response?.success && !response.data?.sessionId) {
        toast.info(t('taskSource.noNewFiles', '没有新文件'))
      }
    } catch (err) {
      console.error('Failed to sync task source:', err)
      toast.error('同步失败: ' + (err.message || '未知错误'))
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
  await taskSourceStore.fetchSyncHistory(source.id)
}

const viewAnalysis = (sessionId) => {
  syncHistoryDialogVisible.value = false
  taskSourceStore.viewSyncAnalysis(sessionId)
}

// --- Description expand/collapse ---
const setDescriptionRef = (el, externalId) => {
  if (el) {
    descriptionRefs.value[externalId] = el
    nextTick(() => {
      if (el && el.scrollHeight > el.clientHeight + 2) {
        descriptionOverflowState.value[externalId] = true
      }
    })
  }
}

const descriptionOverflow = (externalId) => {
  return !!descriptionOverflowState.value[externalId]
}

const toggleDescription = (externalId) => {
  const newSet = new Set(expandedPreviewDescriptions.value)
  if (newSet.has(externalId)) {
    newSet.delete(externalId)
  } else {
    newSet.add(externalId)
  }
  expandedPreviewDescriptions.value = newSet
}
</script>

<style scoped>
.task-source-panel {
  background: var(--bg-primary);
  border-bottom: 2px solid var(--accent-color);
  padding: 12px 16px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.panel-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-primary);
}

.panel-actions {
  display: flex;
  gap: 8px;
}

.loading, .empty-state {
  text-align: center;
  padding: 24px 20px;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.empty-state {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

.sources-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.source-card {
  background: var(--panel-bg);
  border-radius: var(--radius-md);
  padding: 14px;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  transition: all 0.2s;
}

.source-card:hover {
  border-color: rgba(37, 198, 201, 0.35);
  box-shadow: var(--shadow-md);
}

.source-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color);
  gap: 10px;
}

.source-header h3 {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--text-primary);
}

.source-id {
  margin-top: 4px;
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  word-break: break-all;
}

.source-type-badge {
  background: var(--accent-color-soft);
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  color: var(--accent-color);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.source-details {
  background: var(--bg-secondary);
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  margin-bottom: 10px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-xs);
  padding: 3px 0;
  gap: 10px;
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
  gap: 6px;
  flex-wrap: wrap;
}

.source-actions :deep(.el-button) {
  min-height: 28px;
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 6px;
}

/* Dialog styles */
.dialog-content {
  padding: 16px 20px;
}

.form-section {
  margin-bottom: 16px;
}

.form-section:last-child {
  margin-bottom: 0;
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

:deep(.el-form-item) {
  margin-bottom: 14px;
}

:deep(.el-form-item:last-child) {
  margin-bottom: 0;
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

/* Sync preview */
.sync-preview-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px;
  color: var(--text-secondary);
}

.sync-preview-error {
  padding: 20px;
  color: #f56c6c;
  text-align: center;
}

.sync-preview-controls {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color-lightest, #eee);
}

.sync-preview-controls :deep(.el-button) {
  min-height: 28px;
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 6px;
}

.selected-count {
  font-size: 12px;
  color: var(--text-secondary);
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
  border-bottom: 1px solid var(--border-color-lightest, #eee);
}

.sync-preview-item:hover {
  background: var(--bg-secondary);
}

.sync-preview-item.selected {
  background: #ecf5ff;
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

.item-status.todo { background: #f4f4f5; color: #909399; }
.item-status.in_progress { background: #fdf6ec; color: #e6a23c; }
.item-status.done { background: #f0f9eb; color: #67c23a; }
.item-status.blocked { background: #fef0f0; color: #f56c6c; }

.imported-badge {
  display: inline-block;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #f0f9eb;
  color: #67c23a;
  margin-bottom: 4px;
}

.item-description {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-description.expanded {
  -webkit-line-clamp: unset;
  max-height: 300px;
  overflow-y: auto;
}

.item-description-wrapper {
  margin-bottom: 4px;
  position: relative;
}

.description-toggle-btn {
  font-size: 11px;
  color: #409eff;
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 0;
  margin-top: 2px;
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
  background: #f2f6fc;
  color: var(--text-secondary);
}

.item-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: #c0c4cc;
}

.item-id {
  font-family: monospace;
}

.external-link {
  color: #409eff;
  text-decoration: none;
}

.external-link:hover {
  text-decoration: underline;
}

.sync-preview-empty {
  text-align: center;
  padding: 40px;
  color: #c0c4cc;
}

.source-schedule-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f0fffe;
  border: 1px solid rgba(37, 198, 201, 0.2);
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  margin-bottom: 10px;
}

.schedule-dot {
  width: 8px;
  height: 8px;
  background: #25c6c9;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.schedule-text {
  font-size: 12px;
  font-weight: 600;
  color: #25c6c9;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.4; }
  100% { opacity: 1; }
}
</style>
