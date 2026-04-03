<template>
  <el-dialog
    :model-value="modelValue"
    :close-on-click-modal="false"
    :title="$t('workflowTemplate.selectDialogTitle')"
    width="560px"
    @update:modelValue="emit('update:modelValue', $event)"
  >
    <div v-if="loading" class="workflow-template-select-dialog__state">
      {{ $t('common.loading') }}
    </div>

    <div v-else-if="errorMessage" class="workflow-template-select-dialog__state workflow-template-select-dialog__state--error">
      <div>{{ errorMessage }}</div>
      <el-button @click="loadTemplates">{{ $t('workflowTemplate.retry') }}</el-button>
    </div>

    <div v-else-if="templates.length === 0" class="workflow-template-select-dialog__state">
      {{ $t('workflowTemplate.emptyState') }}
    </div>

    <div v-else>
      <div v-if="recommendedSelectedTemplateName" class="workflow-template-select-dialog__hint">
        {{ $t('workflowTemplate.recommendedTemplateHint') }}：{{ recommendedSelectedTemplateName }}
      </div>

      <div class="workflow-template-select-dialog__list">
        <label
          v-for="template in templates"
          :key="template.template_id"
          class="workflow-template-select-dialog__option"
        >
        <input
          v-model="selectedTemplateId"
          type="radio"
          name="workflow-template"
          :value="template.template_id"
        >
        <div class="workflow-template-select-dialog__option-content">
          <div class="workflow-template-select-dialog__option-name">{{ template.name }}</div>
          <div class="workflow-template-select-dialog__option-meta">
            {{ $t('workflowTemplate.stepCount', { count: template.steps?.length || 0 }) }}
          </div>
        </div>
        </label>
      </div>
    </div>

    <div class="workflow-template-select-dialog__worktree-option">
      <el-checkbox v-model="autoCreateWorktree">
        自动创建 worktree（沙箱环境）
      </el-checkbox>
      <div v-if="!autoCreateWorktree" class="workflow-template-select-dialog__worktree-warning">
        <el-icon><Warning /></el-icon>
        <span>警告：不创建 worktree 将在主分支直接修改代码，可能导致代码冲突和丢失。建议勾选此选项。</span>
      </div>
    </div>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">{{ $t('common.cancel') }}</el-button>
      <el-button :disabled="!selectedTemplateId || loading || templates.length === 0" type="primary" @click="confirmSelection">
        {{ $t('common.confirm') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Warning } from '@element-plus/icons-vue'
import { getWorkflowTemplates } from '../../api/workflowTemplate'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  recommendedTemplateId: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue', 'confirm'])
const { t } = useI18n()

const loading = ref(false)
const templates = ref([])
const errorMessage = ref('')
const selectedTemplateId = ref('')
const autoCreateWorktree = ref(true)

const getTemplateById = (templateId) => templates.value.find((template) => template.template_id === templateId) || null
const recommendedSelectedTemplateName = computed(() => {
  if (!props.recommendedTemplateId) return ''
  if (selectedTemplateId.value !== props.recommendedTemplateId) return ''
  return getTemplateById(props.recommendedTemplateId)?.name || ''
})

const loadTemplates = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await getWorkflowTemplates()
    if (!response?.success) {
      throw new Error(response?.message || t('workflowTemplate.loadFailed'))
    }

    templates.value = Array.isArray(response.data) ? response.data : []
    const recommendedTemplate = templates.value.find((template) => template.template_id === props.recommendedTemplateId)
    selectedTemplateId.value = recommendedTemplate?.template_id || templates.value[0]?.template_id || ''
  } catch (error) {
    templates.value = []
    errorMessage.value = error?.message || t('workflowTemplate.loadFailed')
  } finally {
    loading.value = false
  }
}

const confirmSelection = () => {
  if (!selectedTemplateId.value) return
  emit('confirm', { templateId: selectedTemplateId.value, autoCreateWorktree: autoCreateWorktree.value })
}

watch(() => props.modelValue, (value) => {
  if (value) {
    loadTemplates()
  } else {
    selectedTemplateId.value = ''
    errorMessage.value = ''
    autoCreateWorktree.value = true
  }
}, { immediate: true })
</script>

<style scoped>
.workflow-template-select-dialog__state {
  display: flex;
  min-height: 120px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
  text-align: center;
}

.workflow-template-select-dialog__state--error {
  color: var(--el-color-danger);
}

.workflow-template-select-dialog__hint {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary-dark-2);
  font-size: 12px;
  line-height: 1.5;
}

.workflow-template-select-dialog__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.workflow-template-select-dialog__option {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  cursor: pointer;
}

.workflow-template-select-dialog__option-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.workflow-template-select-dialog__option-name {
  font-weight: 600;
}

.workflow-template-select-dialog__option-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.workflow-template-select-dialog__worktree-option {
  margin-top: 16px;
  padding: 12px 0 0;
}

.workflow-template-select-dialog__worktree-option :deep(.el-checkbox) {
  --el-checkbox-font-size: 12px;
}

.workflow-template-select-dialog__worktree-option :deep(.el-checkbox__label) {
  font-size: 12px;
}

.workflow-template-select-dialog__worktree-warning {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 8px;
  padding: 8px;
  background-color: var(--el-color-warning-light);
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--el-color-warning-dark-2);
}

.workflow-template-select-dialog__worktree-warning .el-icon {
  flex-shrink: 0;
  margin-top: 2px;
}
</style>
