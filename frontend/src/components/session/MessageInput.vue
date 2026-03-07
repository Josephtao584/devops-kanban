<template>
  <div class="message-input-container">
    <div class="input-wrapper">
      <el-input
        v-model="inputModel"
        type="textarea"
        :rows="1"
        :autosize="{ minRows: 1, maxRows: 4 }"
        :placeholder="placeholder"
        :disabled="disabled"
        @keyup.enter.exact="handleSend"
      />
      <el-button
        type="primary"
        :disabled="!canSend"
        @click="handleSend"
      >
        <el-icon><Position /></el-icon>
      </el-button>
    </div>
    <div v-if="hint" class="input-hint">{{ hint }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Position } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  },
  hint: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue', 'send'])

const { t } = useI18n()

const inputModel = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const canSend = computed(() => {
  return !props.disabled && inputModel.value.trim()
})

const handleSend = () => {
  if (canSend.value) {
    emit('send', inputModel.value.trim())
  }
}
</script>

<style scoped>
.message-input-container {
  padding: 12px 16px;
  background: var(--panel-bg, #171717);
  border-top: 1px solid var(--border-color, #262626);
}

.input-wrapper {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.input-wrapper :deep(.el-textarea) {
  flex: 1;
}

.input-wrapper :deep(.el-textarea__inner) {
  background: var(--input-bg, #1f1f1f);
  border-color: var(--input-border, #363636);
  color: var(--input-text, #f0f0f0);
  resize: none;
}

.input-wrapper :deep(.el-textarea__inner:focus) {
  border-color: var(--accent-color, #6366f1);
}

.input-hint {
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-muted, #6b7280);
}
</style>
