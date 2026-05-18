<template>
  <el-dialog
    v-model="visible"
    :title="t('workflow.loopBackDialogTitle')"
    width="480"
    data-test="loop-back-dialog"
    @close="handleClose"
  >
    <el-select
      v-model="selected"
      :placeholder="t('workflow.loopBackPickStep')"
      data-test="loop-back-step-select"
      style="width: 100%"
    >
      <el-option
        v-for="step in earlierSteps"
        :key="step.step_id"
        :value="step.step_id"
        :label="step.name || step.step_id"
      />
    </el-select>
    <template #footer>
      <el-button data-test="loop-back-cancel" @click="handleCancel">{{ t('common.cancel') }}</el-button>
      <el-button
        type="primary"
        :disabled="!selected"
        data-test="loop-back-confirm"
        @click="handleConfirm"
      >{{ t('workflow.loopBackConfirm') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  steps: { type: Array, default: () => [] },
  failedStepId: { type: String, default: null }
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const selected = ref(null)

const earlierSteps = computed(() => {
  if (!props.failedStepId) {
    // No failed step known; allow any step except the last as a target.
    return props.steps.slice(0, Math.max(props.steps.length - 1, 0))
  }
  const idx = props.steps.findIndex((s) => s.step_id === props.failedStepId)
  return idx <= 0 ? [] : props.steps.slice(0, idx)
})

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      selected.value = null
    }
  }
)

function handleConfirm() {
  if (!selected.value) return
  emit('confirm', selected.value)
  visible.value = false
}

function handleCancel() {
  visible.value = false
}

function handleClose() {
  selected.value = null
}
</script>
