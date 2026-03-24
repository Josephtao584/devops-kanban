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
              {{ creating ? $t('common.loading') : $t('workflowTemplate.createTemplate') }}
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
                <div class="template-name-row">
                  <el-input v-model="template.name" data-testid="template-name-input" />
                  <div class="editor-actions editor-actions--template">
                    <el-button
                      data-testid="delete-template-button"
                      :disabled="(!canDeleteSelected && !isDraftTemplate) || deleting || saving"
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
              </div>
            </div>
          </div>

          <section class="workflow-preview-section">
            <div class="section-heading-row">
              <div class="section-heading">{{ $t('workflowTemplate.workflowPreview') }}</div>
              <el-button type="primary" plain @click="addStep">
                {{ $t('workflowTemplate.addStep') }}
              </el-button>
            </div>
            <div class="workflow-preview-shell">
              <div class="workflow-preview-track">
                <template v-for="(step, index) in previewSteps" :key="step.localKey">
                  <div v-if="index > 0" class="workflow-connector" aria-hidden="true"></div>
                  <button
                    type="button"
                    class="workflow-step-card"
                    :class="{
                      'is-selected': selectedStepIndex === index,
                      'has-warning': step.hasWarning
                    }"
                    @click="selectStep(index)"
                  >
                    <div class="workflow-step-card__top">
                      <span class="workflow-step-card__order">{{ index + 1 }}</span>
                    </div>

                    <div class="workflow-step-card__name">{{ step.name || $t('workflowTemplate.newStepDefaultName') }}</div>

                    <div class="workflow-step-card__meta">
                      <span class="workflow-chip" :class="step.agentStateClass">{{ step.agentSummary }}</span>
                    </div>
                  </button>
                </template>
              </div>
            </div>
          </section>

          <div v-if="stepValidationHint" class="step-validation-hint">
            {{ stepValidationHint }}
          </div>

          <section class="step-editor-section">
            <div class="section-heading-row">
              <div class="section-heading">{{ $t('workflowTemplate.stepEditor') }}</div>
              <el-button
                v-if="selectedStep"
                text
                type="danger"
                :disabled="!canDeleteStep"
                @click="confirmRemoveStep(selectedStepIndex)"
              >
                {{ $t('workflowTemplate.deleteStep') }}
              </el-button>
            </div>

            <div v-if="selectedStep" class="step-editor-card">
              <div class="step-editor-card__header">
                <div>
                  <div class="step-editor-card__title">{{ selectedStep.name || $t('workflowTemplate.newStepDefaultName') }}</div>
                </div>
              </div>

              <div class="step-editor-state-row">
                <el-tag v-if="isMissingAgent(selectedStep)" type="danger">
                  {{ $t('workflowTemplate.missingAgent', { id: selectedStep.agentId }) }}
                </el-tag>
                <el-tag v-else-if="isDisabledAgent(selectedStep)" type="warning">
                  {{ formatBoundAgentState(selectedStep) }}
                </el-tag>
                <el-tag v-else-if="typeof selectedStep.agentId !== 'number'" type="info">
                  {{ $t('workflowTemplate.unassignedAgent') }}
                </el-tag>
              </div>

              <div class="step-editor-grid">
                <div class="editor-field">
                  <label>{{ $t('workflowTemplate.stepName') }}</label>
                  <el-input
                    v-model="selectedStep.name"
                    :placeholder="$t('workflowTemplate.stepNamePlaceholder')"
                  />
                </div>

                <div class="editor-field editor-field--full">
                  <label>{{ $t('workflowTemplate.executor') }}</label>
                  <el-select v-model="selectedStep.agentId" clearable style="width: 100%">
                    <el-option
                      v-for="agent in agents"
                      :key="agent.id"
                      :label="formatWorkflowAgentOption(agent)"
                      :value="agent.id"
                      :disabled="agent.enabled === false"
                    />
                  </el-select>
                </div>

                <div class="editor-field editor-field--full">
                  <label>{{ $t('workflowTemplate.instructionPrompt') }}</label>
                  <el-input
                    v-model="selectedStep.instructionPrompt"
                    type="textarea"
                    :rows="6"
                    resize="vertical"
                    :placeholder="$t('workflowTemplate.instructionPromptHint')"
                  />
                </div>
              </div>
            </div>

            <div v-else class="state-block compact">{{ $t('workflowTemplate.selectStepHint') }}</div>
          </section>
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
import {
  normalizeWorkflowTemplate,
  getAgentDisplayName,
  formatAgentOption,
  createAgentLookup,
  isMissingAgent as checkMissingAgent,
  isDisabledAgent as checkDisabledAgent,
  formatBoundAgentState as formatAgentBindingState,
} from '../components/workflow/templateEditorShared.js'

