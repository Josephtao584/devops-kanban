<template>
  <el-dialog
    v-model="visible"
    title="重试 AgentTeam"
    width="520"
    data-test="retry-dialog"
    @close="handleClose"
  >
    <div class="retry-modes">
      <div
        class="retry-mode-card"
        :class="{ active: mode === 'plain' }"
        data-test="retry-mode-plain"
        @click="mode = 'plain'"
      >
        <div class="retry-mode-header">
          <el-radio v-model="mode" label="plain">完全重试</el-radio>
        </div>
        <div class="retry-mode-desc">
          按原 prompt 从头重新执行，等同于让 Agent 把这个步骤重新做一遍。
        </div>
      </div>

      <div
        class="retry-mode-card"
        :class="{ active: mode === 'note' }"
        data-test="retry-mode-note"
        @click="mode = 'note'"
      >
        <div class="retry-mode-header">
          <el-radio v-model="mode" label="note">对话式续接</el-radio>
        </div>
        <div class="retry-mode-desc">
          在原 Claude Code 会话上接着聊，仅发送下面这段消息，比如简单一句"继续"或补充一两句要求。
        </div>
        <el-input
          v-if="mode === 'note'"
          v-model="note"
          type="textarea"
          :rows="4"
          placeholder="例如：继续 / 上次报错是因为缺少 X，请先创建 X 再继续"
          data-test="retry-note-input"
          class="retry-note-input"
        />
      </div>
    </div>

    <template #footer>
      <el-button data-test="retry-cancel" @click="handleCancel">取消</el-button>
      <el-button
        type="primary"
        :disabled="confirmDisabled"
        data-test="retry-confirm"
        @click="handleConfirm"
      >发起重试</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const mode = ref('plain')
const note = ref('')

const confirmDisabled = computed(() => mode.value === 'note' && !note.value.trim())

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      mode.value = 'plain'
      note.value = ''
    }
  }
)

function handleConfirm() {
  if (mode.value === 'note') {
    const trimmed = note.value.trim()
    if (!trimmed) return
    emit('confirm', { retryNote: trimmed })
  } else {
    emit('confirm', { retryNote: undefined })
  }
  visible.value = false
}

function handleCancel() {
  visible.value = false
}

function handleClose() {
  mode.value = 'plain'
  note.value = ''
}
</script>

<style scoped>
.retry-modes {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.retry-mode-card {
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  padding: 12px 14px;
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s;
}

.retry-mode-card:hover {
  border-color: var(--el-color-primary-light-5);
}

.retry-mode-card.active {
  border-color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-9);
}

.retry-mode-header {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}

.retry-mode-header :deep(.el-radio__label) {
  font-weight: 600;
  font-size: 14px;
}

.retry-mode-desc {
  color: var(--el-text-color-regular);
  font-size: 12px;
  line-height: 1.5;
  padding-left: 24px;
}

.retry-note-input {
  margin-top: 10px;
}
</style>
