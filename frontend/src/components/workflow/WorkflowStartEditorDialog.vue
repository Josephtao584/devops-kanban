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

                    <div class="workflow-step-card__order">{{ String(index + 1).padStart(2, '0') }}</div>

                    <div class="workflow-step-card__head">
                      <div class="workflow-step-card__avatar">
                        <span v-html="previewSteps[index]?.roleConfig?.icon" class="workflow-step-card__avatar-icon"></span>
                      </div>
                      <div class="workflow-step-card__identity">
                        <div class="workflow-step-card__agent-name">{{ previewSteps[index]?.agentName }}</div>
                        <div v-if="previewSteps[index]?.executorLabel" class="workflow-step-card__executor">{{ previewSteps[index]?.executorLabel }}</div>
                      </div>
                    </div>

                    <div class="workflow-step-card__footer">
                      <span class="workflow-step-card__name" :title="previewSteps[index]?.name">{{ previewSteps[index]?.name || $t('workflowTemplate.newStepDefaultName') }}</span>
                      <span v-if="previewSteps[index]?.requiresConfirmation" class="workflow-step-card__flag">
                        {{ $t('workflowTemplate.requiresConfirmation') }}
                      </span>
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

    <div class="worktree-option">
      <el-checkbox v-model="autoCreateWorktree">
        自动创建 worktree（沙箱环境）
      </el-checkbox>
      <div v-if="!autoCreateWorktree" class="worktree-warning">
        <el-icon><Warning /></el-icon>
        <span>警告：不创建 worktree 将在主分支直接修改代码，可能导致代码冲突和丢失。建议勾选此选项。</span>
      </div>
    </div>

    <template #footer>
      <el-button @click="handleCancel">{{ $t('common.cancel') }}</el-button>
      <el-button data-testid="confirm-start-button" type="primary" :loading="confirming" :disabled="!canConfirm || confirming" @click="handleConfirm">{{ $t('workflowTemplate.confirmStart') }}</el-button>
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
          <div class="editor-field editor-field--full editor-field--agent">
            <label class="editor-field__label-strong">{{ $t('workflowTemplate.executor') }}</label>
            <el-select
              v-model="selectedStep.agentId"
              clearable
              class="agent-picker"
              :placeholder="$t('workflowTemplate.unassignedAgent')"
              style="width: 100%"
            >
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
            <label>{{ $t('workflowTemplate.stepName') }}</label>
            <el-input
              v-model="selectedStep.name"
              :placeholder="$t('workflowTemplate.stepNamePlaceholder')"
            />
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
import { Delete, Plus, Warning } from '@element-plus/icons-vue'
import draggable from 'vuedraggable'
import BaseDialog from '../BaseDialog.vue'
import { useAgentStore } from '../../stores/agentStore.js'
import { useSkillStore } from '../../stores/skillStore.js'
import { useWorkflowTemplateStore } from '../../stores/workflowTemplateStore.js'
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
import { getRoleConfig } from '../../constants/agent.js'
import { getExecutorLabel } from '../../constants/executor.js'

const MIN_START_EDITOR_STEPS = 1

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  draftTemplate: { type: Object, default: null },
  taskTitle: { type: String, default: '' },
  taskDescription: { type: String, default: '' },
  taskExternalId: { type: String, default: '' },
  projectEnv: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['update:modelValue', 'confirm'])
const { t } = useI18n()
const skillStore = useSkillStore()
const agentStore = useAgentStore()
const workflowTemplateStore = useWorkflowTemplateStore()

const agents = ref([])
const agentsLoaded = ref(false)
const localTemplate = ref({ template_id: '', name: '', steps: [] })
const selectedStepIndex = ref(0)
const showStepDetailsDialog = ref(false)
const autoCreateWorktree = ref(true)
const confirming = ref(false)

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
    confirming.value = false
  }
}, { immediate: true })

