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
  justify-content: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.priority-critical {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.priority-high {
  background: rgba(234, 180, 69, 0.16);
  color: #b98015;
}

.priority-medium {
  background: rgba(234, 180, 69, 0.12);
  color: #b58a2e;
}

.priority-low {
  background: rgba(37, 198, 201, 0.12);
  color: #1ea9ac;
}
</style>
