<template>
  <span class="status-badge" :class="statusClass">
    <span class="status-dot"></span>
    <span v-if="showText" class="status-text">{{ displayText }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  status: {
    type: String,
    default: ''
  },
  showText: {
    type: Boolean,
    default: true
  },
  text: {
    type: String,
    default: ''
  }
})

const { t } = useI18n()

const statusClass = computed(() => {
  const status = props.status?.toLowerCase()
  if (!status) return 'status-none'
  if (status === 'running') return 'status-running'
  if (status === 'idle') return 'status-idle'
  if (status === 'stopped') return 'status-stopped'
  if (status === 'error') return 'status-error'
  if (status === 'completed') return 'status-completed'
  if (status === 'created') return 'status-created'
  return 'status-unknown'
})

const displayText = computed(() => {
  if (props.text) return props.text
  if (!props.status) return t('session.status.none', 'No Session')
  return t(`session.status.${props.status.toLowerCase()}`, props.status)
})
</script>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.status-running .status-dot {
  background: #22c55e;
}

.status-idle .status-dot {
  background: #f59e0b;
  animation: none;
}

.status-stopped .status-dot,
.status-completed .status-dot {
  background: #6b7280;
  animation: none;
}

.status-error .status-dot {
  background: #ef4444;
  animation: none;
}

.status-created .status-dot {
  background: #6366f1;
}

.status-none .status-dot,
.status-unknown .status-dot {
  background: #9ca3af;
}

.status-text {
  color: var(--text-secondary, #71717a);
}

.status-running .status-text {
  color: #22c55e;
}

.status-error .status-text {
  color: #ef4444;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
