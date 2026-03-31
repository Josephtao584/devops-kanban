<template>
  <div class="workflow-template-config page-shell">
    <div class="page-header page-header--compact">
      <div class="page-header__content">
        <h1 class="page-header__title">{{ $t('workflowTemplate.title') }}</h1>
        <p class="page-header__description page-description">{{ $t('workflowTemplate.description') }}</p>
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
            <el-button
              data-testid="create-template-button"
              type="primary"
              :disabled="!template"
              @click="handleCreateTemplate"
            >
              {{ $t('workflowTemplate.createTemplate') }}
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
              <el-button data-testid="add-step-button" type="primary" plain @click="addStep">
                {{ $t('workflowTemplate.addStep') }}
              </el-button>
            </div>
            <div class="workflow-preview-shell">
              <div class="workflow-preview-track">
                <template v-for="(step, index) in previewSteps" :key="step.localKey">
                  <div v-if="index > 0" class="workflow-connector" aria-hidden="true"></div>
                  <div
                    class="workflow-step-card"
                    :class="{
                      'is-selected': selectedStepIndex === index,
                      'has-warning': step.hasWarning,
                      'state-missing': step.stateClass === 'state-missing',
                      'state-disabled': step.stateClass === 'state-disabled'
                    }"
                    @click="selectStep(index)"
                  >
                    <div class="workflow-step-card__top">
                      <span class="workflow-step-card__order">{{ index + 1 }}</span>
                    </div>

                    <div class="workflow-step-card__name">{{ step.name || $t('workflowTemplate.newStepDefaultName') }}</div>

                    <div class="workflow-step-card__meta">
                      <div class="workflow-step-card__chips">
                        <span class="workflow-chip" :class="step.agentStateClass">{{ step.agentSummary }}</span>
                        <span v-if="step.requiresConfirmation" class="workflow-chip workflow-chip--warning">
                          {{ $t('workflowTemplate.requiresConfirmation') }}
                        </span>
                      </div>
                      <div v-if="step.skillNames.length" class="workflow-step-card__skills">
                        <el-tooltip v-for="skill in step.skillNames" :key="skill.name" :content="skill.description" :disabled="!skill.description" placement="top">
                          <span class="workflow-skill-tag">{{ skill.name }}</span>
                        </el-tooltip>
                      </div>
                    </div>

                    <div class="workflow-step-card__actions">
                      <div class="workflow-step-card__action-row">
                        <el-tooltip :content="$t('workflowTemplate.insertStepBefore')" placement="top">
                          <el-button
                            data-testid="insert-step-before-button"
                            class="workflow-step-card__icon-button"
                            size="small"
                            :aria-label="$t('workflowTemplate.insertStepBefore')"
                            :title="$t('workflowTemplate.insertStepBefore')"
                            @click.stop="insertStep(index, 'before')"
                          >
                            <el-icon><Back /></el-icon>
                          </el-button>
                        </el-tooltip>
                        <el-tooltip :content="$t('workflowTemplate.insertStepAfter')" placement="top">
                          <el-button
                            data-testid="insert-step-after-button"
                            class="workflow-step-card__icon-button"
                            size="small"
                            :aria-label="$t('workflowTemplate.insertStepAfter')"
                            :title="$t('workflowTemplate.insertStepAfter')"
                            @click.stop="insertStep(index, 'after')"
                          >
                            <el-icon><Right /></el-icon>
                          </el-button>
                        </el-tooltip>
                        <el-tooltip :content="$t('workflowTemplate.deleteStep')" placement="top">
                          <el-button
                            data-testid="delete-step-button"
                            class="workflow-step-card__icon-button"
                            size="small"
                            type="danger"
                            :disabled="!canDeleteStep"
                            :aria-label="$t('workflowTemplate.deleteStep')"
                            :title="$t('workflowTemplate.deleteStep')"
                            @click.stop="confirmRemoveStep(index)"
                          >
                            <el-icon><Delete /></el-icon>
                          </el-button>
                        </el-tooltip>
                      </div>
                    </div>
                  </div>
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

              <div
                v-if="isMissingAgent(selectedStep) || isDisabledAgent(selectedStep) || typeof selectedStep.agentId !== 'number'"
                class="step-editor-state-row binding-state-row"
              >
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
                  <div class="editor-field__hint">{{ $t('workflowTemplate.deliveryPromptGuidance') }}</div>
                  <el-input
                    v-model="selectedStep.instructionPrompt"
                    type="textarea"
                    :rows="6"
                    resize="vertical"
                    :placeholder="$t('workflowTemplate.instructionPromptHint')"
                  />
                </div>

                <div class="editor-field editor-field--full">
                  <div class="confirmation-header">
                    <el-switch
                      v-model="selectedStep.requiresConfirmation"
                      :active-text="$t('workflowTemplate.requiresConfirmation')"
                    />
                  </div>
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
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Back, Right } from '@element-plus/icons-vue'
import {
  createWorkflowTemplate,
  deleteWorkflowTemplate,
  getWorkflowTemplateById,
  getWorkflowTemplates,
  updateWorkflowTemplate
} from '../api/workflowTemplate'
import { getAgents } from '../api/agent'
import { useSkillStore } from '../stores/skillStore'
import {
  MIN_WORKFLOW_TEMPLATE_STEPS,
  normalizeWorkflowStep,
  normalizeWorkflowTemplate,
  sanitizeWorkflowStep,
  createEmptyWorkflowStep,
  insertWorkflowStep,
  removeWorkflowStep,
  resolveSelectedStepIndexAfterRemoval,
  buildWorkflowTemplatePayload,
  validateWorkflowTemplatePayload,
  getAgentDisplayName,
  formatAgentOption,
  createAgentLookup,
  isMissingAgent as checkMissingAgent,
  isDisabledAgent as checkDisabledAgent,
  formatBoundAgentState as formatAgentBindingState,
} from '../components/workflow/templateEditorShared.js'

