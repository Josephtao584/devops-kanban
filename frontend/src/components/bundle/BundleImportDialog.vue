<template>
  <BaseDialog :model-value="modelValue" :title="$t('bundle.importTitle')" width="700px" @close="handleClose">
    <div class="import-dialog">
      <!-- Step 1: Upload -->
      <div v-if="step === 'upload'" class="import-step">
        <div class="upload-zone" @click="triggerFileInput" @drop.prevent="handleDrop" @dragover.prevent>
          <input
            ref="fileInput"
            type="file"
            accept=".json,.zip"
            style="display: none"
            @change="handleFileSelect"
          />
          <el-icon :size="32" class="upload-icon"><Upload /></el-icon>
          <p class="upload-text">{{ $t('bundle.importDropHint') }}</p>
          <el-button type="primary" plain>{{ $t('bundle.importSelectFile') }}</el-button>
        </div>
      </div>

      <!-- Step 2: Preview -->
      <div v-else-if="step === 'preview'" class="import-step">
        <div class="preview-summary">
          {{ $t('bundle.importPreviewSummary') }}
        </div>

        <!-- Workflow Templates -->
        <div v-if="previewData.templates.length > 0" class="dep-group">
          <div class="dep-group-header">
            <span class="dep-icon">📋</span>
            <span>{{ $t('bundle.workflowLabel') }} ({{ previewData.templates.length }})</span>
          </div>
          <div v-for="tpl in previewData.templates" :key="tpl.template_id" class="dep-item">
            <span class="dep-name">{{ tpl.name }}</span>
            <span class="dep-meta">{{ tpl.template_id }}</span>
            <el-tag v-if="conflicts.templateIds.includes(tpl.template_id)" type="warning" size="small">
              {{ $t('bundle.importConflict') }}
            </el-tag>
          </div>
        </div>

        <!-- Agents -->
        <div v-if="previewData.agents.length > 0" class="dep-group">
          <div class="dep-group-header">
            <span class="dep-icon">👤</span>
            <span>{{ $t('bundle.agentLabel') }} ({{ previewData.agents.length }})</span>
          </div>
          <div v-for="agent in previewData.agents" :key="agent.name" class="dep-item">
            <span class="dep-name">{{ agent.name }}</span>
            <span class="dep-meta">{{ agent.role }}</span>
            <el-tag v-if="conflicts.agentNames.includes(agent.name)" type="warning" size="small">
              {{ $t('bundle.importConflict') }}
            </el-tag>
          </div>
        </div>

        <!-- Skills -->
        <div v-if="previewData.skills.length > 0" class="dep-group">
          <div class="dep-group-header">
            <span class="dep-icon">📄</span>
            <span>{{ $t('bundle.skillLabel') }} ({{ previewData.skills.length }})</span>
          </div>
          <div v-for="skill in previewData.skills" :key="skill.identifier" class="dep-item">
            <span class="dep-name">{{ skill.name }}</span>
            <span class="dep-meta">{{ skill.identifier }}</span>
            <el-tag v-if="conflicts.skillIdentifiers.includes(skill.identifier)" type="warning" size="small">
              {{ $t('bundle.importConflict') }}
            </el-tag>
          </div>
        </div>

        <!-- MCP Servers -->
        <div v-if="previewData.mcpServers.length > 0" class="dep-group">
          <div class="dep-group-header">
            <span class="dep-icon">🔧</span>
            <span>{{ $t('bundle.mcpLabel') }} ({{ previewData.mcpServers.length }})</span>
          </div>
          <div v-for="server in previewData.mcpServers" :key="server.name" class="dep-item">
            <span class="dep-name">{{ server.name }}</span>
            <span class="dep-meta">{{ server.server_type }}</span>
            <el-tag v-if="conflicts.mcpServerNames.includes(server.name)" type="warning" size="small">
              {{ $t('bundle.importConflict') }}
            </el-tag>
          </div>
        </div>

        <!-- Conflict strategy -->
        <div v-if="hasConflicts" class="import-section">
          <div class="import-section-title">{{ $t('bundle.importConflictStrategy') }}</div>
          <el-radio-group v-model="strategy">
            <el-radio value="skip">{{ $t('bundle.importStrategySkip') }}</el-radio>
            <el-radio value="overwrite">{{ $t('bundle.importStrategyOverwrite') }}</el-radio>
            <el-radio value="copy">{{ $t('bundle.importStrategyCopy') }}</el-radio>
          </el-radio-group>
        </div>
      </div>

      <!-- Step 3: Result -->
      <div v-else-if="step === 'result'" class="import-step">
        <div class="import-result-summary">
          <el-tag type="success" size="large">
            {{ $t('bundle.importResultSuccess') }}
          </el-tag>
          <el-tag v-if="totalSkipped > 0" type="info" size="large" style="margin-left: 8px">
            {{ $t('bundle.importResultSkipped', { count: totalSkipped }) }}
          </el-tag>
        </div>
        <div class="import-result-details">
          <div v-if="result.imported.templates > 0" class="result-row">
            <span>📋 {{ $t('bundle.workflowLabel') }}</span>
            <span>{{ result.imported.templates }} {{ $t('bundle.imported') }}</span>
          </div>
          <div v-if="result.imported.agents > 0" class="result-row">
            <span>👤 {{ $t('bundle.agentLabel') }}</span>
            <span>{{ result.imported.agents }} {{ $t('bundle.imported') }}</span>
          </div>
          <div v-if="result.imported.skills > 0" class="result-row">
            <span>📄 {{ $t('bundle.skillLabel') }}</span>
            <span>{{ result.imported.skills }} {{ $t('bundle.imported') }}</span>
          </div>
          <div v-if="result.imported.mcpServers > 0" class="result-row">
            <span>🔧 {{ $t('bundle.mcpLabel') }}</span>
            <span>{{ result.imported.mcpServers }} {{ $t('bundle.imported') }}</span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">{{ $t('common.cancel') }}</el-button>
        <el-button v-if="step === 'preview'" @click="resetToUpload">{{ $t('bundle.back') }}</el-button>
        <el-button
          v-if="step === 'preview'"
          type="primary"
          :disabled="importing"
          @click="handleConfirmImport"
        >
          {{ importing ? $t('common.saving') : $t('bundle.importConfirm') }}
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
import { Upload } from '@element-plus/icons-vue'
import BaseDialog from '../BaseDialog.vue'
import { previewImportBundle, confirmImportBundle, previewImportBundleZip, confirmImportBundleZip } from '../../api/bundle.js'
import { previewImportWorkflowTemplates, confirmImportWorkflowTemplates } from '../../api/workflowTemplate.js'
import { useImportDialog } from '../../composables/useImportDialog'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'imported'])

