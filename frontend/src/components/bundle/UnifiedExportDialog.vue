<template>
  <BaseDialog :model-value="modelValue" :title="$t('bundle.exportTitle')" width="680px" @close="handleClose">
    <div class="export-dialog">
      <!-- Step 1: Select workflow templates -->
      <div v-if="step === 'select'" class="export-step">
        <div class="step-hint">{{ $t('bundle.selectTemplatesHint') }}</div>
        <div class="template-list">
          <div
            v-for="tpl in templates"
            :key="tpl.template_id"
            class="template-item"
            :class="{ selected: selectedTemplateIds.includes(tpl.template_id) }"
            @click="toggleTemplate(tpl.template_id)"
          >
            <input
              type="checkbox"
              :checked="selectedTemplateIds.includes(tpl.template_id)"
              class="export-checkbox"
              @click.stop
              @change="toggleTemplate(tpl.template_id)"
            />
            <span class="template-name">{{ tpl.name }}</span>
            <span class="template-id">{{ tpl.template_id }}</span>
          </div>
          <div v-if="templates.length === 0" class="empty-hint">{{ $t('bundle.noTemplates') }}</div>
        </div>

        <div class="bundle-toggle">
          <el-checkbox v-model="bundleMode">
            {{ $t('bundle.bundleExportLabel') }}
          </el-checkbox>
          <div v-if="bundleMode" class="bundle-hint">{{ $t('bundle.bundleExportHint') }}</div>
        </div>
      </div>

      <!-- Step 2: Confirm dependencies (only in bundle mode) -->
      <div v-else-if="step === 'confirm'" class="export-step">
        <div class="step-hint">{{ $t('bundle.confirmDepsHint') }}</div>

        <!-- Templates -->
        <div class="dep-group">
          <div class="dep-group-header">
            <span class="dep-icon">📋</span>
            <span class="dep-label">{{ $t('bundle.workflowLabel') }} ({{ selectedTemplateIds.length }})</span>
          </div>
          <div v-for="tpl in resolveResult.templates" :key="tpl.template_id" class="dep-item">
            <span>{{ tpl.name }}</span>
            <span class="dep-meta">{{ tpl.stepCount }} {{ $t('bundle.stepUnit') }}</span>
          </div>
        </div>

        <!-- Agents -->
        <div v-if="resolveResult.agents.length > 0" class="dep-group">
          <div class="dep-group-header">
            <span class="dep-icon">👤</span>
            <span class="dep-label">{{ $t('bundle.agentLabel') }} ({{ selectedAgents.length }}/{{ resolveResult.agents.length }})</span>
          </div>
          <div v-for="agent in resolveResult.agents" :key="agent.name" class="dep-item">
            <input
              type="checkbox"
              :checked="selectedAgents.includes(agent.name)"
              class="export-checkbox"
              @change="toggleAgent(agent.name)"
            />
            <span>{{ agent.name }}</span>
            <span class="dep-meta" v-if="agent.skillNames.length > 0">{{ agent.skillNames.join(', ') }}</span>
          </div>
        </div>

        <!-- Skills -->
        <div v-if="resolveResult.skills.length > 0" class="dep-group">
          <div class="dep-group-header">
            <span class="dep-icon">📄</span>
            <span class="dep-label">{{ $t('bundle.skillLabel') }} ({{ selectedSkills.length }}/{{ resolveResult.skills.length }})</span>
          </div>
          <div v-for="skill in resolveResult.skills" :key="skill.identifier" class="dep-item">
            <input
              type="checkbox"
              :checked="selectedSkills.includes(skill.identifier)"
              class="export-checkbox"
              @change="toggleSkill(skill.identifier)"
            />
            <span>{{ skill.name }}</span>
            <span class="dep-meta">{{ skill.identifier }}</span>
          </div>
        </div>

        <!-- MCP Servers -->
        <div v-if="resolveResult.mcpServers.length > 0" class="dep-group">
          <div class="dep-group-header">
            <span class="dep-icon">🔧</span>
            <span class="dep-label">{{ $t('bundle.mcpLabel') }} ({{ selectedMcpServers.length }}/{{ resolveResult.mcpServers.length }})</span>
          </div>
          <div v-for="server in resolveResult.mcpServers" :key="server.name" class="dep-item">
            <input
              type="checkbox"
              :checked="selectedMcpServers.includes(server.name)"
              class="export-checkbox"
              @change="toggleMcpServer(server.name)"
            />
            <span>{{ server.name }}</span>
            <span class="dep-meta">{{ server.server_type }}</span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">{{ $t('common.cancel') }}</el-button>
        <el-button v-if="step === 'confirm'" @click="step = 'select'">{{ $t('bundle.back') }}</el-button>
        <el-button
          v-if="step === 'select'"
          type="primary"
          :disabled="selectedTemplateIds.length === 0"
          @click="handleNext"
        >
          {{ $t('bundle.next') }}
        </el-button>
        <el-button
          v-if="step === 'confirm'"
          type="primary"
          :disabled="exporting"
          @click="handleExport"
        >
          {{ exporting ? $t('common.saving') : $t('bundle.confirmExport') }}
        </el-button>
      </div>
    </template>
  </BaseDialog>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import BaseDialog from '../BaseDialog.vue'
