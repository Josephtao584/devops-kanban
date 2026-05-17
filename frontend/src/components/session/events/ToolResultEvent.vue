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
