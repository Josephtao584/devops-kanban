<template>
  <div class="workflow-template-config">
    <div class="page-header">
      <div>
        <h1>{{ $t('workflowTemplate.title') }}</h1>
        <p class="page-description">{{ $t('workflowTemplate.description') }}</p>
      </div>
    </div>

    <div class="template-layout">
      <el-card class="template-sidebar" shadow="never">
        <template v-if="loading">
          <div class="state-block">{{ $t('common.loading') }}</div>
        </template>

        <template v-else-if="loadError">
          <div class="state-block error">{{ loadError }}</div>
          <div class="actions-row">
            <el-button @click="loadPage">{{ $t('workflowTemplate.retry') }}</el-button>
          </div>
        </template>

        <template v-else>
          <div class="sidebar-section-title">{{ $t('workflowTemplate.templateListTitle') }}</div>

          <div class="create-template-form">
            <el-input
              v-model="createTemplateId"
              data-testid="create-template-id-input"
              :placeholder="$t('workflowTemplate.newTemplateId')"
            />
            <el-input
              v-model="createTemplateName"
              data-testid="create-template-name-input"
              :placeholder="$t('workflowTemplate.newTemplateName')"
            />
            <el-button
              data-testid="create-template-button"
              type="primary"
              :disabled="creating || !template || !createTemplateId.trim() || !createTemplateName.trim()"
              @click="handleCreateTemplate"
            >
              {{ creating ? $t('common.loading') : $t('common.create') }}
            </el-button>
          </div>

          <div v-if="templates.length === 0" class="state-block">
            {{ $t('workflowTemplate.emptyState') }}
          </div>

          <div v-else class="template-list">
            <button
              v-for="item in templates"
              :key="item.template_id"
              :data-testid="`template-item-${item.template_id}`"
              type="button"
              class="template-list-item"
              :class="{ 'is-active': item.template_id === selectedTemplateId }"
              @click="selectTemplate(item.template_id)"
            >
              <span class="template-list-item__name">{{ item.name }}</span>
              <span class="template-list-item__id">{{ item.template_id }}</span>
            </button>
          </div>
        </template>
      </el-card>

      <el-card class="template-card" shadow="never">
        <template v-if="loading">
          <div class="state-block">{{ $t('common.loading') }}</div>
        </template>

        <template v-else-if="loadError">
          <div class="state-block error">{{ loadError }}</div>
        </template>

        <template v-else-if="template">
          <div class="editor-header">
            <div class="template-meta">
              <div class="meta-row">
                <span class="meta-label">{{ $t('workflowTemplate.templateId') }}</span>
                <span data-testid="template-id" class="meta-value">{{ template.template_id }}</span>
              </div>
              <div class="meta-row meta-row--stacked">
                <span class="meta-label">{{ $t('workflowTemplate.name') }}</span>
                <el-input v-model="template.name" data-testid="template-name-input" />
              </div>
            </div>

            <div class="editor-actions">
              <el-button
                data-testid="delete-template-button"
                :disabled="!canDeleteSelected || deleting || saving"
                @click="handleDeleteTemplate"
              >
                {{ deleting ? $t('common.loading') : $t('common.delete') }}
              </el-button>
              <el-button
                data-testid="save-template-button"
                type="primary"
                :disabled="saving || deleting"
                @click="saveTemplate"
              >
                {{ saving ? $t('common.saving', '保存中...') : $t('common.save') }}
              </el-button>
            </div>
          </div>

          <div v-if="!canDeleteSelected" class="default-template-hint">
            {{ $t('workflowTemplate.defaultTemplateHint') }}
          </div>
          <div v-if="agentsLoadFailed" class="agent-load-hint">
            {{ $t('workflowTemplate.loadAgentsFailed') }}
          </div>

          <el-table :data="template.steps" border stripe>
            <el-table-column prop="name" :label="$t('workflowTemplate.stepName')" min-width="160" />
            <el-table-column prop="id" :label="$t('workflowTemplate.stepId')" min-width="180" />
            <el-table-column :label="$t('workflowTemplate.executor')" min-width="280">
              <template #default="scope">
                <div class="agent-binding-cell">
                  <el-select v-model="scope.row.agentId" clearable style="width: 100%">
                    <el-option
                      v-for="agent in agents"
                      :key="agent.id"
                      :label="formatAgentOption(agent)"
                      :value="agent.id"
                      :disabled="agent.enabled === false"
                    />
                  </el-select>

                  <div v-if="agentsLoaded" class="binding-state-row">
                    <el-tag v-if="isMissingAgent(scope.row)" type="danger">
                      {{ $t('workflowTemplate.missingAgent', { id: scope.row.agentId }) }}
                    </el-tag>
                    <el-tag v-else-if="isDisabledAgent(scope.row)" type="warning">
                      {{ formatBoundAgentState(scope.row) }}
                    </el-tag>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column :label="$t('workflowTemplate.instructionPrompt')" min-width="420">
              <template #default="scope">
                <div class="prompt-editor">
                  <el-input
                    v-model="scope.row.instructionPrompt"
                    type="textarea"
                    :rows="4"
                    resize="vertical"
                    :placeholder="$t('workflowTemplate.instructionPromptHint')"
                  />
                </div>
              </template>
            </el-table-column>
          </el-table>
        </template>

        <template v-else>
          <div class="state-block">{{ $t('workflowTemplate.emptyState') }}</div>
        </template>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import {
  createWorkflowTemplate,
  deleteWorkflowTemplate,
  getWorkflowTemplateById,
  getWorkflowTemplates,
  updateWorkflowTemplate
} from '../api/workflowTemplate'
import { getAgents } from '../api/agent'

