<template>
  <el-dialog
    :model-value="modelValue"
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

    <div v-else class="workflow-template-select-dialog__list">
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

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">{{ $t('common.cancel') }}</el-button>
      <el-button :disabled="!selectedTemplateId || loading || templates.length === 0" type="primary" @click="confirmSelection">
        {{ $t('common.confirm') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getWorkflowTemplates } from '../../api/workflowTemplate'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'confirm'])
const { t } = useI18n()

const loading = ref(false)
const templates = ref([])
const errorMessage = ref('')
const selectedTemplateId = ref('')

const loadTemplates = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await getWorkflowTemplates()
    if (!response?.success) {
      throw new Error(response?.message || t('workflowTemplate.loadFailed'))
    }

    templates.value = Array.isArray(response.data) ? response.data : []
    selectedTemplateId.value = ''
  } catch (error) {
    templates.value = []
    errorMessage.value = error?.message || t('workflowTemplate.loadFailed')
  } finally {
    loading.value = false
  }
}

const confirmSelection = () => {
  if (!selectedTemplateId.value) return
  emit('confirm', selectedTemplateId.value)
}

watch(() => props.modelValue, (value) => {
  if (value) {
    loadTemplates()
  } else {
    selectedTemplateId.value = ''
    errorMessage.value = ''
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
</style>
