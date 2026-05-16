<template>
  <div class="event-system event-system-card event-status">
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

const statusText = computed(() => {
  if (statusTone.value === 'completed') return '已完成'
  if (statusTone.value === 'start') return '进行中'
  if (statusTone.value === 'failed') return '执行失败'
  return props.event?.content || ''
})
</script>