const DEFAULT_TEMPLATE_ID = 'dev-workflow-v1'

const { t } = useI18n()

const loading = ref(false)
const saving = ref(false)
const creating = ref(false)
const deleting = ref(false)
const loadError = ref('')
const templates = ref([])
const selectedTemplateId = ref('')
const template = ref(null)
const createTemplateId = ref('')
const createTemplateName = ref('')
const agents = ref([])
const agentsLoaded = ref(false)
const agentsLoadFailed = ref(false)
let templateDetailRequestToken = 0
let latestTemplateDetailRequestToken = 0

const canDeleteSelected = computed(() => {
  return Boolean(template.value?.template_id) && template.value.template_id !== DEFAULT_TEMPLATE_ID
})

const getApiData = (response, fallbackMessageKey) => {
  if (!response?.success) {
    throw new Error(response?.message || t(fallbackMessageKey))
  }

  return response?.data
}

const getErrorMessage = (error, fallbackMessageKey) => {
  return error?.response?.data?.message || error?.message || t(fallbackMessageKey)
}

const normalizeStep = (step = {}) => ({
  id: step.id ?? '',
  name: step.name ?? '',
  instructionPrompt: step.instructionPrompt ?? '',
  agentId: typeof step.agentId === 'number' && Number.isFinite(step.agentId) ? step.agentId : null
})

const normalizeTemplate = (rawTemplate) => {
  if (!rawTemplate) return null

  return {
    ...rawTemplate,
    steps: Array.isArray(rawTemplate.steps) ? rawTemplate.steps.map(normalizeStep) : []
  }
}

