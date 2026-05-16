<template>
  <div class="quick-actions">
    <el-tooltip :content="startTooltip" :disabled="!startDisabled" placement="top">
      <button
        class="quick-action-btn"
        :disabled="startDisabled || actionLoading"
        @click="emit('start')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        启动
      </button>
    </el-tooltip>
    <el-tooltip content="切换AgentTeam模板" placement="top">
      <button class="quick-action-btn" :disabled="actionLoading" @click="emit('template')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
        模板
      </button>
    </el-tooltip>
    <el-tooltip :content="retryTooltip" :disabled="!retryDisabled" placement="top">
      <button
        class="quick-action-btn quick-action-retry"
        :disabled="retryDisabled || actionLoading"
        @click="emit('retry')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
        </svg>
        重试
      </button>
    </el-tooltip>
    <el-tooltip :content="cancelTooltip" :disabled="!cancelDisabled" placement="top">
      <button
        class="quick-action-btn quick-action-cancel"
        :disabled="cancelDisabled || actionLoading"
        @click="emit('cancel')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        取消
      </button>
    </el-tooltip>
    <el-tooltip content="确认继续" placement="top">
      <button
        class="quick-action-btn quick-action-confirm"
        :disabled="confirmDisabled || actionLoading"
        @click="emit('confirm')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        确认
      </button>
    </el-tooltip>
    <el-tooltip v-if="hasSplitStep" :content="splitButtonTooltip" placement="top">
      <button class="quick-action-btn quick-action-split" :disabled="actionLoading" @click="emit('show-split-suggestions')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3l1.6 4.6a3 3 0 0 0 1.8 1.8L20 11l-4.6 1.6a3 3 0 0 0-1.8 1.8L12 19l-1.6-4.6a3 3 0 0 0-1.8-1.8L4 11l4.6-1.6a3 3 0 0 0 1.8-1.8z"></path>
          <path d="M19 3v3"></path>
          <path d="M20.5 4.5h-3"></path>
          <path d="M5 18v3"></path>
          <path d="M6.5 19.5h-3"></path>
        </svg>
        拆分建议
        <span v-if="pendingSplitCount > 0" class="quick-action-badge">{{ pendingSplitCount }}</span>
      </button>
    </el-tooltip>
    <button class="quick-action-btn" :disabled="!taskId || actionLoading" @click="emit('refresh')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
      </svg>
      刷新
    </button>
    <label class="quick-action-btn quick-action-autoretry" :title="autoRetry ? '已开启自动重试：AgentTeam失败时将自动重新执行' : '已关闭自动重试'">
      <input type="checkbox" v-model="autoRetryModel" class="autoretry-check" />
      <span class="autoretry-box"></span>
      <span class="autoretry-label">自动重试</span>
    </label>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
const props = defineProps({
  taskId: { type: Number, default: null },
  actionLoading: { type: Boolean, default: false },
  startDisabled: { type: Boolean, default: true },
  startTooltip: { type: String, default: '' },
  retryDisabled: { type: Boolean, default: true },
  retryTooltip: { type: String, default: '' },
  cancelDisabled: { type: Boolean, default: true },
  cancelTooltip: { type: String, default: '' },
  confirmDisabled: { type: Boolean, default: true },
  confirmTooltip: { type: String, default: '' },
  hasSplitStep: { type: Boolean, default: false },
  splitButtonTooltip: { type: String, default: '' },
  pendingSplitCount: { type: Number, default: 0 },
  autoRetry: { type: Boolean, default: false }
})

const emit = defineEmits([
  'start', 'template', 'retry', 'cancel', 'confirm',
  'refresh', 'show-split-suggestions', 'auto-retry-change'
])

const autoRetryModel = ref(false)
watch(() => props.autoRetry, (v) => { autoRetryModel.value = v }, { immediate: true })
watch(autoRetryModel, (v) => { if (v !== props.autoRetry) emit('auto-retry-change', v) })
</script>

<style scoped>
.quick-actions {
  display: flex;
  gap: 8px;
  padding: 10px 20px;
  flex-shrink: 0;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.quick-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.quick-action-btn:hover:not(:disabled) {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: #fff;
}

.quick-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.quick-action-btn.quick-action-cancel {
  color: #dc2626;
  border-color: #fecaca;
  background: #fef2f2;
}

.quick-action-btn.quick-action-cancel:hover:not(:disabled) {
  background: #dc2626;
  border-color: #dc2626;
  color: #fff;
}

.quick-action-btn.quick-action-split {
  color: var(--accent-color-strong, #25c6c9);
  border-color: var(--accent-color-soft, rgba(37, 198, 201, 0.3));
  background: var(--accent-color-soft, rgba(37, 198, 201, 0.08));
}

.quick-action-btn.quick-action-split:hover:not(:disabled) {
  background: var(--accent-color, #25c6c9);
  border-color: var(--accent-color, #25c6c9);
  color: #fff;
}

.quick-action-btn.quick-action-retry {
  color: #059669;
  border-color: #a7f3d0;
  background: #ecfdf5;
}

.quick-action-btn.quick-action-retry:hover:not(:disabled) {
  background: #059669;
  border-color: #059669;
  color: #fff;
}

.quick-action-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 5px;
  margin-left: 4px;
  font-size: 10px;
  font-weight: 700;
  background: currentColor;
  color: #fff !important;
  border-radius: 8px;
}

.quick-action-btn.quick-action-split .quick-action-badge {
  background: var(--accent-color, #25c6c9);
  color: #fff !important;
}

.quick-action-btn.quick-action-confirm {
  color: #d97706;
  border-color: #fde68a;
  background: #fffbeb;
}

.quick-action-btn.quick-action-confirm:hover:not(:disabled) {
  background: #d97706;
  border-color: #d97706;
  color: #fff;
}

.quick-action-autoretry {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.quick-action-autoretry:hover {
  background: var(--bg-secondary);
}

.autoretry-check {
  display: none;
}

.autoretry-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: 1.5px solid var(--border-color);
  border-radius: 3px;
  background: var(--bg-primary);
  transition: all 0.15s;
  flex-shrink: 0;
}

.autoretry-check:checked + .autoretry-box {
  background: var(--accent-color);
  border-color: var(--accent-color);
}

.autoretry-check:checked + .autoretry-box::after {
  content: '✓';
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.autoretry-label {
  font-size: 12px;
  font-weight: 600;
}
</style>
