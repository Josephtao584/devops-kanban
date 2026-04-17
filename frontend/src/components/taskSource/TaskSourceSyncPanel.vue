<template>
  <transition name="slide-right">
    <div v-if="visible" class="sync-panel">
      <div class="sync-panel-header">
        <span class="sync-panel-title">{{ $t('taskSource.syncAnalysisTitle', 'Agent 分析') }}</span>
        <el-button class="sync-panel-close" size="small" text @click="$emit('close')">
          ✕
        </el-button>
      </div>
      <div v-if="!sessionId" class="sync-panel-empty">
        {{ $t('taskSource.syncAnalysisRunning', '等待分析开始...') }}
      </div>
      <div v-else class="sync-panel-content">
        <SessionEventRenderer
          v-for="event in events"
          :key="event.id || event.seq"
          :event="event"
          :hide-tool-messages="true"
        />
        <div v-if="isPolling" class="sync-panel-loading">
          {{ $t('taskSource.syncAnalysisRunning', '正在分析...') }}
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { watch } from 'vue'
import { useSessionEvents } from '../../composables/useSessionEvents'
import SessionEventRenderer from '../session/SessionEventRenderer.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  sessionId: { type: Number, default: null },
})

defineEmits(['close'])

const { events, loadInitial, startPolling, stopPolling, isPolling } = useSessionEvents()

watch(() => props.sessionId, async (newId) => {
  if (newId && props.visible) {
    stopPolling()
    await loadInitial(newId)
    startPolling(newId, () => false, { limit: 50 })
  }
}, { immediate: true })

watch(() => props.visible, (vis) => {
  if (!vis) {
    stopPolling()
  }
})
</script>

<style scoped>
.sync-panel {
  width: 380px;
  height: 100%;
  border-left: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}
.sync-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color-light);
  font-weight: 600;
}
.sync-panel-close {
  cursor: pointer;
}
.sync-panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}
.sync-panel-empty {
  padding: 24px;
  text-align: center;
  color: var(--el-text-color-secondary);
}
.sync-panel-loading {
  padding: 12px;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.3s ease;
}
.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
}
</style>
