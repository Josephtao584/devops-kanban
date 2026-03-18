<template>
  <div class="workflow-connector" :class="connectorClass">
    <div class="connector-line" :style="lineStyle">
      <div v-if="showArrow" class="connector-arrow">→</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { nodeStatusConfig } from '@/mock/workflowData'

const props = defineProps({
  fromStatus: {
    type: String,
    default: 'PENDING'
  },
  toStatus: {
    type: String,
    default: 'PENDING'
  }
})

const connectorClass = computed(() => {
  const classes = []
  if (props.fromStatus === 'DONE') classes.push('from-done')
  if (props.toStatus === 'IN_PROGRESS') classes.push('to-in-progress')
  return classes.join(' ')
})

const lineStyle = computed(() => {
  const fromColor = nodeStatusConfig[props.fromStatus]?.color || '#6B7280'
  const toColor = nodeStatusConfig[props.toStatus]?.color || '#6B7280'

  return {
    background: `linear-gradient(to right, ${fromColor}, ${toColor})`
  }
})

const showArrow = computed(() => {
  return props.fromStatus === 'DONE' || props.toStatus === 'IN_PROGRESS'
})
</script>

<style scoped>
.workflow-connector {
  display: flex;
  align-items: center;
  padding: 0 4px;
}

.connector-line {
  width: 40px;
  height: 3px;
  border-radius: 2px;
  position: relative;
  opacity: 0.6;
  transition: opacity 0.3s ease;
}

.from-done .connector-line,
.to-in-progress .connector-line {
  opacity: 1;
}

.connector-arrow {
  position: absolute;
  right: -6px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  color: #6b7280;
}

.to-in-progress .connector-arrow {
  color: #3b82f6;
  animation: arrow-pulse 1s ease-in-out infinite;
}

@keyframes arrow-pulse {
  0%, 100% { opacity: 1; transform: translateY(-50%) translateX(0); }
  50% { opacity: 0.6; transform: translateY(-50%) translateX(2px); }
}
</style>
