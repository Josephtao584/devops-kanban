<template>
  <div class="event-system event-system-card" :class="toolResultClass">
    <div class="event-system-label">{{ toolResultLabel }}</div>
    <pre v-if="displayedToolResultText" class="event-tool-detail event-tool-result-text">{{ displayedToolResultText }}</pre>
    <div v-else-if="isToolResultExpanded" class="event-system-content">无输出</div>
    <button
      v-if="shouldShowToolResultToggle"
      type="button"
      class="event-tool-toggle"
      @click="toggleToolResultExpanded"
    >
      {{ isToolResultExpanded ? '收起' : '展开' }}
    </button>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  event: { type: Object, required: true }
})

const isToolResultExpanded = ref(false)

function toggleToolResultExpanded() {
  isToolResultExpanded.value = !isToolResultExpanded.value
}

const toolResultText = computed(() => {
  if (typeof props.event?.toolResultText === 'string') {
    return props.event.toolResultText
  }
  return typeof props.event?.content === 'string' ? props.event.content : ''
})

const shouldShowToolResultToggle = computed(() => {
  return props.event?.toolResultCollapsedByDefault === true
})

const displayedToolResultText = computed(() => {
  if (!toolResultText.value) return ''
  if (shouldShowToolResultToggle.value && !isToolResultExpanded.value) return ''
  return toolResultText.value
})

const toolName = computed(() => {
  if (typeof props.event?.relatedToolName === 'string' && props.event.relatedToolName) {
    return props.event.relatedToolName
  }
  if (typeof props.event?.toolName === 'string' && props.event.toolName) {
    return props.event.toolName
  }
  return '工具'
})

const toolResultLabel = computed(() => {
  if (props.event?.toolIsError) {
    return toolName.value ? `${toolName.value} 执行失败` : '工具执行失败'
  }
  return toolName.value ? `${toolName.value} 结果` : '工具结果'
})

const toolResultClass = computed(() => {
  return props.event?.toolIsError ? 'event-tool-result event-tool-result-error' : 'event-tool-result'
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

.event-tool-result {
  background: #f9fafb;
  border-color: #e2e8f0;
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

.event-tool-result:hover {
  border-color: #cbd5e1;
}

.event-tool-result .event-system-content {
  font-weight: 500;
  font-size: 12px;
}

.event-tool-result .event-system-label {
  color: #94a3b8;
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
  font-size: 11px;
}

.event-tool-result-text {
  max-height: 180px;
  margin-bottom: 2px;
}

.event-tool-detail {
  margin: 0;
  padding: 8px 10px;
  padding-left: 2px;
  border-radius: 10px;
  background: rgba(148, 163, 184, 0.1);
  color: #334155;
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-x: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace;
  font-weight: 400;
  text-align: left;
  text-rendering: optimizeLegibility;
}

.event-tool-result-error {
  background: #fff7f7;
  border-color: #f1d7d7;
  color: #9a6666;
}

.event-tool-result-error:hover {
  border-color: #e5bcbc;
}

.event-tool-result-error .event-system-label {
  color: #9a6666;
}

.event-tool-result-error .event-system-content {
  color: #7f1d1d;
}

.event-tool-result-error .event-tool-detail {
  background: rgba(185, 28, 28, 0.06);
  color: #7f1d1d;
}

.event-tool-result .event-system-label,
.event-tool-result .event-system-content,
.event-tool-result .event-tool-detail {
  user-select: text;
}

.event-tool-result .event-system-label {
  user-select: none;
}

.event-tool-toggle {
  align-self: flex-start;
  padding: 0;
  border: 0;
  background: transparent;
  color: #64748b;
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
}

.event-tool-toggle:hover {
  color: #475569;
}

.event-tool-result-error .event-tool-toggle {
  color: #b45353;
}

.event-tool-result-error .event-tool-toggle:hover {
  color: #933333;
}
</style>
