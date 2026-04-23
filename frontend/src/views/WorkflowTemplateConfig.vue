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
            <div class="template-scroll-area">
            <draggable
              v-model="templates"
              item-key="template_id"
              class="template-draggable-list"
              :animation="200"
              ghost-class="template-ghost"
              @end="onTemplateDragEnd"
            >
              <template #item="{ element: item }">
                <button
                  :data-testid="`template-item-${item.template_id}`"
                  type="button"
                  class="template-list-item"
                  :class="{ 'is-active': item.template_id === selectedTemplateId }"
                  @click="selectTemplate(item.template_id)"
                >
                  <span class="template-list-item__name">{{ item.name }}</span>
                  <span
                    v-if="!item.isDraft"
                    class="template-list-item__copy"
                    :data-testid="`copy-template-${item.template_id}`"
                    role="button"
                    tabindex="0"
                    :aria-label="$t('workflowTemplate.copyTemplate')"
                    @click.stop="handleCopyTemplate(item)"
                    @keydown.enter.stop="handleCopyTemplate(item)"
                  >
                    <el-icon :size="14"><CopyDocument /></el-icon>
                  </span>
                </button>
              </template>
            </draggable>
            </div>

            <div class="sidebar-bottom-actions">
                <el-button plain @click="showExportDialog = true">
                  {{ $t('common.export') }}
                </el-button>
                <el-button plain @click="showBundleImportDialog = true">
                  {{ $t('common.import') }}
                </el-button>
                <el-button plain @click="showPresetDialog = true">
                  {{ $t('preset.library') }}
                </el-button>
            </div>
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
                  <el-input v-model="template.name" data-testid="template-name-input" maxlength="200" show-word-limit />
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
              <div class="meta-row meta-row--stacked">
                <span class="meta-label">标签</span>
                <el-select
                  v-model="template.tags"
                  multiple
                  filterable
                  allow-create
                  default-first-option
                  size="small"
                  placeholder="输入标签，回车添加"
                  class="tags-input"
                >
                  <el-option
                    v-for="tag in allTags"
                    :key="tag"
                    :label="tag"
                    :value="tag"
                  />
                </el-select>
              </div>
            </div>
          </div>

          <section class="workflow-preview-section">
            <div class="section-heading-row">
              <div class="section-heading">{{ $t('workflowTemplate.workflowPreview') }}</div>
            </div>
            <div class="workflow-preview-shell">
              <div class="workflow-preview-track">
                <div
                  v-if="previewSteps.length > 0"
                  class="workflow-connector--insert"
                  role="button"
                  tabindex="0"
                  :aria-label="$t('workflowTemplate.insertStepBefore')"
                  @click="insertStep(0, 'before')"
                  @keydown.enter="insertStep(0, 'before')"
                >
                  <span class="workflow-connector__line"></span>
                  <span class="workflow-connector__btn"><el-icon><Plus /></el-icon></span>
                </div>
                <draggable
                  :list="template.steps"
                  item-key="id"
                  :animation="200"
                  ghost-class="step-ghost"
                  class="workflow-draggable-track"
                  @end="onStepDragEnd"
                >
                  <template #item="{ element, index }">
                    <div class="workflow-step-wrapper">
                      <div
                        v-if="index > 0"
                        class="workflow-connector--insert"
                        role="button"
                        tabindex="0"
                        :aria-label="$t('workflowTemplate.insertStepBefore')"
                        @click="insertStep(index, 'before')"
                        @keydown.enter="insertStep(index, 'before')"
                      >
                        <span class="workflow-connector__line"></span>
                        <span class="workflow-connector__btn"><el-icon><Plus /></el-icon></span>
                      </div>
                      <div
                        class="workflow-step-card"
                        :class="{
                          'is-selected': selectedStepIndex === index,
                          'has-warning': previewSteps[index]?.hasWarning,
                          'state-missing': previewSteps[index]?.stateClass === 'state-missing',
                          'state-disabled': previewSteps[index]?.stateClass === 'state-disabled'
                        }"
                        @click="selectStep(index)"
                      >
                        <el-tooltip :content="$t('workflowTemplate.deleteStep')" placement="top">
                          <button
                            class="workflow-step-card__delete"
                            :disabled="!canDeleteStep"
                            :aria-label="$t('workflowTemplate.deleteStep')"
                            @click.stop="confirmRemoveStep(index)"
                          >
                            <el-icon><Delete /></el-icon>
                          </button>
                        </el-tooltip>

                        <div class="workflow-step-card__top">
                          <span class="workflow-step-card__order">{{ index + 1 }}</span>
                        </div>

                        <div class="workflow-step-card__name">{{ previewSteps[index]?.name || $t('workflowTemplate.newStepDefaultName') }}</div>

                        <div class="workflow-step-card__meta">
                          <div class="workflow-step-card__chips">
                            <span class="workflow-chip" :class="previewSteps[index]?.agentStateClass">{{ previewSteps[index]?.agentSummary }}</span>
                            <span v-if="previewSteps[index]?.requiresConfirmation" class="workflow-chip workflow-chip--warning">
                              {{ $t('workflowTemplate.requiresConfirmation') }}
                            </span>
                          </div>
                          <div v-if="previewSteps[index]?.skillNames?.length" class="workflow-step-card__skills">
                            <el-tooltip v-for="skill in previewSteps[index].skillNames" :key="skill.name" :content="skill.description" :disabled="!skill.description" placement="top">
                              <span class="workflow-skill-tag">{{ skill.name }}</span>
                            </el-tooltip>
                          </div>
                        </div>
                      </div>
                    </div>
                  </template>
                </draggable>
                <div
                  v-if="previewSteps.length > 0"
                  class="workflow-connector--insert"
                  role="button"
                  tabindex="0"
                  :aria-label="$t('workflowTemplate.insertStepAfter')"
                  @click="insertStep(previewSteps.length - 1, 'after')"
                  @keydown.enter="insertStep(previewSteps.length - 1, 'after')"
                >
                  <span class="workflow-connector__line"></span>
                  <span class="workflow-connector__btn"><el-icon><Plus /></el-icon></span>
                </div>
              </div>
            </div>
          </section>

          <div v-if="stepValidationHint" class="step-validation-hint">
            {{ stepValidationHint }}
          </div>

          <section class="step-editor-section">
            <div class="section-heading-row">
              <div class="section-heading">{{ $t('workflowTemplate.stepEditor') }}</div>
            </div>

            <div v-if="selectedStep" class="step-editor-card">
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
                <div class="editor-field editor-field--full">
                  <label>{{ $t('workflowTemplate.stepName') }}</label>
                  <el-input
                    v-model="selectedStep.name"
                    :placeholder="$t('workflowTemplate.stepNamePlaceholder')"
                    maxlength="200"
                    show-word-limit
                  />
                </div>

                <div class="editor-field editor-field--with-switch">
                  <label>{{ $t('workflowTemplate.executor') }}</label>
                  <div class="editor-field__row">
                    <el-select v-model="selectedStep.agentId" clearable style="flex: 1">
                      <el-option
                        v-for="agent in agents"
                        :key="agent.id"
                        :label="formatWorkflowAgentOption(agent)"
                        :value="agent.id"
                        :disabled="agent.enabled === false"
                      />
                    </el-select>
                    <el-switch
                      v-model="selectedStep.requiresConfirmation"
                      :active-text="$t('workflowTemplate.requiresConfirmation')"
                    />
                    <el-switch
                      v-model="selectedStep.canEarlyExit"
                      :active-text="$t('workflowTemplate.canEarlyExit')"
                    />
                  </div>
                </div>
              </div>

              <div class="editor-field editor-field--full editor-field--prompt">
                <label>{{ $t('workflowTemplate.instructionPrompt') }}</label>
                <div class="editor-field__hint">{{ $t('workflowTemplate.deliveryPromptGuidance') }}</div>
                <el-input
                  v-model="selectedStep.instructionPrompt"
                  type="textarea"
                  :rows="6"
                  resize="vertical"
                  :placeholder="$t('workflowTemplate.instructionPromptHint')"
                  :maxlength="2000"
                  show-word-limit
                />
                <el-button class="preview-prompt-btn" plain @click="handlePreviewPrompt">
                  {{ $t('workflowTemplate.previewPrompt') }}
                </el-button>
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

    <BaseDialog
      :model-value="showPreviewDialog"
      :title="t('workflowTemplate.previewPromptTitle', { stepName: selectedStep?.name || '' })"
      width="720px"
      @update:model-value="showPreviewDialog = $event"
      @close="showPreviewDialog = false"
    >
      <div v-if="previewLoading" class="preview-prompt-loading">{{ $t('workflowTemplate.previewPromptLoading') }}</div>
      <pre v-else class="preview-prompt-content">{{ previewContent }}</pre>
    </BaseDialog>

    <WorkflowTemplateImportDialog
      v-model="showImportDialog"
      :agents="agents"
      @imported="handleImportComplete"
    />

    <UnifiedExportDialog
      v-model="showExportDialog"
      :templates="templates"
      @exported="handleExported"
    />

    <BundleImportDialog
      v-model="showBundleImportDialog"
      @imported="handleBundleImported"
    />

    <PresetBundleDialog
      v-model="showPresetDialog"
      @imported="handlePresetImported"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CopyDocument, Delete, Plus } from '@element-plus/icons-vue'