const formatExecutorType = (agent) => {
  const executorType = agent?.executorType || agent?.type
  if (!executorType) return ''

  return executorType
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

const getAgentDisplayName = (agent) => {
  return agent?.name || t('workflowTemplate.agentFallbackName', { id: agent?.id ?? '' })
}

const formatAgentOption = (agent) => {
  const parts = [getAgentDisplayName(agent)]
  const executorType = formatExecutorType(agent)

  if (executorType) {
    parts.push(`(${executorType})`)
  }

  if (agent?.enabled === false) {
    parts.push(`(${t('workflowTemplate.disabled')})`)
  }

  return parts.join(' ')
}

const getAgentById = (agentId) => agents.value.find((agent) => agent.id === agentId) || null

const isMissingAgent = (step) => {
  if (!agentsLoaded.value || agentsLoadFailed.value) return false
  if (typeof step?.agentId !== 'number') return false
  return !getAgentById(step.agentId)
}

const isDisabledAgent = (step) => {
  if (typeof step?.agentId !== 'number') return false
  return getAgentById(step.agentId)?.enabled === false
}

const formatBoundAgentState = (step) => {
  const agent = getAgentById(step?.agentId)
  if (!agent) return ''
  return `${getAgentDisplayName(agent)} (${t('workflowTemplate.disabled')})`
}

const buildStepsPayload = (steps = []) => {
  return steps.map((step) => ({
    id: step.id,
    name: step.name,
    instructionPrompt: step.instructionPrompt ?? '',
    agentId: typeof step.agentId === 'number' && Number.isFinite(step.agentId) ? step.agentId : null
  }))
}

const buildSavePayload = (currentTemplate) => ({
  template_id: currentTemplate.template_id,
  name: currentTemplate.name,
  steps: buildStepsPayload(currentTemplate.steps || [])
})

const resolvePreferredTemplateId = (availableTemplates, preferredId) => {
  if (preferredId && availableTemplates.some((item) => item.template_id === preferredId)) {
    return preferredId
  }

  if (availableTemplates.some((item) => item.template_id === DEFAULT_TEMPLATE_ID)) {
    return DEFAULT_TEMPLATE_ID
  }

  return availableTemplates[0]?.template_id || ''
}

const upsertTemplateSummary = (updatedTemplate) => {
  const normalized = normalizeTemplate(updatedTemplate)
  if (!normalized) return

  const index = templates.value.findIndex((item) => item.template_id === normalized.template_id)
  if (index === -1) {
    templates.value = [...templates.value, normalized]
    return
  }

  const nextTemplates = [...templates.value]
  nextTemplates.splice(index, 1, normalized)
  templates.value = nextTemplates
}

const loadTemplateDetail = async (templateId, options = {}) => {
  const { allowStale = false } = options

  if (!templateId) {
    selectedTemplateId.value = ''
    template.value = null
    return null
  }

  const requestToken = ++templateDetailRequestToken
  latestTemplateDetailRequestToken = requestToken

  const response = await getWorkflowTemplateById(templateId)
  const loadedTemplate = normalizeTemplate(getApiData(response, 'workflowTemplate.loadFailed'))

  if (!allowStale && requestToken !== latestTemplateDetailRequestToken) {
    return loadedTemplate
  }

  selectedTemplateId.value = loadedTemplate.template_id
  template.value = loadedTemplate
  upsertTemplateSummary(loadedTemplate)
  return loadedTemplate
}

const loadTemplateList = async (preferredId = DEFAULT_TEMPLATE_ID) => {
  const response = await getWorkflowTemplates()
  const loadedTemplates = getApiData(response, 'workflowTemplate.loadFailed')
  templates.value = Array.isArray(loadedTemplates) ? loadedTemplates.map(normalizeTemplate) : []

  const nextTemplateId = resolvePreferredTemplateId(templates.value, preferredId)
  if (!nextTemplateId) {
    selectedTemplateId.value = ''
    template.value = null
    return
  }

  await loadTemplateDetail(nextTemplateId)
}

const selectTemplate = async (templateId) => {
  if (!templateId || templateId === selectedTemplateId.value) return

  try {
    await loadTemplateDetail(templateId)
  } catch (error) {
    ElMessage.error(getErrorMessage(error, 'workflowTemplate.loadFailed'))
  }
}

const loadAgents = async () => {
  agentsLoaded.value = false
  agentsLoadFailed.value = false

  try {
    const response = await getAgents()
    const loadedAgents = getApiData(response, 'workflowTemplate.loadAgentsFailed')
    agents.value = Array.isArray(loadedAgents) ? loadedAgents : []
  } catch (error) {
    agents.value = []
    agentsLoadFailed.value = true
    ElMessage.error(getErrorMessage(error, 'workflowTemplate.loadAgentsFailed'))
  } finally {
    agentsLoaded.value = true
  }
}

const notifyFollowUpLoadError = (error) => {
  ElMessage.error(getErrorMessage(error, 'workflowTemplate.loadFailed'))
}

const selectTemplateLocally = (templateId) => {
  const preferredTemplateId = resolvePreferredTemplateId(templates.value, templateId)

  if (!preferredTemplateId) {
    selectedTemplateId.value = ''
    template.value = null
    return null
  }

  const summary = templates.value.find((item) => item.template_id === preferredTemplateId) || null
  selectedTemplateId.value = preferredTemplateId
  template.value = summary ? normalizeTemplate(summary) : null
  return preferredTemplateId
}

const removeTemplateLocally = (templateId) => {
  templates.value = templates.value.filter((item) => item.template_id !== templateId)
  return selectTemplateLocally(DEFAULT_TEMPLATE_ID)
}

const handleFollowUpDetailLoad = async (templateId) => {
  if (!templateId) return

  try {
    await loadTemplateDetail(templateId)
  } catch (error) {
    notifyFollowUpLoadError(error)
  }
}

const refreshTemplateList = async (preferredId) => {
  try {
    await loadTemplateList(preferredId)
  } catch (error) {
    notifyFollowUpLoadError(error)
  }
}

const finalizeTemplateCreation = async (createdTemplate) => {
  upsertTemplateSummary(createdTemplate)
  createTemplateId.value = ''
  createTemplateName.value = ''
  selectTemplateLocally(createdTemplate.template_id)
  ElMessage.success(t('workflowTemplate.createSuccess'))
  await handleFollowUpDetailLoad(createdTemplate.template_id)
}

const finalizeTemplateDeletion = async (deletedTemplateId) => {
  removeTemplateLocally(deletedTemplateId)
  ElMessage.success(t('workflowTemplate.deleteSuccess'))
  await refreshTemplateList(DEFAULT_TEMPLATE_ID)
}

const finalizeTemplateSave = (savedTemplate) => {
  template.value = savedTemplate
  upsertTemplateSummary(savedTemplate)
  ElMessage.success(t('workflowTemplate.saveSuccess'))
}

const handleActionFailure = (error, fallbackMessageKey) => {
  ElMessage.error(getErrorMessage(error, fallbackMessageKey))
}

const loadPage = async () => {
  loading.value = true
  loadError.value = ''

  try {
    await Promise.all([loadTemplateList(DEFAULT_TEMPLATE_ID), loadAgents()])
  } catch (error) {
    loadError.value = getErrorMessage(error, 'workflowTemplate.loadFailed')
  } finally {
    loading.value = false
  }
}

const handleCreateTemplate = async () => {
  if (!template.value) return

  creating.value = true
  try {
    const payload = {
      template_id: createTemplateId.value.trim(),
      name: createTemplateName.value.trim(),
      steps: buildStepsPayload(template.value.steps || [])
    }

    const response = await createWorkflowTemplate(payload)
    const createdTemplate = normalizeTemplate(getApiData(response, 'workflowTemplate.createFailed'))
    await finalizeTemplateCreation(createdTemplate)
  } catch (error) {
    handleActionFailure(error, 'workflowTemplate.createFailed')
  } finally {
    creating.value = false
  }
}

const saveTemplate = async () => {
  if (!template.value) return

  saving.value = true
  try {
    const payload = buildSavePayload(template.value)
    const response = await updateWorkflowTemplate(payload)
    const savedTemplate = normalizeTemplate(getApiData(response, 'workflowTemplate.saveFailed'))
    finalizeTemplateSave(savedTemplate)
  } catch (error) {
    handleActionFailure(error, 'workflowTemplate.saveFailed')
  } finally {
    saving.value = false
  }
}

const handleDeleteTemplate = async () => {
  if (!canDeleteSelected.value || !template.value) return

  deleting.value = true
  try {
    const deletedTemplateId = template.value.template_id
    await deleteWorkflowTemplate(deletedTemplateId)
    await finalizeTemplateDeletion(deletedTemplateId)
  } catch (error) {
    handleActionFailure(error, 'workflowTemplate.deleteFailed')
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  loadPage()
})
</script>

<style scoped>
.workflow-template-config {
  padding: 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
}

.page-header h1 {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 600;
}

.page-description {
  margin: 0;
  color: #666;
}

.template-layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 20px;
}

