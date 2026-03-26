<template>
  <div v-if="shouldDisplay" class="session-event-renderer" :class="[`kind-${event.kind}`, `role-${event.role}`]">
    <div v-if="event.kind === 'message'" class="event-message">
      <div class="event-content">{{ event.content }}</div>
    </div>

    <div v-else-if="event.kind === 'tool_call'" class="event-tool">
      <div class="event-kind">🔧 {{ toolName }}</div>
    </div>

    <div v-else-if="event.kind === 'status'" class="event-status">{{ event.content }}</div>
    <div v-else-if="event.kind === 'error'" class="event-error">{{ event.content }}</div>
    <div v-else-if="event.kind === 'artifact'" class="event-artifact">{{ event.content }}</div>
    <pre v-else-if="event.kind === 'stream_chunk'" class="event-stream">{{ event.content }}</pre>
    <div v-else class="event-fallback">{{ event.content }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  event: {
    type: Object,
    required: true
  }
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
  // Hide tool_result events
  if (props.event?.kind === 'tool_result') return false
  return !isDebuggerOutput.value && !isSystemInit.value
})

const toolName = computed(() => {
  try {
    const payload = props.event?.payload
    if (payload && typeof payload === 'object' && payload.name) {
      return payload.name
    }
  } catch {}
  return 'tool_call'
})
</script>

<style scoped>
.session-event-renderer {
  display: block;
  margin-bottom: 8px;
}

/* User message - right aligned, blue */
.session-event-renderer.role-user .event-message {
  margin-left: 40px;
  background: #3b82f6;
  color: white;
  border-radius: 12px 12px 4px 12px;
}

/* Assistant message - left aligned, gray */
.session-event-renderer.role-assistant .event-message {
  margin-right: 40px;
  background: #f1f5f9;
  color: #0f172a;
  border-radius: 12px 12px 12px 4px;
}

.event-message {
  padding: 10px 14px;
}

.event-content {
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Tool calls - compact, left aligned */
.event-tool {
  padding: 6px 10px;
  background: #fef3c7;
  border-radius: 6px;
  font-size: 12px;
  color: #92400e;
}

.event-kind {
  font-size: 12px;
  font-weight: 500;
}

.event-status {
  padding: 6px 10px;
  background: #ecfdf5;
  border-radius: 6px;
  font-size: 12px;
  color: #059669;
}

.event-error {
  padding: 8px 10px;
  background: #fef2f2;
  border-radius: 6px;
  font-size: 12px;
  color: #dc2626;
}

.event-artifact {
  padding: 8px 10px;
  background: #f0f9ff;
  border-radius: 6px;
  font-size: 12px;
  color: #0369a1;
}

.event-stream {
  margin: 0;
  padding: 8px 10px;
  background: #1e293b;
  color: #e2e8f0;
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace;
  font-size: 11px;
  max-height: 150px;
  overflow: auto;
}

.event-fallback {
  padding: 8px 10px;
  background: #f8fafc;
  border-radius: 6px;
  font-size: 12px;
  color: #64748b;
}
</style>
