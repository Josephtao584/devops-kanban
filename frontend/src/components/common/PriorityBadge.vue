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
    default: TASK_PRIORITY.MEDIUM,
    validator: (value) => Object.values(TASK_PRIORITY).includes(value)
  }
})

const { t } = useI18n()

const priorityClass = computed(() => {
  return `priority-${(props.priority || TASK_PRIORITY.MEDIUM).toLowerCase()}`
})

const displayText = computed(() => {
  return t(`task.priority.${props.priority?.toLowerCase()}`, props.priority || 'Medium')
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