const importVersion = ref('')
const storedZipBase64 = ref(null)

const defaultPreview = { templates: [], agents: [], skills: [], mcpServers: [], conflicts: { templateIds: [], agentNames: [], skillIdentifiers: [], mcpServerNames: [] } }
const defaultResult = { imported: { templates: 0, agents: 0, skills: 0, mcpServers: 0 }, skipped: { templates: 0, agents: 0, skills: 0, mcpServers: 0 } }

const {
  step, fileInput, strategy, importing, previewData, result,
  triggerFileInput, handleFileSelect, handleDrop,
  handleConfirmImport: doConfirmImport,
  resetToUpload: doResetToUpload, handleClose: doClose
} = useImportDialog({
  defaultPreviewData: defaultPreview,
  defaultResultData: defaultResult,
  onParseFile: async (file, { setPreview, setError, t }) => {
    const isZip = file.name.endsWith('.zip')
    if (isZip) {
      await parseZipFile(file, setPreview, setError, t)
    } else {
      await parseJsonFile(file, setPreview, setError, t)
    }
  },
  onConfirmImport: async ({ previewData, strategy }) => {
    let response
    if (storedZipBase64.value) {
      response = await confirmImportBundleZip({ zip: storedZipBase64.value, strategy })
      if (!response?.success) throw new Error(response?.message || 'Import failed')
      return response.data
    }
    if (importVersion.value === '1.0') {
      response = await confirmImportWorkflowTemplates({
        templates: previewData.templates,
        strategy,
        agentMappings: {},
      })
      if (!response?.success) throw new Error(response?.message || 'Import failed')
      const legacyResult = response.data
      return {
        imported: { templates: legacyResult.imported?.length || 0, agents: 0, skills: 0, mcpServers: 0 },
        skipped: { templates: legacyResult.skipped?.length || 0, agents: 0, skills: 0, mcpServers: 0 },
      }
    }
    response = await confirmImportBundle({
      templates: previewData.templates,
      agents: previewData.agents,
      skills: previewData.skills,
      mcpServers: previewData.mcpServers,
      strategy,
    })
    if (!response?.success) throw new Error(response?.message || 'Import failed')
    return response.data
  },
  onClose: () => {
    importVersion.value = ''
    storedZipBase64.value = null
    emit('update:modelValue', false)
  }
})