async function loadAgents () {
  agentsLoaded.value = false
  try {
    await Promise.all([
      agentStore.fetchAgents(),
      skillStore.fetchSkills()
    ])
    agents.value = agentStore.agents
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
    let agentName = t('workflowTemplate.unassignedAgent')
    let executorLabel = ''
    let roleConfig = getRoleConfig(null)

    if (typeof sanitized.agentId === 'number') {
      if (isMissingAgent(sanitized)) {
        agentSummary = t('workflowTemplate.missingAgent', { id: sanitized.agentId })
        agentName = agentSummary
        agentStateClass = 'workflow-chip--danger'
        stateClass = 'state-missing'
      } else if (isDisabledAgent(sanitized)) {
        agentSummary = formatBoundAgentState(sanitized)
        agentName = agentSummary
        agentStateClass = 'workflow-chip--warning'
        stateClass = 'state-disabled'
      } else {
        const agent = getAgentById(sanitized.agentId)
        agentSummary = getAgentDisplayName(agent, t)
        agentName = agent?.name || agentSummary
        executorLabel = getExecutorLabel(agent?.executorType)
        roleConfig = getRoleConfig(agent?.role)
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
      agentName,
      executorLabel,
      roleConfig,
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
const handleConfirm = () => {
  confirming.value = true
  emit('confirm', buildWorkflowTemplatePayload(localTemplate.value), autoCreateWorktree.value)
}

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
    const response = await workflowTemplateStore.previewPrompt({
      step: { name: step.name, instructionPrompt: step.instructionPrompt || '', agentId: step.agentId, type: step.type },
      upstreamSteps,
      ...(props.taskTitle ? { taskTitle: props.taskTitle } : {}),
      ...(props.taskDescription ? { taskDescription: props.taskDescription } : {}),
      ...(props.taskExternalId ? { taskExternalId: props.taskExternalId } : {}),
      ...(Object.keys(props.projectEnv).length > 0 ? { projectEnv: props.projectEnv } : {}),
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
.template-meta {
  margin-bottom: 16px;
}

.meta-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
}

.meta-label {
  color: var(--text-secondary);
  min-width: 72px;
}

.meta-value {
  font-weight: 500;
  color: var(--text-primary);
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
  color: var(--text-secondary);
  letter-spacing: 0.02em;
}

.workflow-preview-section {
  margin-bottom: 8px;
}

.workflow-preview-shell {
  overflow-x: auto;
  padding: 14px 8px;
  border-radius: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
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

.workflow-connector--insert {
  position: relative;
  width: 36px;
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
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 12px;
  transition: all 0.18s ease;
}

.workflow-connector--insert:hover .workflow-connector__btn {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: #fff;
  transform: scale(1.05);
}

/* Agent step card (matches template config) */
.workflow-step-card {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 220px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background:
    linear-gradient(135deg, rgba(37, 198, 201, 0.04) 0%, rgba(255, 255, 255, 0) 60%),
    linear-gradient(180deg, #ffffff 0%, #fcfdfd 100%);
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.workflow-step-card:hover {
  transform: translateY(-1px);
  border-color: var(--accent-color);
  box-shadow: 0 4px 12px rgba(37, 198, 201, 0.10);
}

.workflow-step-card.is-selected {
  background:
    linear-gradient(135deg, rgba(37, 198, 201, 0.10) 0%, rgba(37, 198, 201, 0.02) 60%),
    linear-gradient(180deg, #ffffff 0%, #fcfdfd 100%);
}

.workflow-step-card.is-selected .workflow-step-card__avatar {
  background: var(--accent-color-soft);
  color: var(--accent-color-strong);
  border-color: transparent;
}

.workflow-step-card.has-warning {
  border-color: rgba(245, 158, 11, 0.5);
}

.workflow-step-card.state-missing {
  border-color: rgba(239, 68, 68, 0.5);
}

.workflow-step-card.state-disabled {
  border-color: rgba(245, 158, 11, 0.5);
}

.workflow-step-card__order {
  position: absolute;
  top: -2px;
  left: 12px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.08em;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  background: var(--bg-secondary);
  padding: 0 4px;
  z-index: 2;
}

.workflow-step-card__head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
}

.workflow-step-card__avatar {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.workflow-step-card__avatar-icon {
  display: inline-flex;
  width: 16px;
  height: 16px;
}

.workflow-step-card__avatar-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.workflow-step-card__identity {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.workflow-step-card__agent-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.01em;
  line-height: 1.3;
}

.workflow-step-card__executor {
  font-size: 11px;
  color: var(--text-muted);
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

.workflow-step-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--border-color);
  background: linear-gradient(180deg, rgba(37, 198, 201, 0.025), rgba(37, 198, 201, 0.06));
}

.workflow-step-card__name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.workflow-step-card__flag {
  font-size: 11px;
  font-weight: 600;
  color: #b45309;
  white-space: nowrap;
}

.workflow-step-card__delete {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 3;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: rgba(0, 0, 0, 0.18);
  cursor: pointer;
  transition: all 0.18s ease;
}

.workflow-step-card__delete:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.workflow-step-card__delete:disabled {
  color: rgba(0, 0, 0, 0.08);
  cursor: not-allowed;
}

.workflow-step-card__delete :deep(.el-icon) {
  font-size: 13px;
}

/* Step details dialog */
.step-editor-card {
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: #fff;
  padding: 16px;
}

.step-editor-state-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.binding-state-row {
  min-height: 24px;
}

.step-editor-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}

.editor-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.editor-field--full {
  grid-column: 1 / -1;
}

.editor-field--agent {
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--accent-color-soft);
  background:
    linear-gradient(135deg, rgba(37, 198, 201, 0.08) 0%, rgba(37, 198, 201, 0.02) 60%),
    linear-gradient(180deg, #ffffff 0%, #fcfdfd 100%);
}

.editor-field label {
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
}

.editor-field__label-strong {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px !important;
  font-weight: 700 !important;
  color: var(--text-primary) !important;
  letter-spacing: 0.02em;
}

.editor-field__label-strong::before {
  content: '';
  width: 3px;
  height: 13px;
  border-radius: 2px;
  background: var(--accent-color);
}

.agent-picker :deep(.el-input__wrapper) {
  background: #ffffff;
  box-shadow: 0 0 0 1px var(--border-color) inset;
  border-radius: 8px;
  transition: box-shadow 0.18s ease;
}

.agent-picker :deep(.el-input__wrapper:hover),
.agent-picker :deep(.el-select .el-input.is-focus .el-input__wrapper) {
  box-shadow: 0 0 0 1px var(--accent-color) inset;
}

.agent-picker :deep(.el-input__inner) {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.confirmation-header {
  display: flex;
  align-items: center;
  gap: 8px;
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
  border-radius: 8px;
  border: 1px solid var(--border-color);
  max-height: 60vh;
  overflow-y: auto;
  color: var(--text-primary);
}

.worktree-option {
  margin: 12px 0 0;
  padding: 8px 0;
}

.worktree-option :deep(.el-checkbox__label) {
  font-size: 13px;
}

.worktree-warning {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 6px;
  padding: 8px;
  background: rgba(245, 158, 11, 0.08);
  border-radius: 6px;
  font-size: 12px;
  color: #b45309;
}

.worktree-warning .el-icon {
  flex-shrink: 0;
  margin-top: 1px;
}
</style>
