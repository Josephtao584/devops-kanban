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
