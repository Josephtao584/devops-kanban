<template>
  <div
    v-if="shouldDisplay"
    class="session-event-renderer"
    :class="[`kind-${event.kind}`, `role-${event.role}`, toneClass]"
  >
    <ChatMessageEvent
      v-if="event.kind === 'message' && !event.isThinking"
      :event="event"
    />
    <ThinkingMessageEvent
      v-else-if="event.kind === 'message' && event.isThinking"
      :event="event"
    />
    <ToolCallEvent
      v-else-if="event.kind === 'tool_call'"
      :event="event"
    />
    <ToolResultEvent
      v-else-if="event.kind === 'tool_result'"
      :event="event"
    />
    <StatusEvent
      v-else-if="event.kind === 'status'"
      :event="event"
    />
    <SystemEvent
      v-else
      :event="event"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import ChatMessageEvent from './events/ChatMessageEvent.vue'
import ThinkingMessageEvent from './events/ThinkingMessageEvent.vue'
import ToolCallEvent from './events/ToolCallEvent.vue'
import ToolResultEvent from './events/ToolResultEvent.vue'
import StatusEvent from './events/StatusEvent.vue'
import SystemEvent from './events/SystemEvent.vue'

const props = defineProps({
  event: { type: Object, required: true }
})

const isDebuggerOutput = computed(() => {
  const content = props.event?.content || ''
  return content.includes('Debugger listening') ||
         content.includes('Debugger attached') ||
         content.includes('Waiting for the debugger')
})

const isSystemInit = computed(() => {
  const content = props.event?.content || ''
  return props.event?.kind === 'stream_chunk' &&
         content.includes('"type":"system"') &&
         content.includes('"subtype":"init"')
})

const shouldDisplay = computed(() => {
  return !isDebuggerOutput.value && !isSystemInit.value
})

const statusTone = computed(() => {
  if (props.event?.kind !== 'status') return 'neutral'
  const content = String(props.event?.content || '').toLowerCase()
  const STATUS_FAILED_PATTERNS = ['失败', 'error', 'failed']
  const STATUS_COMPLETED_PATTERNS = ['完成', '结束', 'success', 'completed', 'done']
  const STATUS_START_PATTERNS = ['开始', '启动', '进行中', 'running', 'started']
  if (STATUS_FAILED_PATTERNS.some(p => content.includes(p.toLowerCase()))) return 'failed'
  if (STATUS_COMPLETED_PATTERNS.some(p => content.includes(p.toLowerCase()))) return 'completed'
  if (STATUS_START_PATTERNS.some(p => content.includes(p.toLowerCase()))) return 'start'
  return 'neutral'
})

const toneClass = computed(() => {
  if (props.event?.kind === 'tool_call') return 'tone-tool'
  if (props.event?.kind === 'status') return `tone-status-${statusTone.value}`
  if (props.event?.kind === 'message' && props.event?.isThinking) return 'tone-thinking'
  return ''
})
</script>

<style scoped>
.session-event-renderer {
  display: flex;
  flex-direction: column;
}
</style>
