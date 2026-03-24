<template>
  <div class="workflow-template-config">
    <div class="page-header">
      <div>
        <h1>{{ $t('workflowTemplate.title') }}</h1>
        <p class="page-description">{{ $t('workflowTemplate.description') }}</p>
      </div>
      <el-button type="primary" :disabled="loading || !template || saving" @click="saveTemplate">
        {{ saving ? $t('common.saving', '保存中...') : $t('common.save') }}
      </el-button>
    </div>

    <el-card class="template-card" shadow="never">
      <template v-if="loading">
        <div class="state-block">{{ $t('common.loading') }}</div>
      </template>

      <template v-else-if="loadError">
        <div class="state-block error">{{ loadError }}</div>
        <div class="actions-row">
          <el-button @click="loadPage">{{ $t('workflowTemplate.retry') }}</el-button>
        </div>
      </template>

      <template v-else-if="template">
        <div class="template-meta">
          <div class="meta-row">
            <span class="meta-label">{{ $t('workflowTemplate.templateId') }}</span>
            <span class="meta-value">{{ template.template_id }}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">{{ $t('workflowTemplate.name') }}</span>
            <span class="meta-value">{{ template.name }}</span>
          </div>
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
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { getWorkflowTemplate, updateWorkflowTemplate } from '../api/workflowTemplate'
import { getAgents } from '../api/agent'

const { t } = useI18n()

const loading = ref(false)
const saving = ref(false)
const loadError = ref('')
const template = ref(null)
const agents = ref([])
const agentsLoaded = ref(false)

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

const buildSavePayload = (currentTemplate) => ({
  template_id: currentTemplate.template_id,
  name: currentTemplate.name,
  steps: (currentTemplate.steps || []).map((step) => ({
    id: step.id,
    name: step.name,
    instructionPrompt: step.instructionPrompt ?? '',
    agentId: typeof step.agentId === 'number' && Number.isFinite(step.agentId) ? step.agentId : null
  }))
})

const loadTemplate = async () => {
  loading.value = true
  loadError.value = ''

  try {
    const response = await getWorkflowTemplate()
    template.value = normalizeTemplate(getApiData(response, 'workflowTemplate.loadFailed'))
  } catch (error) {
    loadError.value = getErrorMessage(error, 'workflowTemplate.loadFailed')
  } finally {
    loading.value = false
  }
}

const loadAgents = async () => {
  agentsLoaded.value = false

  try {
    const response = await getAgents()
    const loadedAgents = getApiData(response, 'workflowTemplate.loadAgentsFailed')
    agents.value = Array.isArray(loadedAgents) ? loadedAgents : []
  } catch (error) {
    agents.value = []
    ElMessage.error(getErrorMessage(error, 'workflowTemplate.loadAgentsFailed'))
  } finally {
    agentsLoaded.value = true
  }
}

const loadPage = async () => {
  await Promise.all([loadTemplate(), loadAgents()])
}

const saveTemplate = async () => {
  if (!template.value) return

  saving.value = true
  try {
    const payload = buildSavePayload(template.value)
    const response = await updateWorkflowTemplate(payload)
    template.value = normalizeTemplate(getApiData(response, 'workflowTemplate.saveFailed'))
    ElMessage.success(t('workflowTemplate.saveSuccess'))
  } catch (error) {
    ElMessage.error(getErrorMessage(error, 'workflowTemplate.saveFailed'))
  } finally {
    saving.value = false
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

.template-card {
  border-radius: 12px;
}

.template-meta {
  display: grid;
  gap: 8px;
  margin-bottom: 16px;
}

.meta-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.meta-label {
  color: #666;
  min-width: 96px;
}

.meta-value {
  color: #222;
  font-weight: 500;
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
