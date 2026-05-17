<template>
  <BaseDialog
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    :title="isEdit ? $t('skill.editSkill') : $t('skill.createSkill')"
    width="500px"
  >
    <el-form data-testid="skill-form" label-position="top" @submit.prevent="emit('save')">
      <el-form-item :label="$t('skill.skillName')">
        <el-input
          v-model="localForm.name"
          data-testid="skill-name-input"
          :placeholder="$t('skill.namePlaceholder')"
          maxlength="200"
          show-word-limit
        />
      </el-form-item>
      <el-form-item :label="$t('skill.description')">
        <el-input
          v-model="localForm.description"
          data-testid="skill-description-input"
          type="textarea"
          :rows="6"
          resize="vertical"
          :placeholder="$t('skill.descriptionPlaceholder')"
          maxlength="5000"
          show-word-limit
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('close')">{{ $t('common.cancel') }}</el-button>
      <el-button type="primary" :disabled="saving" @click="emit('save')">{{ saving ? $t('common.loading') : $t('common.save') }}</el-button>
    </template>
  </BaseDialog>
</template>

<script setup>
import { computed } from 'vue'
import BaseDialog from '../../components/BaseDialog.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  isEdit: { type: Boolean, default: false },
  form: { type: Object, required: true },
  saving: { type: Boolean, default: false }
})

const emit = defineEmits(['update:visible', 'save', 'close'])

const localForm = computed(() => props.form)
</script>

<style scoped>
:deep(.el-form-item__label) {
  font-size: 12px !important;
  font-weight: 600 !important;
  color: var(--text-secondary) !important;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding-bottom: 6px !important;
  line-height: 1.4 !important;
}

:deep(.el-form-item .el-input__wrapper),
:deep(.el-form-item .el-textarea__inner) {
  background: #fff;
  box-shadow: 0 0 0 1px var(--border-color) inset;
  border-radius: 8px;
  transition: box-shadow 0.18s ease;
}

:deep(.el-form-item .el-input__wrapper:hover),
:deep(.el-form-item .el-textarea__inner:hover) {
  box-shadow: 0 0 0 1px var(--accent-color-soft, rgba(37, 198, 201, 0.5)) inset;
}

:deep(.el-form-item .el-input.is-focus .el-input__wrapper),
:deep(.el-form-item .el-input__wrapper.is-focus),
:deep(.el-form-item .el-textarea__inner:focus) {
  box-shadow:
    0 0 0 1px var(--accent-color) inset,
    0 0 0 3px rgba(37, 198, 201, 0.12);
}

:deep(.el-form-item .el-input__inner) {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}
</style>
