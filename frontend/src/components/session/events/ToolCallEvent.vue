<template>
  <div class="event-system event-system-card event-tool">
    <div class="event-system-label">工具调用</div>
    <div class="event-system-content event-tool-name">{{ toolName }}</div>
    <pre v-if="displayedToolCallText" class="event-tool-detail">{{ displayedToolCallText }}</pre>
    <button
      v-if="shouldShowToolCallToggle"
      type="button"
      class="event-tool-toggle"
      @click="toggleToolCallExpanded"
    >
      {{ isToolCallExpanded ? '收起' : '展开' }}
    </button>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  event: { type: Object, required: true }
})

const isToolCallExpanded = ref(false)

function toggleToolCallExpanded() {
  isToolCallExpanded.value = !isToolCallExpanded.value
}

const toolName = computed(() => {
  if (typeof props.event?.toolName === 'string' && props.event.toolName) {
    return props.event.toolName
  }
  try {
    const payload = props.event?.payload
    if (payload && typeof payload === 'object') {
      if (payload.tool_name) return payload.tool_name
      if (payload.name) return payload.name
    }
  } catch {}
  if (typeof props.event?.content === 'string' && props.event.content) {
    return props.event.content
  }
  return '工具'
})

const toolInputPreview = computed(() => {
  if (typeof props.event?.toolInputPreview === 'string') {
    return props.event.toolInputPreview
  }
  return ''
})

const shouldShowToolCallToggle = computed(() => {
  return props.event?.toolCallCollapsedByDefault === true && toolInputPreview.value !== ''
})

const displayedToolCallText = computed(() => {
  if (!toolInputPreview.value) return ''
  if (shouldShowToolCallToggle.value && !isToolCallExpanded.value) return ''
  return toolInputPreview.value
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

.event-tool {
  background: #f6f8fb;
  border-color: #dbe3ee;
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

.event-tool .event-system-label {
  color: #5f6f86;
}

.event-tool:hover {
  border-color: #cbd5e1;
}

.event-tool .event-system-content {
  font-weight: 500;
}

.event-tool-name {
  font-weight: 600;
}

.event-tool-detail {
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
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace;
  font-weight: 400;
  text-rendering: optimizeLegibility;
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
</style>
