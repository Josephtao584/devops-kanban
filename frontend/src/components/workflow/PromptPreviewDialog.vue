<template>
  <BaseDialog
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    :title="t('workflowTemplate.previewPromptTitle', { stepName: stepName || '' })"
    width="720px"
    @close="emit('close')"
  >
    <div v-if="loading" class="preview-prompt-loading">{{ t('workflowTemplate.previewPromptLoading') }}</div>
    <pre v-else class="preview-prompt-content">{{ content }}</pre>
  </BaseDialog>
</template>

<script setup>
import BaseDialog from '../BaseDialog.vue'
import { useI18n } from 'vue-i18n'

defineProps({
  visible: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  content: { type: String, default: '' },
  stepName: { type: String, default: '' }
})

const emit = defineEmits(['update:visible', 'close'])

const { t } = useI18n()
</script>

<style scoped>
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
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  max-height: 60vh;
  overflow-y: auto;
  color: var(--text-primary);
}
</style>