import draggable from 'vuedraggable'
import WorkflowTemplateImportDialog from '../components/workflow/WorkflowTemplateImportDialog.vue'
import UnifiedExportDialog from '../components/bundle/UnifiedExportDialog.vue'
import BundleImportDialog from '../components/bundle/BundleImportDialog.vue'
import PresetBundleDialog from '../components/bundle/PresetBundleDialog.vue'
import BaseDialog from '../components/BaseDialog.vue'
import {
  createWorkflowTemplate,
  deleteWorkflowTemplate,
  getWorkflowTemplateById,
  getWorkflowTemplates,
  updateWorkflowTemplate,
  reorderWorkflowTemplates,
  previewPrompt
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

const showImportDialog = ref(false)
const showExportDialog = ref(false)
const showBundleImportDialog = ref(false)
const showPresetDialog = ref(false)

const canDeleteSelected = computed(() => {
  return Boolean(template.value?.template_id) && template.value.template_id !== DEFAULT_TEMPLATE_ID
})

const isDraftTemplate = computed(() => Boolean(template.value?.isDraft))

const allTags = computed(() => [...new Set(templates.value.flatMap(t => t.tags || []))])

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
    tags: Array.isArray(rawTemplate.tags) ? rawTemplate.tags : [],
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

const onStepDragEnd = (evt) => {
  const { oldIndex, newIndex } = evt
  if (oldIndex === newIndex) return
  if (selectedStepIndex.value === oldIndex) {
    selectedStepIndex.value = newIndex
  } else if (oldIndex < selectedStepIndex.value && newIndex >= selectedStepIndex.value) {
    selectedStepIndex.value -= 1
  } else if (oldIndex > selectedStepIndex.value && newIndex <= selectedStepIndex.value) {
    selectedStepIndex.value += 1
  }
}

const onTemplateDragEnd = async (evt) => {
  const { oldIndex, newIndex } = evt
  if (oldIndex === newIndex) return

  try {
    await reorderWorkflowTemplates(templates.value)
  } catch (error) {
    ElMessage.error(t('workflowTemplate.reorderFailed'))
    await loadTemplateList(selectedTemplateId.value)
  }
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

const handleCopyTemplate = (sourceTemplate) => {
  addDraftTemplate({
    template_id: `draft-${Date.now()}`,
    name: `${sourceTemplate.name} (副本)`,
    isDraft: true,
    steps: (sourceTemplate.steps || []).map(step => normalizeWorkflowStep(step))
  })
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

// --- Export/Import ---

const handleExported = () => {
  showExportDialog.value = false
}

const handleImportComplete = async () => {
  showImportDialog.value = false
  await loadTemplateList(selectedTemplateId.value || DEFAULT_TEMPLATE_ID)
  ElMessage.success(t('workflowTemplate.importSuccess'))
}

const handleBundleImported = async () => {
  showBundleImportDialog.value = false
  await loadTemplateList(selectedTemplateId.value || DEFAULT_TEMPLATE_ID)
  ElMessage.success(t('bundle.importSuccess'))
}

const handlePresetImported = async () => {
  await loadTemplateList(selectedTemplateId.value || DEFAULT_TEMPLATE_ID)
}

onMounted(() => {
  loadPage()
})

// --- Prompt Preview ---

const showPreviewDialog = ref(false)
const previewContent = ref('')
const previewLoading = ref(false)

const handlePreviewPrompt = async () => {
  if (!selectedStep.value) return
  const step = selectedStep.value
  if (!step.instructionPrompt?.trim()) {
    ElMessage.warning(t('workflowTemplate.promptPreviewEmpty'))
    return
  }
  const steps = template.value?.steps || []
  const currentIndex = selectedStepIndex.value
  const upstreamSteps = steps.slice(0, currentIndex).map(s => ({ stepId: s.id, name: s.name }))

  previewLoading.value = true
  showPreviewDialog.value = true
  previewContent.value = ''

  try {
    const response = await previewPrompt({
      step: { name: step.name, instructionPrompt: step.instructionPrompt || '', agentId: step.agentId },
      upstreamSteps,
      ...(step.canEarlyExit ? { canEarlyExit: true } : {}),
    })
    if (response?.success) {
      previewContent.value = response.data?.prompt || ''
    } else {
      previewContent.value = ''
      ElMessage.error(response?.message || t('workflowTemplate.previewPromptFailed'))
    }
  } catch (error) {
    previewContent.value = ''
    ElMessage.error(error?.response?.data?.message || error?.message || t('workflowTemplate.previewPromptFailed'))
  } finally {
    previewLoading.value = false
  }
}
</script>

<style scoped>
.workflow-template-config {
  padding: 0;
}

.template-layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  grid-template-rows: 1fr;
  gap: 20px;
  padding: 0 20px 20px;
  flex: 1;
  min-height: 0;
  height: 0;
  overflow: hidden;
  background: var(--page-bg);
}

.template-sidebar {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
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
  height: 100%;
  min-height: 0;
  padding: 18px;
  overflow: hidden;
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
}

.template-scroll-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.sidebar-bottom-actions {
  display: flex;
  flex-shrink: 0;
  gap: 6px;
  padding-top: 12px;
  margin-top: auto;
  border-top: 1px solid var(--border-color);
}

.template-list-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
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

.template-list-item__copy {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  opacity: 0;
  transition: opacity 0.2s ease, background-color 0.2s ease;
}

.template-list-item:hover .template-list-item__copy,
.template-list-item:hover .template-list-item__export {
  opacity: 1;
}

.template-list-item__copy:hover,
.template-list-item__export:hover {
  background: rgba(37, 198, 201, 0.12);
  color: var(--accent-color);
}

.template-list-item__export {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  opacity: 0;
  transition: opacity 0.2s ease, background-color 0.2s ease;
}

.template-list-item__checkbox {
  flex-shrink: 0;
  margin-right: 2px;
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

.template-name-row :deep(.el-input) {
  flex: 0 1 520px;
  width: min(100%, 520px);
  min-width: 320px;
}

.tags-input {
  width: 100%;
  max-width: 520px;
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
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.meta-value {
  font-size: var(--font-size-md);
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
  font-size: var(--font-size-sm);
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

.workflow-draggable-track {
  display: flex;
  align-items: stretch;
  min-width: max-content;
}

.workflow-step-wrapper {
  display: flex;
  align-items: stretch;
}

.step-ghost {
  opacity: 0.4;
  background: rgba(37, 198, 201, 0.08);
  border: 1px dashed var(--accent-color);
}

.template-draggable-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
  flex: 1;
}

.template-ghost {
  opacity: 0.4;
  background: rgba(37, 198, 201, 0.08);
  border: 1px dashed var(--accent-color) !important;
}

.workflow-connector--insert {
  position: relative;
  width: 48px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.workflow-connector__line {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  background: var(--border-color);
  transform: translateY(-50%);
}

.workflow-connector__btn {
  position: relative;
  z-index: 1;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 14px;
  transition: all 0.2s ease;
}

.workflow-connector--insert:hover .workflow-connector__btn {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: #fff;
  box-shadow: 0 2px 8px rgba(37, 198, 201, 0.3);
  transform: scale(1.1);
}

.workflow-step-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 236px;
  min-height: 130px;
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

.workflow-step-card__delete {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: rgba(0, 0, 0, 0.18);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.workflow-step-card__delete:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.workflow-step-card__delete:active {
  color: #dc2626;
  background: rgba(239, 68, 68, 0.18);
}

.workflow-step-card__delete:disabled {
  color: rgba(0, 0, 0, 0.08);
  cursor: not-allowed;
}

.workflow-step-card__delete :deep(.el-icon) {
  font-size: 14px;
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
  background: rgba(37, 198, 201, 0.08);
  color: #25C6C9;
  border: 1px solid rgba(37, 198, 201, 0.15);
}

.step-editor-card {
  position: relative;
  padding: 16px;
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
  grid-template-columns: 1fr;
  gap: 12px;
  max-width: 520px;
}

.editor-field--with-switch .editor-field__row {
  display: flex;
  align-items: center;
  gap: 12px;
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
  font-size: var(--font-size-sm);
  font-weight: 500;
}

.editor-field__hint {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  line-height: var(--line-height-relaxed);
}

.editor-field--prompt {
  margin-top: 12px;
}

.preview-prompt-btn {
  margin-top: 8px;
  align-self: flex-start;
}

.preview-prompt-loading {
  text-align: center;
  padding: 32px 20px;
  color: var(--text-secondary);
  font-size: 13px;
}

.preview-prompt-content {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.7;
  padding: 16px;
  margin: 0;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  max-height: 60vh;
  overflow-y: auto;
  color: var(--text-primary);
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
