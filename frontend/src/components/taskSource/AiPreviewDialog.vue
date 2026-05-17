<template>
  <BaseDialog
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    :title="step === 'prompt' ? $t('taskSource.aiPreviewPromptTitle', '同步预览 - Prompt') : $t('taskSource.aiPreviewResultsTitle', '同步预览 - AI 结果')"
    width="700px"
    custom-class="ai-preview-dialog"
    append-to-body
  >
    <!-- Step 1: Prompt Preview -->
    <div v-if="step === 'prompt'">
      <div class="ai-prompt-header">
        <span class="prompt-file-count">{{ files.length }} {{ $t('taskSource.aiFilesToAnalyze', '个文件将被分析') }}</span>
      </div>
      <div class="ai-prompt-content">
        <el-input
          :model-value="prompt"
          type="textarea"
          :rows="10"
          class="ai-prompt-editor"
          @update:model-value="emit('update:prompt', $event)"
        />
      </div>
      <div class="ai-prompt-files">
        <div v-for="file in files" :key="file.filename" class="ai-prompt-file-item">
          <span class="file-icon">&#x1F4C4;</span>
          <span class="file-name">{{ file.filename }}</span>
          <span class="file-size">{{ formatFileSize(file.size) }}</span>
        </div>
      </div>
    </div>

    <!-- Step 2: AI Results / Processing -->
    <div v-else>
      <!-- Processing -->
      <div v-if="processing" class="ai-processing">
        <div class="processing-spinner"></div>
        <p>{{ $t('taskSource.aiProcessing', 'AI 正在分析文件，可关闭对话框稍后查看...') }}</p>
      </div>

      <!-- Error -->
      <div v-if="error" class="ai-error">
        <el-alert type="error" :title="error" :closable="false" />
      </div>

      <!-- Fallback warning -->
      <div v-if="allFallback" class="ai-fallback-warning">
        <el-alert type="warning" title="AI 未能生成描述，已使用文件名作为标题。您可以手动编辑后确认导入。" :closable="false" />
      </div>

      <!-- Results -->
      <template v-if="!error && results.length > 0">
        <div class="ai-results-controls">
          <el-button size="small" @click.stop="emit('select-all')">{{ $t('taskSource.selectAll', '全选') }}</el-button>
          <el-button size="small" @click.stop="emit('deselect-all')">{{ $t('taskSource.deselectAll', '取消全选') }}</el-button>
          <span class="selected-count">
            {{ selected.size }} / {{ results.length }} {{ $t('taskSource.selected', '已选') }}
          </span>
        </div>
        <div class="ai-results-list">
          <div
            v-for="item in results"
            :key="item.externalId"
            class="ai-result-item"
            :class="{ selected: selected.has(item.externalId) }"
          >
            <input
              type="checkbox"
              :checked="selected.has(item.externalId)"
              @change="emit('toggle-ai-item', item.externalId)"
            />
            <div class="result-content">
              <div class="result-filename">{{ item.externalId }}</div>
              <el-input v-model="item.title" size="small" :placeholder="$t('taskSource.aiTaskTitle', '任务标题')" class="result-title-input" />
              <el-input
                v-model="item.description"
                type="textarea"
                :rows="2"
                size="small"
                :placeholder="$t('taskSource.aiTaskDesc', '任务描述')"
                class="result-desc-input"
              />
              <div class="result-tag-row">
                <span v-if="item.scenarioTag" class="result-scenario-tag">{{ item.scenarioTag }}</span>
                <el-select
                  v-model="item.recommendedWorkflowTemplateId"
                  size="small"
                  clearable
                  :placeholder="$t('taskSource.aiWorkflowTemplate', '推荐AgentTeam')"
                  class="result-workflow-input"
                >
                  <el-option
                    v-for="tpl in workflowTemplates"
                    :key="tpl.template_id"
                    :label="tpl.name"
                    :value="tpl.template_id"
                  />
                </el-select>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <template #footer>
      <el-button @click.stop="emit('close')">{{ processing ? '关闭' : $t('common.cancel', '取消') }}</el-button>
      <el-button
        v-if="step === 'prompt'"
        type="primary"
        @click.stop="emit('execute')"
        :loading="loading"
        :disabled="files.length === 0"
      >
        {{ $t('taskSource.aiConfirmExecute', '确认执行') }}
      </el-button>
      <el-button
        v-else-if="!processing && !error"
        type="primary"
        @click.stop="emit('confirm-import')"
        :loading="loading"
        :disabled="selected.size === 0"
      >
        {{ $t('taskSource.aiConfirmImport', '确认导入') }} ({{ selected.size }})
      </el-button>
    </template>
  </BaseDialog>
</template>

<script setup>
import { computed } from 'vue'
import BaseDialog from '../BaseDialog.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  step: { type: String, default: 'prompt' },
  processing: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  allFallback: { type: Boolean, default: false },
  prompt: { type: String, default: '' },
  files: { type: Array, default: () => [] },
  results: { type: Array, default: () => [] },
  selected: { type: Set, default: () => new Set() },
  workflowTemplates: { type: Array, default: () => [] }
})

const emit = defineEmits([
  'update:visible',
  'update:prompt',
  'execute',
  'confirm-import',
  'close',
  'select-all',
  'deselect-all',
  'toggle-ai-item'
])

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
</script>

<style scoped>
.ai-prompt-header {
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.prompt-file-count {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.ai-prompt-content {
  max-height: 300px;
  overflow-y: auto;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  padding: 12px;
  margin-bottom: 12px;
}

.ai-prompt-editor :deep(.el-textarea__inner) {
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  line-height: 1.5;
}

.ai-prompt-files {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 120px;
  overflow-y: auto;
}

.ai-prompt-file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  font-size: 12px;
}

.file-icon {
  font-size: 14px;
}

.file-name {
  flex: 1;
  font-weight: 500;
  color: var(--text-primary);
}

.file-size {
  color: var(--text-secondary);
  font-size: 11px;
}

.ai-results-controls {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color);
}

.selected-count {
  font-size: 12px;
  color: var(--text-secondary);
  margin-left: auto;
}

.ai-processing {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 0;
  text-align: center;
}

.processing-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.ai-processing p {
  color: var(--text-secondary);
  margin: 0;
}

.ai-error {
  padding: 24px 0;
}

.ai-fallback-warning {
  padding: 12px 0;
}

.ai-results-list {
  max-height: 400px;
  overflow-y: auto;
}

.ai-result-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px;
  border-radius: var(--radius-sm);
  border-bottom: 1px solid var(--border-color);
}

.ai-result-item.selected {
  background: var(--bg-secondary);
}

.ai-result-item input[type="checkbox"] {
  margin-top: 4px;
  flex-shrink: 0;
}

.result-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.result-filename {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

:deep(.result-title-input .el-input__inner) {
  font-weight: 500;
}

.result-workflow-input {
  width: 100%;
}
.result-workflow-input :deep(.el-input__wrapper) {
  background: var(--bg-secondary);
}

.result-tag-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.result-scenario-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
  white-space: nowrap;
}
</style>
