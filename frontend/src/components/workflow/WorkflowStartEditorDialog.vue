<template>
  <BaseDialog :model-value="modelValue" :title="$t('workflowTemplate.startEditorTitle')" width="920px" @close="handleCancel">
    <template v-if="draftTemplate">
      <div class="template-meta">
        <div class="meta-row">
          <span class="meta-label">{{ $t('workflowTemplate.templateId') }}</span>
          <span class="meta-value">{{ localTemplate.template_id }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">{{ $t('workflowTemplate.name') }}</span>
          <span class="meta-value">{{ localTemplate.name }}</span>
        </div>
      </div>

      <section class="workflow-preview-section">
        <div class="section-heading-row">
          <div class="section-heading">{{ $t('workflowTemplate.workflowPreview') }}</div>
          <el-button data-testid="add-step-button" plain @click="addStep">
            {{ $t('workflowTemplate.addStep') }}
          </el-button>
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
              :list="localTemplate.steps"
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
                    class="workflow-step-card workflow-start-editor-step"
                    :class="{
                      'is-selected': selectedStepIndex === index,
                      'has-warning': previewSteps[index]?.hasWarning,
                      'state-missing': previewSteps[index]?.stateClass === 'state-missing',
                      'state-disabled': previewSteps[index]?.stateClass === 'state-disabled'
                    }"
                    @click="openStepDetails(index)"
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

                    <div class="workflow-step-card__name workflow-start-editor-step-name">
                      {{ previewSteps[index]?.name || $t('workflowTemplate.newStepDefaultName') }}
                    </div>

                    <div class="workflow-step-card__meta workflow-start-editor-step-summary">
                      <div class="workflow-step-card__chips">
                        <span class="workflow-chip" :class="previewSteps[index]?.agentStateClass">
                          {{ previewSteps[index]?.agentSummary }}
                        </span>
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
    </template>

    <template #footer>
      <el-button @click="handleCancel">{{ $t('common.cancel') }}</el-button>
      <el-button data-testid="confirm-start-button" type="primary" :disabled="!canConfirm" @click="handleConfirm">{{ $t('workflowTemplate.confirmStart') }}</el-button>
    </template>

    <BaseDialog
      :model-value="showStepDetailsDialog"
      :title="selectedStep?.name || $t('workflowTemplate.stepDetailsTitle')"
      width="680px"
      :append-to-body="true"
      @update:model-value="showStepDetailsDialog = $event"
      @close="closeStepDetails"
    >
      <div v-if="selectedStep" class="step-editor-card">
        <div class="step-editor-state-row binding-state-row">
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

      <template #footer>
        <el-button plain @click="handlePreviewPrompt">{{ $t('workflowTemplate.previewPrompt') }}</el-button>
        <el-button @click="closeStepDetails">{{ $t('common.close') }}</el-button>
      </template>
    </BaseDialog>

    <BaseDialog
      :model-value="showPreviewDialog"
      :title="t('workflowTemplate.previewPromptTitle', { stepName: selectedStep?.name || '' })"
      width="720px"
      :append-to-body="true"
      @update:model-value="showPreviewDialog = $event"
      @close="showPreviewDialog = false"
    >
      <div v-if="previewLoading" class="preview-prompt-loading">{{ $t('workflowTemplate.previewPromptLoading') }}</div>
      <pre v-else class="preview-prompt-content">{{ previewContent }}</pre>
      <template #footer>
        <el-button @click="showPreviewDialog = false">{{ $t('common.close') }}</el-button>
      </template>
    </BaseDialog>
  </BaseDialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Plus } from '@element-plus/icons-vue'
import draggable from 'vuedraggable'
import BaseDialog from '../BaseDialog.vue'
import { getAgents } from '../../api/agent.js'
import { useSkillStore } from '../../stores/skillStore'
import {
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
} from './templateEditorShared.js'
import { previewPrompt } from '../../api/workflowTemplate'

const MIN_START_EDITOR_STEPS = 1

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  draftTemplate: { type: Object, default: null },
  taskTitle: { type: String, default: '' },
  taskDescription: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue', 'confirm'])
const { t } = useI18n()
const skillStore = useSkillStore()

const agents = ref([])
const agentsLoaded = ref(false)
const localTemplate = ref({ template_id: '', name: '', steps: [] })
const selectedStepIndex = ref(0)
const showStepDetailsDialog = ref(false)

const normalizeTemplate = (rawTemplate) => {
  const normalized = normalizeWorkflowTemplate(rawTemplate, { template_id: '', name: '', steps: [] })
  return {
    ...normalized,
    steps: Array.isArray(normalized.steps) ? normalized.steps.map(normalizeWorkflowStep) : []
  }
}

watch(() => props.draftTemplate, (value) => {
  localTemplate.value = normalizeTemplate(value)
  selectedStepIndex.value = 0
  showStepDetailsDialog.value = false
}, { immediate: true })

watch(() => props.modelValue, async (visible) => {
  if (visible) {
    await loadAgents()
  } else {
    showStepDetailsDialog.value = false
  }
}, { immediate: true })

async function loadAgents () {
  agentsLoaded.value = false
  try {
    const [response] = await Promise.all([
      getAgents(),
      skillStore.fetchSkills()
    ])
    agents.value = response?.success && Array.isArray(response.data) ? response.data : []
  } catch (error) {
    agents.value = []
    ElMessage.error(error?.response?.data?.message || error?.message || t('workflowTemplate.loadAgentsFailed'))
  } finally {
    agentsLoaded.value = true
  }
}