const DEFAULT_TEMPLATE_ID = 'workflow-v1'

const { t } = useI18n()
const skillStore = useSkillStore()

const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const loadError = ref('')
const templates = ref([])
const selectedTemplateId = ref('')
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
  return (template.value?.steps?.length || 0) > MIN_WORKFLOW_TEMPLATE_STEPS
})

const selectedStep = computed(() => {
  return template.value?.steps?.[selectedStepIndex.value] || null
})

const stepValidationHint = computed(() => {
  if (!canDeleteStep.value) {
    return t('workflowTemplate.minimumStepsHint', { count: MIN_WORKFLOW_TEMPLATE_STEPS })
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

const normalizeTemplate = (rawTemplate) => {
  if (!rawTemplate) return null

  return {
    ...normalizeWorkflowTemplate(rawTemplate, null),
    isDraft: rawTemplate.isDraft === true,
    steps: Array.isArray(rawTemplate.steps) ? rawTemplate.steps.map(normalizeWorkflowStep) : []
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

const buildSavePayload = (currentTemplate) => buildWorkflowTemplatePayload(currentTemplate)

const createDraftTemplate = () => ({
  template_id: `draft-${Date.now()}`,
  name: t('workflowTemplate.newTemplateDefaultName'),
  isDraft: true,
  steps: (template.value?.steps || []).map(step => normalizeWorkflowStep(step))
})

const previewSteps = computed(() => {
  return (template.value?.steps || []).map((step, index) => {
    const sanitized = sanitizeWorkflowStep(step)
    let agentSummary = t('workflowTemplate.unassignedAgent')
    let agentStateClass = 'workflow-chip--info'
    let stateClass = 'state-ready'
    let skillNames = []

    if (typeof sanitized.agentId === 'number') {
      if (isMissingAgent(sanitized)) {
        agentSummary = t('workflowTemplate.missingAgent', { id: sanitized.agentId })
        agentStateClass = 'workflow-chip--danger'
        stateClass = 'state-missing'
      } else if (isDisabledAgent(sanitized)) {
        agentSummary = formatBoundAgentState(sanitized)
        agentStateClass = 'workflow-chip--warning'
        stateClass = 'state-disabled'
      } else {
        const agent = getAgentById(sanitized.agentId)
        agentSummary = getAgentLabel(agent)
        agentStateClass = 'workflow-chip--neutral'
        skillNames = (agent?.skills || []).map(skillId => {
          const skill = skillStore.skills.find(s => s.id === skillId)
          if (!skill) return null
          return { name: skill.name || skill.identifier, description: skill.description || '' }
        }).filter(s => s !== null)
      }
    }

    return {
      ...sanitized,
      localKey: `${index}-${step.id || 'empty'}`,
      agentSummary,
      agentStateClass,
      stateClass,
      skillNames,
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
    createEmptyWorkflowStep(t('workflowTemplate.newStepDefaultName'))
  ]
  selectedStepIndex.value = template.value.steps.length - 1
}

const insertStep = (index, position) => {
  if (!template.value) return

  const { steps, insertedIndex } = insertWorkflowStep(
    template.value.steps || [],
    index,
    position,
    createEmptyWorkflowStep(t('workflowTemplate.newStepDefaultName'))
  )
  template.value.steps = steps
  selectedStepIndex.value = insertedIndex
}

const removeStep = (index) => {
  if (!template.value) return

  const { steps, removed } = removeWorkflowStep(template.value.steps || [], index, {
    minSteps: MIN_WORKFLOW_TEMPLATE_STEPS
  })

  if (!removed) {
    ElMessage.warning(t('workflowTemplate.minimumStepsHint', { count: MIN_WORKFLOW_TEMPLATE_STEPS }))
    return
  }

  template.value.steps = steps
  selectedStepIndex.value = resolveSelectedStepIndexAfterRemoval(selectedStepIndex.value, index, steps.length)
  syncSelectedStepIndex()
}

const confirmRemoveStep = async (index) => {
  if (!template.value) return
  if (!canDeleteStep.value) {
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
  return validateWorkflowTemplatePayload(currentTemplate, t, {
    isMissingAgent,
    isDisabledAgent
  })
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
    await Promise.all([loadTemplateList(DEFAULT_TEMPLATE_ID), loadAgents(), skillStore.fetchSkills()])
  } catch (error) {
    loadError.value = getErrorMessage(error, 'workflowTemplate.loadFailed')
  } finally {
    loading.value = false
  }
}

const generateTemplateId = () => {
  const existingIds = new Set(templates.value.filter(item => !item.isDraft).map((item) => item.template_id))
  let index = templates.value.length + 1
  let candidate = `template-${index}`

  while (existingIds.has(candidate)) {
    index += 1
    candidate = `template-${index}`
  }

  return candidate
}

const handleCreateTemplate = () => {
  if (!template.value) return

  addDraftTemplate(createDraftTemplate())
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

  try {
    await ElMessageBox.confirm(
      t('workflowTemplate.deleteTemplateConfirm'),
      t('workflowTemplate.deleteTemplateConfirmTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
  } catch {
    return
  }

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
  padding: 0;
}

.template-layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 20px;
  padding: 0 20px 20px;
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: var(--page-bg);
}

.template-sidebar,
.template-card {
  min-height: 0;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background: var(--panel-bg);
  box-shadow: var(--shadow-sm);
}

.template-card {
  min-width: 0;
}

:deep(.template-sidebar .el-card__body) {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding: 18px;
}

:deep(.template-card .el-card__body) {
  display: flex;
  flex-direction: column;
  gap: 18px;
  height: 100%;
  min-height: 0;
  padding: 18px;
  overflow: auto;
}

.sidebar-section-title {
  margin-bottom: 12px;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.create-template-form {
  display: grid;
  gap: 10px;
  margin-bottom: 14px;
}

.template-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
  overflow: auto;
}

.template-list-item {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
}

.template-list-item:hover {
  border-color: rgba(37, 198, 201, 0.24);
  background: var(--bg-secondary);
}

.template-list-item.is-active {
  border-color: var(--accent-color);
  background: rgba(37, 198, 201, 0.05);
  box-shadow: inset 0 0 0 1px rgba(37, 198, 201, 0.12);
}

.template-list-item__name {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.editor-header {
  margin-bottom: 0;
}

.editor-actions {
  display: flex;
  gap: 8px;
}

.editor-actions :deep(.el-button),
.create-template-form :deep(.el-button),
.section-heading-row :deep(.el-button) {
  min-height: 30px;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
}

.editor-actions :deep(.el-button--primary),
.create-template-form :deep(.el-button--primary),
.section-heading-row :deep(.el-button--primary) {
  background: var(--button-primary-gradient);
  border-color: var(--button-primary-active-border);
  color: var(--button-primary-text);
  box-shadow: var(--button-primary-shadow);
}

.editor-actions :deep(.el-button--primary:hover),
.create-template-form :deep(.el-button--primary:hover),
.section-heading-row :deep(.el-button--primary:hover) {
  background: var(--button-primary-gradient-hover);
  border-color: var(--button-primary-active-border);
  color: var(--button-primary-text);
  box-shadow: var(--button-primary-shadow-hover);
}

.editor-actions :deep(.el-button:not(.el-button--primary)),
.create-template-form :deep(.el-button:not(.el-button--primary)),
.section-heading-row :deep(.el-button:not(.el-button--primary)) {
  background: var(--button-surface-bg);
  border-color: var(--button-surface-border);
  color: var(--button-surface-text);
  box-shadow: var(--button-neutral-shadow);
}

.editor-actions :deep(.el-button:not(.el-button--primary):hover),
.create-template-form :deep(.el-button:not(.el-button--primary):hover),
.section-heading-row :deep(.el-button:not(.el-button--primary):hover) {
  background: var(--button-surface-hover-bg);
  border-color: var(--button-surface-hover-border);
  color: var(--button-surface-hover-text);
}
.editor-actions--template {
  flex-shrink: 0;
}

.template-meta {
  display: grid;
  gap: 10px;
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
  min-width: 88px;
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.meta-value {
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  word-break: break-all;
}

.step-validation-hint {
  margin-top: -4px;
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  line-height: var(--line-height-relaxed);
}

.section-heading-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  min-height: 32px;
}
.section-heading {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.workflow-preview-section {
  margin-bottom: 0;
}

.workflow-preview-shell {
  overflow-x: auto;
  padding: 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background: #fcfdfd;
}

.workflow-preview-track {
  display: flex;
  align-items: stretch;
  min-width: max-content;
  padding: 4px;
}

.workflow-connector {
  position: relative;
  width: 40px;
  flex-shrink: 0;
}

.workflow-connector::before {
  content: '';
  position: absolute;
  left: 8px;
  right: 14px;
  top: 50%;
  height: 1px;
  background: var(--border-color);
  transform: translateY(-50%);
}

.workflow-connector::after {
  content: '';
  position: absolute;
  right: 8px;
  top: 50%;
  width: 0;
  height: 0;
  border-left: 6px solid var(--border-color);
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  transform: translateY(-50%);
}

.workflow-step-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 236px;
  min-height: 176px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background: #fff;
  box-shadow: var(--shadow-sm);
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
}

.workflow-step-card:hover {
  transform: translateY(-1px);
  border-color: rgba(37, 198, 201, 0.24);
  box-shadow: var(--shadow-md);
}

.workflow-step-card.is-selected {
  border-color: var(--accent-color);
  background: linear-gradient(180deg, #ffffff 0%, rgba(37, 198, 201, 0.05) 100%);
  box-shadow: 0 0 0 2px rgba(37, 198, 201, 0.10);
}

.workflow-step-card.has-warning {
  border-color: #fbbf24;
}

.workflow-step-card.state-missing {
  border-color: #ef4444;
}

.workflow-step-card.state-disabled {
  border-color: #f59e0b;
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
  background: rgba(37, 198, 201, 0.12);
  color: var(--accent-color);
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
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.workflow-step-card__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.workflow-step-card__actions {
  display: flex;
  margin-top: auto;
}

.workflow-step-card__action-row {
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  width: 100%;
  justify-content: flex-start;
}

.workflow-step-card__action-row :deep(.el-tooltip) {
  display: inline-flex;
}

.workflow-step-card__action-row :deep(.el-button) {
  width: 28px;
  min-width: 28px;
  height: 28px;
  margin-left: 0;
  padding: 0;
  flex: 0 0 auto;
}

.workflow-step-card__action-row :deep(.el-button .el-icon) {
  font-size: 14px;
}

.workflow-step-card__icon-button {
  width: 28px;
  min-width: 28px;
  height: 28px;
}

.workflow-chip {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  padding: 3px 8px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.4;
}

.workflow-chip--info {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.workflow-chip--neutral {
  background: rgba(37, 198, 201, 0.08);
  color: var(--accent-color);
}

.workflow-chip--warning {
  background: var(--el-color-warning-light-9);
  border-color: var(--el-color-warning-light-5);
  color: var(--el-color-warning-dark-2);
}

.workflow-chip--danger {
  background: var(--el-color-danger-light-9);
  border-color: var(--el-color-danger-light-5);
  color: var(--el-color-danger-dark-2);
}

.workflow-step-card__skills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.workflow-skill-tag {
  display: inline-flex;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  background: rgba(99, 102, 241, 0.08);
  color: #6366f1;
  border: 1px solid rgba(99, 102, 241, 0.15);
}

.step-editor-card {
  padding: 20px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background: #fff;
  box-shadow: var(--shadow-sm);
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

.binding-state-row {
  min-height: 24px;
}

.step-editor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.editor-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.editor-field--full {
  grid-column: 1 / -1;
}

.editor-field label {
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
}

.confirmation-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.confirmation-prompt-field {
  margin-top: 12px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.confirmation-prompt-field label {
  display: block;
  margin-bottom: 8px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
}

.state-block {
  padding: 28px 20px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.state-block.compact {
  padding: 20px;
  border-radius: 8px;
  background: var(--bg-secondary);
  border: 1px dashed var(--border-color);
}

.state-block.error {
  color: var(--el-color-danger);
}

.actions-row {
  display: flex;
  justify-content: center;
  padding-bottom: 16px;
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
  .workflow-step-card {
    width: 180px;
  }
}

@media (max-width: 640px) {
  .template-layout {
    padding: 12px;
    gap: 12px;
  }

  :deep(.template-sidebar .el-card__body),
  :deep(.template-card .el-card__body) {
    padding: 12px;
  }

  .page-header {
    align-items: flex-start;
  }

  .workflow-step-card {
    width: 200px;
  }
}
</style>
