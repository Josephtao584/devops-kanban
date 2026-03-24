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

      <el-table :data="localTemplate.steps" border stripe>
        <el-table-column prop="name" :label="$t('workflowTemplate.stepName')" min-width="160" />
        <el-table-column prop="id" :label="$t('workflowTemplate.stepId')" min-width="180" />
        <el-table-column :label="$t('workflowTemplate.executor')" min-width="280">
          <template #default="scope">
            <div class="agent-binding-cell">
              <el-select v-model="scope.row.agentId" clearable style="width: 100%">
                <el-option
                  v-for="agent in agents"
                  :key="agent.id"
                  :label="formatWorkflowAgentOption(agent)"
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
            <el-input
              v-model="scope.row.instructionPrompt"
              type="textarea"
              :rows="4"
              resize="vertical"
              :placeholder="$t('workflowTemplate.instructionPromptHint')"
            />
          </template>
        </el-table-column>
      </el-table>
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
</style>
