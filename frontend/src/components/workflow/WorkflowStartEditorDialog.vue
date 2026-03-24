<template>
  <el-dialog :model-value="modelValue" :title="$t('workflowTemplate.startEditorTitle')" width="920px" @close="handleCancel">
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
            <template v-for="(step, index) in previewSteps" :key="step.localKey">
              <div v-if="index > 0" class="workflow-connector" aria-hidden="true"></div>
              <div
                class="workflow-step-card workflow-start-editor-step"
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

                <div class="workflow-step-card__name workflow-start-editor-step-name">
                  {{ step.name || $t('workflowTemplate.newStepDefaultName') }}
                </div>
                <div class="workflow-start-editor-step-id">{{ step.id }}</div>

                <div class="workflow-step-card__meta workflow-start-editor-step-summary">
                  <span class="workflow-chip" :class="step.agentStateClass">
                    {{ step.agentSummary }}
                  </span>
                </div>

                <div class="workflow-step-card__actions">
                  <el-button size="small" @click.stop="openStepDetails(index)">
                    {{ $t('workflowTemplate.viewDetails') }}
                  </el-button>
                </div>
              </div>
            </template>
          </div>
        </div>
      </section>
    </template>

    <template #footer>
      <el-button @click="handleCancel">{{ $t('common.cancel') }}</el-button>
      <el-button data-testid="confirm-start-button" type="primary" :disabled="!canConfirm" @click="handleConfirm">{{ $t('workflowTemplate.confirmStart') }}</el-button>
    </template>

    <el-dialog
      :model-value="showStepDetailsDialog"
      :title="selectedStep?.name || $t('workflowTemplate.stepDetailsTitle')"
      width="680px"
      append-to-body
      @close="closeStepDetails"
    >
      <div v-if="selectedStep" class="step-editor-card">
        <div class="step-editor-card__header">
          <div>
            <div class="step-editor-card__title">
              {{ selectedStep.name || $t('workflowTemplate.newStepDefaultName') }}
            </div>
          </div>
          <el-button
            data-testid="delete-step-button"
            text
            type="danger"
            :disabled="!canDeleteStep"
            @click="confirmRemoveStep(selectedStepIndex)"
          >
            {{ $t('workflowTemplate.deleteStep') }}
          </el-button>
        </div>

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
        </div>
      </div>

      <template #footer>
        <el-button @click="closeStepDetails">{{ $t('common.close') }}</el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getAgents } from '../../api/agent.js'
import {
  MIN_WORKFLOW_TEMPLATE_STEPS,
  normalizeWorkflowStep,
  normalizeWorkflowTemplate,
  sanitizeWorkflowStep,
  createEmptyWorkflowStep,
  buildWorkflowTemplatePayload,
  validateWorkflowTemplatePayload,
  getAgentDisplayName,
  formatAgentOption,
  createAgentLookup,
  isMissingAgent as checkMissingAgent,
  isDisabledAgent as checkDisabledAgent,
  formatBoundAgentState as formatAgentBindingState,
} from './templateEditorShared.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  draftTemplate: { type: Object, default: null }
})

const emit = defineEmits(['update:modelValue', 'confirm'])
const { t } = useI18n()

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
    const response = await getAgents()
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
const canDeleteStep = computed(() => (localTemplate.value.steps?.length || 0) > MIN_WORKFLOW_TEMPLATE_STEPS)

const previewSteps = computed(() => {
  return (localTemplate.value.steps || []).map((step, index) => {
    const sanitized = sanitizeWorkflowStep(step)
    let agentSummary = t('workflowTemplate.unassignedAgent')
    let agentStateClass = 'workflow-chip--info'
    let stateClass = 'state-ready'

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
        agentSummary = getAgentDisplayName(getAgentById(sanitized.agentId), t)
        agentStateClass = 'workflow-chip--success'
      }
    }

    return {
      ...sanitized,
      localKey: `${index}-${step.id || 'empty'}`,
      agentSummary,
      agentStateClass,
      stateClass,
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

const removeStep = (index) => {
  if (!canDeleteStep.value) {
    ElMessage.warning(t('workflowTemplate.minimumStepsHint', { count: MIN_WORKFLOW_TEMPLATE_STEPS }))
    return
  }

  localTemplate.value.steps = localTemplate.value.steps.filter((_, stepIndex) => stepIndex !== index)
  if (selectedStepIndex.value > index) {
    selectedStepIndex.value -= 1
  } else if (selectedStepIndex.value === index) {
    selectedStepIndex.value = Math.max(0, index - 1)
  }
  syncSelectedStepIndex()
  showStepDetailsDialog.value = false
}

const confirmRemoveStep = async (index) => {
  if (!canDeleteStep.value) {
    ElMessage.warning(t('workflowTemplate.minimumStepsHint', { count: MIN_WORKFLOW_TEMPLATE_STEPS }))
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
  isDisabledAgent
}))

const canConfirm = computed(() => !validationMessage.value)

const handleCancel = () => {
  showStepDetailsDialog.value = false
  emit('update:modelValue', false)
}
const handleConfirm = () => emit('confirm', buildWorkflowTemplatePayload(localTemplate.value))
</script>

<style scoped>
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

.workflow-connector {
  position: relative;
  width: 40px;
  flex-shrink: 0;
}

.workflow-connector::before {
  content: '';
  position: absolute;
  left: 6px;
  right: 12px;
  top: 50%;
  height: 2px;
  background: #94a3b8;
  transform: translateY(-50%);
}

.workflow-connector::after {
  content: '';
  position: absolute;
  right: 6px;
  top: 50%;
  width: 0;
  height: 0;
  border-left: 8px solid #94a3b8;
  border-top: 5px solid transparent;
  border-bottom: 5px solid transparent;
  transform: translateY(-50%);
}

.workflow-start-editor-step {
  width: 210px;
  min-height: 132px;
}

.workflow-step-card {
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
  gap: 8px;
  flex: 1;
}

.workflow-step-card__actions {
  display: flex;
  justify-content: flex-end;
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
</style>