const getAgentById = (agentId) => createAgentLookup(agents.value)(agentId)
const isMissingAgent = (step) => checkMissingAgent(step, getAgentById)
const isDisabledAgent = (step) => checkDisabledAgent(step, getAgentById)
const formatWorkflowAgentOption = (agent) => formatAgentOption(agent, t)
const formatBoundAgentState = (step) => formatAgentBindingState(step, getAgentById, t)
const selectedStep = computed(() => localTemplate.value.steps[selectedStepIndex.value] || null)
const canDeleteStep = computed(() => (localTemplate.value.steps?.length || 0) > MIN_START_EDITOR_STEPS)

const previewSteps = computed(() => {
  return (localTemplate.value.steps || []).map((step, index) => {
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
        agentSummary = getAgentDisplayName(agent, t)
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

const selectStep = (index) => {
  selectedStepIndex.value = index
}

const syncSelectedStepIndex = () => {
  const stepCount = localTemplate.value.steps.length || 0
  if (stepCount === 0) {
    selectedStepIndex.value = 0
    return
  }
  if (selectedStepIndex.value >= stepCount) {
    selectedStepIndex.value = stepCount - 1
  }
}

const addStep = () => {
  localTemplate.value.steps = [
    ...(localTemplate.value.steps || []),
    createEmptyWorkflowStep(t('workflowTemplate.newStepDefaultName'))
  ]
  selectedStepIndex.value = localTemplate.value.steps.length - 1
}

const insertStep = (index, position) => {
  const { steps, insertedIndex } = insertWorkflowStep(
    localTemplate.value.steps || [],
    index,
    position,
    createEmptyWorkflowStep(t('workflowTemplate.newStepDefaultName'))
  )
  localTemplate.value.steps = steps
  selectedStepIndex.value = insertedIndex
  showStepDetailsDialog.value = true
}

const removeStep = (index) => {
  const { steps, removed } = removeWorkflowStep(localTemplate.value.steps || [], index, {
    minSteps: MIN_START_EDITOR_STEPS
  })

  if (!removed) {
    ElMessage.warning(t('workflowTemplate.minimumStepsHint', { count: MIN_START_EDITOR_STEPS }))
    return
  }

  localTemplate.value.steps = steps
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

const confirmRemoveStep = async (index) => {
  if (!canDeleteStep.value) {
    ElMessage.warning(t('workflowTemplate.minimumStepsHint', { count: MIN_START_EDITOR_STEPS }))
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

const openStepDetails = (index) => {
  selectStep(index)
  showStepDetailsDialog.value = true
}

const closeStepDetails = () => {
  showStepDetailsDialog.value = false
}

const validationMessage = computed(() => validateWorkflowTemplatePayload(localTemplate.value, t, {
  requireTemplateName: false,
  requireExistingEnabledAgent: true,
  isMissingAgent,
  isDisabledAgent,
  minSteps: MIN_START_EDITOR_STEPS
}))

const canConfirm = computed(() => !validationMessage.value)

const handleCancel = () => {
  showStepDetailsDialog.value = false
  emit('update:modelValue', false)
}
const handleConfirm = () => emit('confirm', buildWorkflowTemplatePayload(localTemplate.value))

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
  const steps = localTemplate.value?.steps || []
  const currentIndex = selectedStepIndex.value
  const upstreamSteps = steps.slice(0, currentIndex).map(s => ({ stepId: s.id, name: s.name }))

  previewLoading.value = true
  showPreviewDialog.value = true
  previewContent.value = ''

  try {
    const response = await previewPrompt({
      step: { name: step.name, instructionPrompt: step.instructionPrompt || '', agentId: step.agentId },
      upstreamSteps,
      ...(props.taskTitle ? { taskTitle: props.taskTitle } : {}),
      ...(props.taskDescription ? { taskDescription: props.taskDescription } : {}),
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
  color: #25C6C9;
  border: 1px solid rgba(99, 102, 241, 0.15);
}

.template-meta {
  margin-bottom: 16px;
}

.meta-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.meta-label {
  color: #666;
  min-width: 72px;
}

.meta-value {
  font-weight: 500;
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
  margin-bottom: 8px;
}

.workflow-preview-shell {
  overflow-x: auto;
  padding: 10px 4px 14px;
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
  background: rgba(59, 130, 246, 0.08);
  border: 1px dashed #3b82f6;
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
  background: #94a3b8;
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
  border: 1px solid #94a3b8;
  color: #64748b;
  font-size: 14px;
  transition: all 0.2s ease;
}

.workflow-connector--insert:hover .workflow-connector__btn {
  background: #3b82f6;
  border-color: #3b82f6;
  color: #fff;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
  transform: scale(1.1);
}

.workflow-start-editor-step {
  width: 236px;
  min-height: 130px;
}

.workflow-step-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
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

.workflow-start-editor-step-id {
  font-size: 12px;
  color: #64748b;
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

.workflow-chip--success {
  background: #dcfce7;
  color: #15803d;
}

.workflow-chip--neutral {
  background: #e2e8f0;
  color: #334155;
}

.workflow-chip--warning {
  background: #fef3c7;
  color: #b45309;
}

.workflow-chip--danger {
  background: #fee2e2;
  color: #b91c1c;
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

.confirmation-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.confirmation-prompt-field {
  margin-top: 12px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.confirmation-prompt-field label {
  display: block;
  margin-bottom: 8px;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
}

@media (max-width: 900px) {
  .step-editor-grid {
    grid-template-columns: 1fr;
  }

  .editor-field--full {
    grid-column: auto;
  }

  .workflow-start-editor-step {
    width: 180px;
  }
}

.preview-prompt-loading {
  text-align: center;
  padding: 32px 20px;
  color: var(--text-secondary, #64748b);
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
  background: var(--bg-secondary, #f8fafc);
  border-radius: 8px;
  border: 1px solid var(--border-color, #e2e8f0);
  max-height: 60vh;
  overflow-y: auto;
  color: var(--text-primary, #0f172a);
}
</style>