import { resolveBundle, exportBundleZip, exportBundle } from '../../api/bundle.js'
import { exportWorkflowTemplates } from '../../api/workflowTemplate.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  templates: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue', 'exported'])

const { t } = useI18n()

const step = ref('select')
const selectedTemplateIds = ref([])
const bundleMode = ref(false)
const resolveResult = ref({ templates: [], agents: [], skills: [], mcpServers: [] })
const selectedAgents = ref([])
const selectedSkills = ref([])
const selectedMcpServers = ref([])
const exporting = ref(false)

const toggleTemplate = (id) => {
  const idx = selectedTemplateIds.value.indexOf(id)
  if (idx >= 0) selectedTemplateIds.value.splice(idx, 1)
  else selectedTemplateIds.value.push(id)
}

const toggleAgent = (name) => {
  const idx = selectedAgents.value.indexOf(name)
  if (idx >= 0) selectedAgents.value.splice(idx, 1)
  else selectedAgents.value.push(name)
}

const toggleSkill = (id) => {
  const idx = selectedSkills.value.indexOf(id)
  if (idx >= 0) selectedSkills.value.splice(idx, 1)
  else selectedSkills.value.push(id)
}

const toggleMcpServer = (name) => {
  const idx = selectedMcpServers.value.indexOf(name)
  if (idx >= 0) selectedMcpServers.value.splice(idx, 1)
  else selectedMcpServers.value.push(name)
}

const handleNext = async () => {
  if (selectedTemplateIds.value.length === 0) return

  if (!bundleMode.value) {
    // Simple export: download JSON directly
    await handleSimpleExport()
    return
  }

  // Bundle mode: resolve dependencies first
  try {
    const res = await resolveBundle(selectedTemplateIds.value)
    if (!res?.success) {
      ElMessage.error(res?.message || t('bundle.resolveFailed'))
      return
    }
    resolveResult.value = res.data
    selectedAgents.value = res.data.agents.map(a => a.name)
    selectedSkills.value = res.data.skills.map(s => s.identifier)
    selectedMcpServers.value = res.data.mcpServers.map(s => s.name)
    step.value = 'confirm'
  } catch (e) {
    ElMessage.error(e?.message || t('bundle.resolveFailed'))
  }
}

const handleSimpleExport = async () => {
  exporting.value = true
  try {
    const data = await exportWorkflowTemplates(selectedTemplateIds.value)
    downloadJson(data, `workflow-templates-${Date.now()}.json`)
    ElMessage.success(t('bundle.exportSuccess'))
    emit('exported')
    handleClose()
  } catch (e) {
    ElMessage.error(e?.message || t('bundle.exportFailed'))
  } finally {
    exporting.value = false
  }
}

const downloadJson = (data, filename) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const handleExport = async () => {
  exporting.value = true
  try {
    const blob = await exportBundleZip({
      templateIds: selectedTemplateIds.value,
      agentNames: selectedAgents.value,
      skillIdentifiers: selectedSkills.value,
      mcpServerNames: selectedMcpServers.value,
    })
    downloadBlob(blob, `bundle-${Date.now()}.zip`)
    ElMessage.success(t('bundle.exportSuccess'))
    emit('exported')
    handleClose()
  } catch (e) {
    // When responseType is 'blob', error responses are Blobs too — try to read the actual error message
    let message = t('bundle.exportFailed')
    const errorData = e?.response?.data
    if (errorData instanceof Blob) {
      try {
        const text = await errorData.text()
        const parsed = JSON.parse(text)
        message = parsed?.message || parsed?.error || message
      } catch { /* use default message */ }
    } else if (e?.message) {
      message = e.message
    }
    ElMessage.error(message)
  } finally {
    exporting.value = false
  }
}

const handleClose = () => {
  step.value = 'select'
  selectedTemplateIds.value = []
  bundleMode.value = false
  resolveResult.value = { templates: [], agents: [], skills: [], mcpServers: [] }
  selectedAgents.value = []
  selectedSkills.value = []
  selectedMcpServers.value = []
  exporting.value = false
  emit('update:modelValue', false)
}
</script>

<style scoped>
.export-dialog {
  min-height: 120px;
}

.export-step {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.step-hint {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.template-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 300px;
  overflow-y: auto;
}

.template-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: border-color 0.2s;
}

.template-item:hover {
  border-color: var(--accent-color);
}

.template-item.selected {
  border-color: var(--accent-color);
  background: rgba(37, 198, 201, 0.05);
}

.export-checkbox {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--accent-color);
}

.template-name {
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.template-id {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  margin-left: auto;
}

.bundle-toggle {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
}

.bundle-hint {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  padding-left: 24px;
}

.dep-group {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.dep-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: var(--bg-secondary);
  font-weight: 600;
  font-size: var(--font-size-sm);
}

.dep-icon {
  font-size: 14px;
}

.dep-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  font-size: var(--font-size-sm);
  border-top: 1px solid var(--border-color);
}

.dep-meta {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  margin-left: auto;
}

.empty-hint {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  text-align: center;
  padding: 20px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
