<template>
  <div class="event-system event-system-card event-status" :class="toneClass">
    <div class="event-system-label">状态更新</div>
    <div class="event-system-content">{{ statusText }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  event: { type: Object, required: true }
})

const STATUS_START_PATTERNS = ['开始', '启动', '进行中', 'running', 'started']
const STATUS_COMPLETED_PATTERNS = ['完成', '结束', 'success', 'completed', 'done']
const STATUS_FAILED_PATTERNS = ['失败', 'error', 'failed']

const statusTone = computed(() => {
  const content = String(props.event?.content || '').toLowerCase()
  if (STATUS_FAILED_PATTERNS.some(p => content.includes(p.toLowerCase()))) return 'failed'
  if (STATUS_COMPLETED_PATTERNS.some(p => content.includes(p.toLowerCase()))) return 'completed'
  if (STATUS_START_PATTERNS.some(p => content.includes(p.toLowerCase()))) return 'start'
  return 'neutral'
})

const toneClass = computed(() => `tone-status-${statusTone.value}`)

const statusText = computed(() => {
  if (statusTone.value === 'completed') return '已完成'
  if (statusTone.value === 'start') return '进行中'
  if (statusTone.value === 'failed') return '执行失败'
  return props.event?.content || ''
})
</script>

<style scoped>
.event-system {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: min(95%, 800px);
  padding: 9px 11px;
  border-radius: 14px;
  border: 1px solid #e5e7eb;
  background: #f8fafc;
  white-space: normal;
  background-clip: padding-box;
  text-align: left;
  position: relative;
  min-width: 0;
  border-width: 1px;
  transition: none;
}

.event-system-card {
  display: flex;
  flex-direction: column;
  padding-inline: 12px;
  position: relative;
  width: 100%;
  min-width: 0;
  padding-top: 1px;
  padding-bottom: 1px;
  justify-content: flex-start;
}

.event-system-card .event-system {
  margin-left: 0;
  box-shadow: 0 1px 0 rgba(15, 23, 42, 0.02);
}

.event-system-label {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  color: #94a3b8;
  user-select: none;
  text-rendering: optimizeLegibility;
}

.event-system-label::before {
  content: '· ';
}

.event-system-content {
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  color: inherit;
  padding-left: 2px;
  user-select: text;
  min-width: 0;
  text-align: left;
  text-rendering: optimizeLegibility;
}

.event-status {
  background: #f9fafb;
  border-color: #e5e7eb;
  border-style: dashed;
  color: #475569;
  width: fit-content;
  min-width: min(240px, 100%);
  max-width: min(calc(100% - 24px), 800px);
  margin-left: 0;
  align-self: flex-start;
  box-shadow: none;
  opacity: 0.96;
}

.event-status:hover {
  border-color: #cbd5e1;
}

.event-status .event-system-label {
  color: #6b7280;
}

.event-status.tone-status-start {
  background: #f5f9ff;
  border-color: #d9e6f7;
}

.event-status.tone-status-start .event-system-label {
  color: #5a7aa3;
}

.event-status.tone-status-completed {
  background: #f6fbf7;
  border-color: #d8e9dc;
}

.event-status.tone-status-completed .event-system-label {
  color: #5f8a67;
}

.event-status.tone-status-failed {
  background: #fff7f7;
  border-color: #f1d7d7;
}

.event-status.tone-status-failed .event-system-label {
  color: #9a6666;
}

.event-status.tone-status-neutral {
  background: #f9fafb;
  border-color: #e5e7eb;
}

.event-status.tone-status-neutral .event-system-label {
  color: #6b7280;
}
</style>
