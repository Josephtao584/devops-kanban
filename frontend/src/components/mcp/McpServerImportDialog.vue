<template>
  <BaseDialog :model-value="modelValue" :title="$t('mcpServer.importTitle')" width="680px" @close="handleClose">
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
          <p class="upload-text">{{ $t('mcpServer.importDropHint') }}</p>
          <el-button type="primary" plain>{{ $t('mcpServer.importSelectFile') }}</el-button>
        </div>
      </div>

      <!-- Step 2: Preview & Configure -->
      <div v-else-if="step === 'preview'" class="import-step">
        <div class="preview-summary">
          {{ $t('mcpServer.importPreviewSummary', { count: previewData.servers.length }) }}
        </div>

        <!-- Server list -->
        <div class="preview-table">
          <div v-for="server in previewData.servers" :key="server.name" class="preview-template-row">
            <div class="preview-template-info">
              <span class="preview-template-name">{{ server.name }}</span>
              <span class="preview-template-id">{{ server.server_type }} · {{ server.description || '-' }}</span>
            </div>
            <div class="preview-template-meta">
              <el-tag v-if="isExisting(server.name)" type="warning" size="small">
                {{ $t('mcpServer.importConflict') }}
              </el-tag>
            </div>
          </div>
        </div>

        <!-- Conflict strategy -->
        <div v-if="hasConflicts" class="import-section">
          <div class="import-section-title">{{ $t('mcpServer.importConflictStrategy') }}</div>
          <el-radio-group v-model="strategy">
            <el-radio value="skip">{{ $t('mcpServer.importStrategySkip') }}</el-radio>
            <el-radio value="overwrite">{{ $t('mcpServer.importStrategyOverwrite') }}</el-radio>
            <el-radio value="copy">{{ $t('mcpServer.importStrategyCopy') }}</el-radio>
          </el-radio-group>
        </div>
      </div>

      <!-- Step 3: Result -->
      <div v-else-if="step === 'result'" class="import-step">
        <div class="import-result-summary">
          <el-tag type="success" size="large">
            {{ $t('mcpServer.importResultSuccess', { count: result.imported.length }) }}
          </el-tag>
          <el-tag v-if="result.skipped.length > 0" type="info" size="large" style="margin-left: 8px">
            {{ $t('mcpServer.importResultSkipped', { count: result.skipped.length }) }}
          </el-tag>
        </div>
        <div v-if="result.imported.length > 0" class="import-result-list">
          <div v-for="server in result.imported" :key="server.name" class="import-result-item">
            <el-icon color="#25C6C9"><Check /></el-icon>
            <span>{{ server.name }}</span>
            <span class="import-result-id">{{ server.server_type }}</span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">{{ $t('common.cancel') }}</el-button>
        <el-button v-if="step === 'preview'" @click="resetToUpload">{{ $t('mcpServer.importBack') }}</el-button>
        <el-button
          v-if="step === 'preview'"
          type="primary"
          :disabled="importing"
          @click="handleConfirmImport"
        >
          {{ importing ? $t('common.saving') : $t('mcpServer.importConfirm') }}
        </el-button>
        <el-button v-if="step === 'result'" type="primary" @click="handleClose">
          {{ $t('common.confirm') }}
        </el-button>
      </div>
    </template>
  </BaseDialog>
</template>

<script setup>
import { computed } from 'vue'
import { Check, Upload } from '@element-plus/icons-vue'
import BaseDialog from '../BaseDialog.vue'
import { mcpServerApi } from '../../api/mcpServer.js'
import { useImportDialog } from '../../composables/useImportDialog'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'imported'])

const {
  step, fileInput, strategy, importing, previewData, result,
  triggerFileInput, handleFileSelect, handleDrop,
  handleConfirmImport: doConfirmImport,
  resetToUpload, handleClose: doClose
} = useImportDialog({
  defaultPreviewData: { servers: [], existingServerNames: [] },
  defaultResultData: { imported: [], skipped: [] },
  onParseFile: async (file, { setPreview, setError, t }) => {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!data.servers || !Array.isArray(data.servers)) {
        setError(t('mcpServer.importInvalidFile'))
        return
      }
      const response = await mcpServerApi.previewImportMcpServers(data)
      if (!response?.success) {
        setError(response?.message || t('mcpServer.importPreviewFailed'))
        return
      }
      setPreview(response.data)
    } catch {
      setError(t('mcpServer.importInvalidFile'))
    }
  },
  onConfirmImport: async ({ previewData, strategy }) => {
    const response = await mcpServerApi.confirmImportMcpServers({
      servers: previewData.servers,
      strategy,
      nameMappings: {},
    })
    if (!response?.success) {
      throw new Error(response?.message || 'Import failed')
    }
    return response.data
  },
  onClose: () => {
    emit('update:modelValue', false)
  }
})

const hasConflicts = computed(() => previewData.value.existingServerNames.length > 0)
const isExisting = (name) => previewData.value.existingServerNames.includes(name)

const handleConfirmImport = async () => {
  const importResult = await doConfirmImport()
  if (importResult) {
    emit('imported', importResult)
  }
}

const handleClose = () => {
  doClose()
}
</script>

<style scoped>
@import '../../styles/import-dialog.css';
</style>
