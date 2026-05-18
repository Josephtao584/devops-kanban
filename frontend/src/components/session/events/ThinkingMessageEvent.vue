<template>
  <div class="event-system event-system-card event-thinking">
    <div class="event-thinking-header" @click="toggleThinkingExpanded">
      <span class="event-thinking-label">思考过程</span>
      <span class="event-thinking-toggle">{{ isThinkingExpanded ? '收起' : '展开' }}</span>
    </div>
    <pre v-if="isThinkingExpanded" class="event-thinking-content">{{ event.content }}</pre>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  event: { type: Object, required: true }
})

const isThinkingExpanded = ref(false)

function toggleThinkingExpanded() {
  isThinkingExpanded.value = !isThinkingExpanded.value
}
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

.event-thinking {
  border-style: dashed;
  border-color: #dbe3ee;
  background: #f6f8fb;
  align-self: flex-start;
  width: fit-content;
  max-width: min(calc(100% - 24px), 800px);
  min-width: min(240px, 100%);
  color: #475569;
  box-shadow: 0 1px 0 rgba(15, 23, 42, 0.02);
  margin-left: 0;
  opacity: 0.96;
}

.event-thinking:hover {
  border-color: #cbd5e1;
}

.event-thinking-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
}

.event-thinking-label {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0;
  color: #5f6f86;
  user-select: none;
}

.event-thinking-label::before {
  content: '· ';
}

.event-thinking-toggle {
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
  user-select: none;
}

.event-thinking-toggle:hover {
  color: #475569;
}

.event-thinking-content {
  margin: 0;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(148, 163, 184, 0.12);
  color: #334155;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-x: auto;
  max-height: 300px;
  overflow-y: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace;
  user-select: text;
}
</style>