const DEFAULT_TEMPLATE_ID = 'dev-workflow-v1'
const MIN_TEMPLATE_STEPS = 2

const { t } = useI18n()

const loading = ref(false)
const saving = ref(false)
const creating = ref(false)
const deleting = ref(false)
const loadError = ref('')
const templates = ref([])
const selectedTemplateId = ref('')
const createTemplateId = ref('')
const createTemplateName = ref('')
const selectedStepIndex = ref(0)
const template = ref(null)
const agents = ref([])
const agentsLoaded = ref(false)
const agentsLoadFailed = ref(false)
let templateDetailRequestToken = 0
let latestTemplateDetailRequestToken = 0

const canDeleteSelected = computed(() => {
  return Boolean(template.value?.template_id) && template.value.template_id !== DEFAULT_TEMPLATE_ID
})

const isDraftTemplate = computed(() => Boolean(template.value?.isDraft))

const canDeleteStep = computed(() => {
  return (template.value?.steps?.length || 0) > MIN_TEMPLATE_STEPS
})

const selectedStep = computed(() => {
  return template.value?.steps?.[selectedStepIndex.value] || null
})

const stepValidationHint = computed(() => {
  if (!canDeleteStep.value) {
    return t('workflowTemplate.minimumStepsHint', { count: MIN_TEMPLATE_STEPS })
  }
  return ''
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
  id: typeof step.id === 'string' ? step.id : '',
  name: typeof step.name === 'string' ? step.name : '',
  instructionPrompt: typeof step.instructionPrompt === 'string' ? step.instructionPrompt : '',
  agentId: typeof step.agentId === 'number' && Number.isFinite(step.agentId) ? step.agentId : null
})

const sanitizeStep = (step = {}) => ({
  id: (step.id || '').trim(),
  name: (step.name || '').trim(),
  instructionPrompt: (step.instructionPrompt || '').trim(),
  agentId: typeof step.agentId === 'number' && Number.isFinite(step.agentId) ? step.agentId : null
})

const slugifyStepName = (value = '') => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized
}

const createGeneratedStepId = (step, index, usedIds) => {
  const base = slugifyStepName(step.name) || `step-${index + 1}`
  let candidate = base
  let suffix = 2

  while (usedIds.has(candidate)) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }

  usedIds.add(candidate)
  return candidate
}

const normalizeTemplate = (rawTemplate) => {
  if (!rawTemplate) return null

  return {
    ...normalizeWorkflowTemplate(rawTemplate, null),
    isDraft: rawTemplate.isDraft === true,
    steps: Array.isArray(rawTemplate.steps) ? rawTemplate.steps.map(normalizeStep) : []
  }
}

const getAgentLabel = (agent) => getAgentDisplayName(agent, t)

const getAgentById = (agentId) => createAgentLookup(agents.value)(agentId)
const isMissingAgent = (step) => {
  if (!agentsLoaded.value || agentsLoadFailed.value) return false
  return checkMissingAgent(step, getAgentById)
}
const isDisabledAgent = (step) => checkDisabledAgent(step, getAgentById)
const formatBoundAgentState = (step) => formatAgentBindingState(step, getAgentById, t)
const formatWorkflowAgentOption = (agent) => formatAgentOption(agent, t)

const buildStepsPayload = (steps = []) => {
  const usedIds = new Set()

  return steps.map((step, index) => {
    const normalizedStep = sanitizeStep(step)
    const generatedId = normalizedStep.id || createGeneratedStepId(normalizedStep, index, usedIds)
    usedIds.add(generatedId)
    return {
      id: generatedId,
      name: normalizedStep.name,
      instructionPrompt: normalizedStep.instructionPrompt,
      agentId: normalizedStep.agentId
    }
  })
}

const buildSavePayload = (currentTemplate) => ({
  template_id: currentTemplate.template_id,
  name: currentTemplate.name?.trim?.() || '',
  steps: buildStepsPayload(currentTemplate.steps || [])
})

