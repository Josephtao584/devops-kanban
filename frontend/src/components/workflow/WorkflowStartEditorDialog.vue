<template>
  <el-dialog :model-value="modelValue" :title="$t('workflowTemplate.startEditorTitle')" width="960px" @close="handleCancel">
    <template v-if="draftTemplate">
      <div class="template-meta">
        <div class="meta-row">
          <span class="meta-label">{{ $t('workflowTemplate.templateId') }}</span>
          <span class="meta-value">{{ draftTemplate.template_id }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">{{ $t('workflowTemplate.name') }}</span>
          <span class="meta-value">{{ draftTemplate.name }}</span>
        </div>
      </div>

      <div class="workflow-start-editor-flow">
        <template v-for="(step, index) in localTemplate.steps" :key="step.id">
          <div class="workflow-start-editor-step" :class="stepStateClass(step)">
            <div class="workflow-start-editor-step-header">
              <span class="workflow-start-editor-step-dot"></span>
              <div class="workflow-start-editor-step-title-group">
                <span class="workflow-start-editor-step-name">{{ step.name }}</span>
                <span class="workflow-start-editor-step-id">{{ step.id }}</span>
              </div>
            </div>

            <div class="workflow-start-editor-step-body">
              <div class="workflow-start-editor-field">
                <span class="workflow-start-editor-field-label">{{ $t('workflowTemplate.executor') }}</span>
                <div class="agent-binding-cell">
                  <el-select v-model="step.agentId" clearable style="width: 100%">
                    <el-option
                      v-for="agent in agents"
                      :key="agent.id"
                      :label="formatWorkflowAgentOption(agent)"
                      :value="agent.id"
                      :disabled="agent.enabled === false"
                    />
                  </el-select>
                  <div v-if="agentsLoaded" class="binding-state-row">
                    <el-tag v-if="isMissingAgent(step)" type="danger">
                      {{ $t('workflowTemplate.missingAgent', { id: step.agentId }) }}
                    </el-tag>
                    <el-tag v-else-if="isDisabledAgent(step)" type="warning">
                      {{ formatBoundAgentState(step) }}
                    </el-tag>
                  </div>
                </div>
              </div>

              <div class="workflow-start-editor-field">
                <span class="workflow-start-editor-field-label">{{ $t('workflowTemplate.instructionPrompt') }}</span>
                <el-input
                  v-model="step.instructionPrompt"
                  type="textarea"
                  :rows="4"
                  resize="vertical"
                  :placeholder="$t('workflowTemplate.instructionPromptHint')"
                />
              </div>
            </div>
          </div>

          <div v-if="index < localTemplate.steps.length - 1" class="workflow-start-editor-connector">→</div>
        </template>
      </div>
    </template>

    <template #footer>
      <el-button @click="handleCancel">{{ $t('common.cancel') }}</el-button>
      <el-button type="primary" :disabled="!canConfirm" @click="handleConfirm">{{ $t('workflowTemplate.confirmStart') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { getAgents } from '../../api/agent.js'
import {
  normalizeWorkflowTemplate,
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

const normalizeTemplate = (rawTemplate) => normalizeWorkflowTemplate(rawTemplate, { template_id: '', name: '', steps: [] })

watch(() => props.draftTemplate, (value) => {
  localTemplate.value = normalizeTemplate(value)
}, { immediate: true })

watch(() => props.modelValue, async (visible) => {
  if (visible) {
    await loadAgents()
  }
})

const loadAgents = async () => {
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

const stepStateClass = (step) => {
  if (isMissingAgent(step)) return 'state-missing'
  if (isDisabledAgent(step)) return 'state-disabled'
  return 'state-ready'
}

const canConfirm = computed(() => (
  localTemplate.value.steps.length > 0
  && localTemplate.value.steps.every((step) => (
    typeof step.agentId === 'number'
    && Number.isFinite(step.agentId)
    && String(step.instructionPrompt || '').trim()
    && !isMissingAgent(step)
    && !isDisabledAgent(step)
  ))
))

const handleCancel = () => emit('update:modelValue', false)
const handleConfirm = () => emit('confirm', normalizeTemplate(localTemplate.value))
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

.workflow-start-editor-flow {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
  overflow-x: auto;
  padding: 8px 0;
}

.workflow-start-editor-step {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 280px;
  max-width: 320px;
  padding: 16px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}

.workflow-start-editor-step.state-ready {
  border-left: 4px solid #94a3b8;
}

.workflow-start-editor-step.state-missing {
  border-left: 4px solid #ef4444;
}

.workflow-start-editor-step.state-disabled {
  border-left: 4px solid #f59e0b;
}

.workflow-start-editor-step-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.workflow-start-editor-step-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #94a3b8;
  flex-shrink: 0;
}

.state-missing .workflow-start-editor-step-dot {
  background: #ef4444;
}

.state-disabled .workflow-start-editor-step-dot {
  background: #f59e0b;
}

.workflow-start-editor-step-title-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.workflow-start-editor-step-name {
  font-weight: 600;
  color: #334155;
}

.workflow-start-editor-step-id {
  font-size: 12px;
  color: #64748b;
}

.workflow-start-editor-step-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.workflow-start-editor-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.workflow-start-editor-field-label {
  font-size: 12px;
  color: #64748b;
  font-weight: 600;
}

.agent-binding-cell {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.binding-state-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.workflow-start-editor-connector {
  display: flex;
  align-items: center;
  align-self: center;
  color: #cbd5e1;
  font-size: 18px;
  font-weight: 300;
}
</style>
