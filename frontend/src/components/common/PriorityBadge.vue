<template>
  <span class="priority-badge" :class="priorityClass">
    {{ displayText }}
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { TASK_PRIORITY } from '../../constants/task'

const props = defineProps({
  priority: {
    type: String,
    default: TASK_PRIORITY.MEDIUM
    // Remove validator to allow graceful handling of invalid values
  }
})

const { t } = useI18n()

// Normalize priority value - handle undefined/null/invalid values
const normalizedPriority = computed(() => {
  const priority = props.priority?.toUpperCase()
  if (priority && Object.values(TASK_PRIORITY).includes(priority)) {
    return priority
  }
  // Default to MEDIUM for invalid/unknown priorities
  return TASK_PRIORITY.MEDIUM
})

const priorityClass = computed(() => {
  return `priority-${normalizedPriority.value.toLowerCase()}`
})

const displayText = computed(() => {
  const key = `priority.${normalizedPriority.value}`
  const translated = t(key)
  // 如果翻译结果与键相同（表示未找到），返回优先级值本身
  return translated === key ? normalizedPriority.value : translated
})
</script>

<style scoped>
.priority-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.priority-critical {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.priority-high {
  background: rgba(249, 115, 22, 0.15);
  color: #f97316;
}

.priority-medium {
  background: rgba(234, 179, 8, 0.15);
  color: #eab308;
}

.priority-low {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}
</style>
