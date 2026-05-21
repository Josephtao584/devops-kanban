<template>
  <div class="dep-node" :class="statusClass">
    <Handle type="target" :position="Position.Left" />
    <div class="dep-node-icon">{{ icon }}</div>
    <div class="dep-node-title" :title="data.task.title">{{ data.task.title }}</div>
    <Handle type="source" :position="Position.Right" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'

const props = defineProps({
  data: { type: Object, required: true },
})

const statusClass = computed(() => {
  const t = props.data.task
  if (t.status === 'DONE') return 'is-done'
  if (t.status === 'CANCELLED') return 'is-cancelled'
  if (t.status === 'IN_PROGRESS') return 'is-running'
  if (t.status === 'BLOCKED') return 'is-failed'
  return 'is-pending'
})

const icon = computed(() => {
  const c = statusClass.value
  return ({ 'is-done': '✓', 'is-running': '▶', 'is-failed': '✗', 'is-cancelled': '⊘', 'is-pending': '○' })[c] || '○'
})
</script>

<style scoped>
.dep-node {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #fff;
  border: 1px solid #d4d7de;
  border-radius: 6px;
  width: 200px;
  font-size: 13px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
.dep-node.is-done { border-color: #67c23a; }
.dep-node.is-running { border-color: #409eff; }
.dep-node.is-failed { border-color: #f56c6c; }
.dep-node.is-cancelled { opacity: 0.6; }
.dep-node-icon { width: 16px; text-align: center; }
.dep-node-title {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