const createDraftTemplate = () => ({
  template_id: `draft-${Date.now()}`,
  name: t('workflowTemplate.newTemplateDefaultName'),
  isDraft: true,
  steps: (template.value?.steps || []).map(step => normalizeStep(step))
})

const previewSteps = computed(() => {
  return (template.value?.steps || []).map((step, index) => {
    const sanitized = sanitizeStep(step)
    let agentSummary = t('workflowTemplate.unassignedAgent')
    let agentStateClass = 'workflow-chip--info'

    if (typeof sanitized.agentId === 'number') {
      if (isMissingAgent(sanitized)) {
        agentSummary = t('workflowTemplate.missingAgent', { id: sanitized.agentId })
        agentStateClass = 'workflow-chip--danger'
      } else if (isDisabledAgent(sanitized)) {
        agentSummary = formatBoundAgentState(sanitized)
        agentStateClass = 'workflow-chip--warning'
      } else {
        agentSummary = getAgentLabel(getAgentById(sanitized.agentId))
        agentStateClass = 'workflow-chip--success'
      }
    }

    return {
      ...sanitized,
      localKey: `${index}-${step.id || 'empty'}`,
      agentSummary,
      agentStateClass,
      hasWarning: isMissingAgent(sanitized) || isDisabledAgent(sanitized) || !sanitized.instructionPrompt
    }
  })
})

const syncSelectedStepIndex = () => {
  const stepCount = template.value?.steps?.length || 0
  if (stepCount === 0) {
    selectedStepIndex.value = 0
    return
  }
  if (selectedStepIndex.value >= stepCount) {
    selectedStepIndex.value = stepCount - 1
  }
}

const selectStep = (index) => {
  selectedStepIndex.value = index
}

const addStep = () => {
  if (!template.value) return
  template.value.steps = [
    ...(template.value.steps || []),
    {
      id: '',
      name: t('workflowTemplate.newStepDefaultName'),
      instructionPrompt: '',
      agentId: null
    }
  ]
  selectedStepIndex.value = template.value.steps.length - 1
}

const removeStep = (index) => {
  if (!template.value) return
  if (!canDeleteStep.value) {
    ElMessage.warning(t('workflowTemplate.minimumStepsHint', { count: MIN_TEMPLATE_STEPS }))
    return
  }

  template.value.steps = template.value.steps.filter((_, stepIndex) => stepIndex !== index)
  if (selectedStepIndex.value > index) {
    selectedStepIndex.value -= 1
  } else if (selectedStepIndex.value === index) {
    selectedStepIndex.value = Math.max(0, index - 1)
  }
  syncSelectedStepIndex()
}