.template-sidebar,
.template-card {
  border-radius: 12px;
}

.sidebar-section-title {
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #444;
}

.create-template-form {
  display: grid;
  gap: 12px;
  margin-bottom: 16px;
}

.template-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.template-list-item {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 4px;
  padding: 12px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background: #fff;
  text-align: left;
  cursor: pointer;
}

.template-list-item.is-active {
  border-color: var(--el-color-primary);
  background: #ecf5ff;
}

.template-list-item__name {
  font-weight: 600;
  color: #222;
}

.template-list-item__id {
  color: #666;
  font-size: 12px;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
}

.editor-actions {
  display: flex;
  gap: 12px;
}

.template-meta {
  display: grid;
  gap: 12px;
  flex: 1;
}

.meta-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.meta-row--stacked {
  align-items: flex-start;
  flex-direction: column;
}

.meta-label {
  color: #666;
  min-width: 96px;
}

.meta-value {
  color: #222;
  font-weight: 500;
}

.default-template-hint,
.agent-load-hint {
  margin-bottom: 16px;
  color: #666;
  font-size: 13px;
}

.agent-binding-cell {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.binding-state-row {
  min-height: 24px;
}

.prompt-editor {
  width: 100%;
}

.state-block {
  padding: 32px;
  text-align: center;
  color: #666;
}

.state-block.error {
  color: #d03050;
}

.actions-row {
  display: flex;
  justify-content: center;
  padding-bottom: 24px;
}
</style>