async function parseJsonFile(file, setPreview, setError, t) {
  try {
    const text = await file.text()
    const data = JSON.parse(text)
    importVersion.value = data.version || '1.0'
    storedZipBase64.value = null

    if (importVersion.value === '2.0') {
      if (!data.templates || !Array.isArray(data.templates)) {
        setError(t('bundle.importInvalidFile'))
        return
      }
      const response = await previewImportBundle(data)
      if (!response?.success) {
        setError(response?.message || t('bundle.importPreviewFailed'))
        return
      }
      setPreview(response.data)
    } else {
      if (!data.templates || !Array.isArray(data.templates)) {
        setError(t('bundle.importInvalidFile'))
        return
      }
      const res = await previewImportWorkflowTemplates(data)
      if (!res?.success) {
        setError(res?.message || t('bundle.importPreviewFailed'))
        return
      }
      importVersion.value = '1.0'
      setPreview({
        templates: res.data.templates,
        agents: [],
        skills: [],
        mcpServers: [],
        conflicts: {
          templateIds: res.data.existingTemplateIds || [],
          agentNames: [],
          skillIdentifiers: [],
          mcpServerNames: [],
        },
      })
    }
  } catch {
    setError(t('bundle.importInvalidFile'))
  }
}

async function parseZipFile(file, setPreview, setError, t) {
  try {
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    const chunks = []
    const chunkSize = 8192
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
      chunks.push(String.fromCharCode.apply(null, chunk))
    }
    storedZipBase64.value = btoa(chunks.join(''))
    importVersion.value = '2.1'

    const res = await previewImportBundleZip({ zip: storedZipBase64.value })
    if (!res?.success) {
      setError(res?.message || t('bundle.importPreviewFailed'))
      return
    }
    setPreview(res.data)
  } catch {
    setError(t('bundle.importInvalidFile'))
  }
}

const conflicts = computed(() => previewData.value.conflicts || { templateIds: [], agentNames: [], skillIdentifiers: [], mcpServerNames: [] })
const hasConflicts = computed(() => {
  const c = conflicts.value
  return c.templateIds.length > 0 || c.agentNames.length > 0 || c.skillIdentifiers.length > 0 || c.mcpServerNames.length > 0
})
const totalSkipped = computed(() => {
  const s = result.value.skipped
  return s.templates + s.agents + s.skills + s.mcpServers
})

const handleConfirmImport = async () => {
  const importResult = await doConfirmImport()
  if (importResult) {
    emit('imported', importResult)
  }
}

const resetToUpload = () => {
  storedZipBase64.value = null
  doResetToUpload()
}

const handleClose = () => {
  doClose()
}
</script>

<style scoped>
@import '../../styles/import-dialog.css';

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

.dep-name {
  font-weight: 500;
}

.dep-meta {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  margin-left: auto;
}

.import-result-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.result-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 14px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
}
</style>
