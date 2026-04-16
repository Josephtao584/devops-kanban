<template>
  <BaseDialog :model-value="modelValue" :title="$t('workflowTemplate.importTitle')" width="680px" @close="handleClose">
    <div class="import-dialog">
      <!-- Step 1: File Upload -->
      <div v-if="step === 'upload'" class="import-step">
        <div class="upload-zone" @click="triggerFileInput" @drop.prevent="handleDrop" @dragover.prevent>
          <input
            ref="fileInput"
            type="file"
            accept=".json"
            style="display: none"
            @change="handleFileSelect"
          />
          <el-icon :size="32" class="upload-icon"><Upload /></el-icon>
          <p class="upload-text">{{ $t('workflowTemplate.importDropHint') }}</p>
          <el-button type="primary" plain>{{ $t('workflowTemplate.importSelectFile') }}</el-button>
        </div>
      </div>

      <!-- Step 2: Preview & Configure -->
      <div v-else-if="step === 'preview'" class="import-step">
        <div class="preview-summary">
          {{ $t('workflowTemplate.importPreviewSummary', { count: previewData.templates.length }) }}
        </div>

        <!-- Template list -->
        <div class="preview-table">
          <div v-for="tpl in previewData.templates" :key="tpl.template_id" class="preview-template-row">
            <div class="preview-template-info">
              <span class="preview-template-name">{{ tpl.name }}</span>
              <span class="preview-template-id">{{ tpl.template_id }}</span>
            </div>
            <div class="preview-template-meta">
              <span class="preview-step-count">{{ $t('workflowTemplate.stepCount', { count: tpl.steps.length }) }}</span>
              <el-tag v-if="isExisting(tpl.template_id)" type="warning" size="small">
                {{ $t('workflowTemplate.importConflict') }}
              </el-tag>
            </div>
          </div>
        </div>

        <!-- Conflict strategy -->
        <div v-if="hasConflicts" class="import-section">
          <div class="import-section-title">{{ $t('workflowTemplate.importConflictStrategy') }}</div>
          <el-radio-group v-model="strategy">
            <el-radio value="skip">{{ $t('workflowTemplate.importStrategySkip') }}</el-radio>
            <el-radio value="overwrite">{{ $t('workflowTemplate.importStrategyOverwrite') }}</el-radio>
            <el-radio value="copy">{{ $t('workflowTemplate.importStrategyCopy') }}</el-radio>
          </el-radio-group>
        </div>

        <!-- Agent mapping -->
        <div v-if="previewData.unmatchedAgentNames.length > 0" class="import-section">
          <div class="import-section-title">{{ $t('workflowTemplate.importAgentMapping') }}</div>
          <div class="import-section-hint">{{ $t('workflowTemplate.importAgentMappingHint') }}</div>
          <div v-for="agentName in previewData.unmatchedAgentNames" :key="agentName" class="agent-mapping-row">
            <span class="agent-mapping-source">{{ agentName }}</span>
            <el-icon><Right /></el-icon>
            <el-select v-model="agentMappings[agentName]" :placeholder="$t('workflowTemplate.importSelectAgent')" clearable style="flex: 1">
              <el-option
                v-for="agent in agents"
                :key="agent.id"
                :label="agent.name"
                :value="agent.id"
              />
            </el-select>
          </div>
        </div>
      </div>

      <!-- Step 3: Result -->
      <div v-else-if="step === 'result'" class="import-step">
        <div class="import-result-summary">
          <el-tag type="success" size="large">
            {{ $t('workflowTemplate.importResultSuccess', { count: result.imported.length }) }}
          </el-tag>
          <el-tag v-if="result.skipped.length > 0" type="info" size="large" style="margin-left: 8px">
            {{ $t('workflowTemplate.importResultSkipped', { count: result.skipped.length }) }}
          </el-tag>
        </div>
        <div v-if="result.imported.length > 0" class="import-result-list">
          <div v-for="tpl in result.imported" :key="tpl.template_id" class="import-result-item">
            <el-icon color="#25C6C9"><Check /></el-icon>
            <span>{{ tpl.name }}</span>
            <span class="import-result-id">{{ tpl.template_id }}</span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">{{ $t('common.cancel') }}</el-button>
        <el-button v-if="step === 'preview'" @click="resetToUpload">{{ $t('workflowTemplate.importBack') }}</el-button>
        <el-button
          v-if="step === 'preview'"
          type="primary"
          :disabled="importing || hasUnmappedAgents"
          @click="handleConfirmImport"
        >
          {{ importing ? $t('common.saving') : $t('workflowTemplate.importConfirm') }}
        </el-button>
        <el-button v-if="step === 'result'" type="primary" @click="handleClose">
          {{ $t('common.confirm') }}
        </el-button>
      </div>
    </template>
  </BaseDialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Check, Right, Upload } from '@element-plus/icons-vue'
import BaseDialog from '../BaseDialog.vue'
import { previewImportWorkflowTemplates, confirmImportWorkflowTemplates } from '../../api/workflowTemplate.js'
import { useImportDialog } from '../../composables/useImportDialog'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  agents: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:modelValue', 'imported'])

const agentMappings = ref({})

const {
  step, fileInput, strategy, importing, previewData, result,
  triggerFileInput, handleFileSelect, handleDrop,
  handleConfirmImport: doConfirmImport,
  resetToUpload: doResetToUpload, handleClose: doClose
} = useImportDialog({
  defaultPreviewData: { templates: [], existingTemplateIds: [], unmatchedAgentNames: [] },
  defaultResultData: { imported: [], skipped: [] },
  onParseFile: async (file, { setPreview, setError, t }) => {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!data.templates || !Array.isArray(data.templates)) {
        setError(t('workflowTemplate.importInvalidFile'))
        return
      }
      const response = await previewImportWorkflowTemplates(data)
      if (!response?.success) {
        setError(response?.message || t('workflowTemplate.importPreviewFailed'))
        return
      }
      agentMappings.value = {}
      setPreview(response.data)
    } catch {
      setError(t('workflowTemplate.importInvalidFile'))
    }
  },
  onConfirmImport: async ({ previewData, strategy }) => {
    const response = await confirmImportWorkflowTemplates({
      templates: previewData.templates,
      strategy,
      agentMappings: { ...agentMappings.value }
    })
    if (!response?.success) {
      throw new Error(response?.message || 'Import failed')
    }
    return response.data
  },
  onClose: () => {
    agentMappings.value = {}
    emit('update:modelValue', false)
  }
})

const hasConflicts = computed(() => previewData.value.existingTemplateIds.length > 0)
const hasUnmappedAgents = computed(() => {
  return previewData.value.unmatchedAgentNames.some(name => agentMappings.value[name] === undefined || agentMappings.value[name] === null)
})

const isExisting = (templateId) => previewData.value.existingTemplateIds.includes(templateId)

const handleConfirmImport = async () => {
  const importResult = await doConfirmImport()
  if (importResult) {
    emit('imported', importResult)
  }
}

const resetToUpload = () => {
  agentMappings.value = {}
  doResetToUpload()
}

const handleClose = () => {
  doClose()
}
</script>

<style scoped>
@import '../../styles/import-dialog.css';

.import-section-hint {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.agent-mapping-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
}

.agent-mapping-source {
  min-width: 120px;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  font-weight: 500;
}
</style>