const confirmRemoveStep = async (index) => {
  if (!template.value) return
  if (!canDeleteStep.value) {
    ElMessage.warning(t('workflowTemplate.minimumStepsHint', { count: MIN_TEMPLATE_STEPS }))
    return
  }

  try {
    await ElMessageBox.confirm(
      t('workflowTemplate.deleteStepConfirm'),
      t('workflowTemplate.deleteStepConfirmTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
    removeStep(index)
  } catch {
    // user cancelled
  }
}

const validateTemplateBeforeSave = (currentTemplate) => {
  if (!currentTemplate?.name?.trim()) {
    return t('workflowTemplate.templateNameRequired')
  }

  const steps = buildStepsPayload(currentTemplate.steps || [])
  if (steps.length < MIN_TEMPLATE_STEPS) {
    return t('workflowTemplate.minimumStepsHint', { count: MIN_TEMPLATE_STEPS })
  }

  const seenIds = new Set()
  for (const step of steps) {
    if (!step.name) {
      return t('workflowTemplate.stepNameRequired')
    }
    if (seenIds.has(step.id)) {
      return t('workflowTemplate.stepIdUnique')
    }
    seenIds.add(step.id)
    if (typeof step.agentId !== 'number') {
      return t('workflowTemplate.stepAgentRequired')
    }
    if (!step.instructionPrompt) {
      return t('workflowTemplate.stepPromptRequired')
    }
  }

  return ''
}

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

const replaceDraftTemplate = (draftTemplateId, savedTemplate) => {
  const normalized = normalizeTemplate(savedTemplate)
  if (!normalized) return

  const index = templates.value.findIndex((item) => item.template_id === draftTemplateId)
  if (index === -1) {
    templates.value = [...templates.value, normalized]
    return
  }

  const nextTemplates = [...templates.value]
  nextTemplates.splice(index, 1, normalized)
  templates.value = nextTemplates
}

const addDraftTemplate = (draftTemplate) => {
  templates.value = [...templates.value, draftTemplate]
  selectedTemplateId.value = draftTemplate.template_id
  template.value = draftTemplate
  selectedStepIndex.value = 0
}

const removeTemplateFromList = (templateId) => {
  templates.value = templates.value.filter((item) => item.template_id !== templateId)
}

const loadTemplateDetail = async (templateId, options = {}) => {
  const { allowStale = false } = options

  if (!templateId) {
    selectedTemplateId.value = ''
    template.value = null
    selectedStepIndex.value = 0
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
  selectedStepIndex.value = 0
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
    selectedStepIndex.value = 0
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
    selectedStepIndex.value = 0
    return null
  }

  const summary = templates.value.find((item) => item.template_id === preferredTemplateId) || null
  selectedTemplateId.value = preferredTemplateId
  template.value = summary ? normalizeTemplate(summary) : null
  selectedStepIndex.value = 0
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

const finalizeTemplateDeletion = async (deletedTemplateId) => {
  removeTemplateLocally(deletedTemplateId)
  ElMessage.success(t('workflowTemplate.deleteSuccess'))
  await refreshTemplateList(DEFAULT_TEMPLATE_ID)
}

const finalizeDraftDeletion = (deletedTemplateId) => {
  removeTemplateFromList(deletedTemplateId)
  selectTemplateLocally(DEFAULT_TEMPLATE_ID)
}

const finalizeTemplateSave = (savedTemplate) => {
  template.value = savedTemplate
  selectedStepIndex.value = Math.min(selectedStepIndex.value, Math.max((savedTemplate.steps?.length || 1) - 1, 0))
  upsertTemplateSummary(savedTemplate)
  ElMessage.success(t(isDraftTemplate.value ? 'workflowTemplate.createSuccess' : 'workflowTemplate.saveSuccess'))
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

const generateTemplateId = () => {
  const requestedId = createTemplateId.value.trim()
  if (requestedId) return requestedId

  const existingIds = new Set(templates.value.filter(item => !item.isDraft).map((item) => item.template_id))
  let index = templates.value.length + 1
  let candidate = `template-${index}`

  while (existingIds.has(candidate)) {
    index += 1
    candidate = `template-${index}`
  }

  return candidate
}

const handleCreateTemplate = async () => {
  if (!template.value) return
  if (!createTemplateId.value.trim() || !createTemplateName.value.trim()) return

  creating.value = true
  try {
    const payload = {
      template_id: createTemplateId.value.trim(),
      name: createTemplateName.value.trim(),
      steps: buildStepsPayload(template.value.steps || [])
    }

    const response = await createWorkflowTemplate(payload)
    const createdTemplate = normalizeTemplate(getApiData(response, 'workflowTemplate.createFailed'))
    upsertTemplateSummary(createdTemplate)
    createTemplateId.value = ''
    createTemplateName.value = ''
    selectTemplateLocally(createdTemplate.template_id)
    ElMessage.success(t('workflowTemplate.createSuccess'))
    await handleFollowUpDetailLoad(createdTemplate.template_id)
  } catch (error) {
    handleActionFailure(error, 'workflowTemplate.createFailed')
  } finally {
    creating.value = false
  }
}

const saveTemplate = async () => {
  if (!template.value) return

  const validationMessage = validateTemplateBeforeSave(template.value)
  if (validationMessage) {
    ElMessage.warning(validationMessage)
    return
  }

  saving.value = true
  try {
    const originalTemplateId = template.value.template_id
    const payload = buildSavePayload({
      ...template.value,
      template_id: isDraftTemplate.value ? generateTemplateId() : template.value.template_id
    })
    const response = isDraftTemplate.value
      ? await createWorkflowTemplate(payload)
      : await updateWorkflowTemplate(payload)
    const savedTemplate = normalizeTemplate(getApiData(response, isDraftTemplate.value ? 'workflowTemplate.createFailed' : 'workflowTemplate.saveFailed'))

    if (isDraftTemplate.value) {
      replaceDraftTemplate(originalTemplateId, savedTemplate)
    }
    finalizeTemplateSave(savedTemplate)
  } catch (error) {
    handleActionFailure(error, isDraftTemplate.value ? 'workflowTemplate.createFailed' : 'workflowTemplate.saveFailed')
  } finally {
    saving.value = false
  }
}

const handleDeleteTemplate = async () => {
  if ((!canDeleteSelected.value && !isDraftTemplate.value) || !template.value) return

  deleting.value = true
  try {
    const deletedTemplateId = template.value.template_id
    if (isDraftTemplate.value) {
      finalizeDraftDeletion(deletedTemplateId)
      return
    }
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
  transition: all 0.2s ease;
}

.template-list-item:hover {
  border-color: #93c5fd;
  transform: translateY(-1px);
}

.template-list-item.is-active {
  border-color: var(--el-color-primary);
  background: #ecf5ff;
}

.template-list-item__name {
  font-weight: 600;
  color: #222;
}

.editor-header {
  margin-bottom: 20px;
}

.editor-actions {
  display: flex;
  gap: 12px;
}

.editor-actions--template {
  flex-shrink: 0;
}

.template-meta {
  display: grid;
  gap: 12px;
  flex: 1;
}

.template-name-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
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

.step-validation-hint {
  margin-bottom: 16px;
  color: #666;
  font-size: 13px;
}

.section-heading-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.section-heading {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  letter-spacing: 0.02em;
}

.workflow-preview-section {
  margin-bottom: 20px;
}

.workflow-preview-shell {
  overflow-x: auto;
  padding: 12px 4px 16px;
  border-radius: 16px;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  border: 1px solid #e2e8f0;
}

.workflow-preview-track {
  display: flex;
  align-items: stretch;
  min-width: max-content;
  padding: 8px;
}

.workflow-connector {
  position: relative;
  width: 52px;
  flex-shrink: 0;
}

.workflow-connector::before {
  content: '';
  position: absolute;
  left: 8px;
  right: 16px;
  top: 50%;
  height: 2px;
  background: #94a3b8;
  transform: translateY(-50%);
}

.workflow-connector::after {
  content: '';
  position: absolute;
  right: 8px;
  top: 50%;
  width: 0;
  height: 0;
  border-left: 8px solid #94a3b8;
  border-top: 5px solid transparent;
  border-bottom: 5px solid transparent;
  transform: translateY(-50%);
}

.workflow-step-card {
  width: 250px;
  min-height: 140px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 2px solid #dbe4ee;
  background: #fff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
}

.workflow-step-card:hover {
  transform: translateY(-2px);
  border-color: #93c5fd;
  box-shadow: 0 14px 28px rgba(59, 130, 246, 0.12);
}

.workflow-step-card.is-selected {
  border-color: #3b82f6;
  background: linear-gradient(180deg, #ffffff 0%, #eff6ff 100%);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.14);
}

.workflow-step-card.has-warning {
  border-color: #fbbf24;
}

.workflow-step-card__top {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
}

.workflow-step-card__order {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 13px;
  font-weight: 700;
}

.workflow-step-card__name {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.workflow-step-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.workflow-chip {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
}

.workflow-chip--info {
  background: #e2e8f0;
  color: #475569;
}

.workflow-chip--success {
  background: #dcfce7;
  color: #15803d;
}

.workflow-chip--warning {
  background: #fef3c7;
  color: #b45309;
}

.workflow-chip--danger {
  background: #fee2e2;
  color: #b91c1c;
}

.step-editor-section {
  margin-top: 8px;
}

.step-editor-card {
  border-radius: 16px;
  border: 1px solid #dbe4ee;
  background: #fff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
  padding: 20px;
}

.step-editor-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.step-editor-card__title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.step-editor-state-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.step-editor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.editor-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.editor-field--full {
  grid-column: 1 / -1;
}

.editor-field label {
  color: #475569;
  font-size: 13px;
  font-weight: 600;
}

.state-block {
  padding: 32px;
  text-align: center;
  color: #666;
}

.state-block.compact {
  padding: 24px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
}

.state-block.error {
  color: #d03050;
}

.actions-row {
  display: flex;
  justify-content: center;
  padding-bottom: 24px;
}

@media (max-width: 1200px) {
  .template-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .template-name-row,
  .section-heading-row {
    flex-direction: column;
    align-items: stretch;
  }

  .step-editor-grid {
    grid-template-columns: 1fr;
  }

  .editor-field--full {
    grid-column: auto;
  }
}
</style>
