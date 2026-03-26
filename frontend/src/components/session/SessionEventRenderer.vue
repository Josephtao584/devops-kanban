<template>
  <div v-if="shouldDisplay" class="session-event-renderer" :class="[`kind-${event.kind}`, `role-${event.role}`]">
    <div v-if="event.kind === 'message'" class="event-row">
      <div class="event-message">
        <div class="event-content">{{ event.content }}</div>
      </div>
    </div>

    <div v-else-if="event.kind === 'tool_call'" class="event-system event-tool">
      <div class="event-system-label">工具调用</div>
      <div class="event-system-content">{{ toolName }}</div>
    </div>

    <div v-else-if="event.kind === 'status'" class="event-system event-status">
      <div class="event-system-label">状态更新</div>
      <div class="event-system-content">{{ event.content }}</div>
    </div>
    <div v-else-if="event.kind === 'error'" class="event-system event-error">
      <div class="event-system-label">错误</div>
      <div class="event-system-content">{{ event.content }}</div>
    </div>
    <div v-else-if="event.kind === 'artifact'" class="event-system event-artifact">
      <div class="event-system-label">产物</div>
      <div class="event-system-content">{{ event.content }}</div>
    </div>
    <div v-else-if="event.kind === 'stream_chunk'" class="event-system event-stream-shell">
      <div class="event-system-label">执行输出</div>
      <pre class="event-stream">{{ event.content }}</pre>
    </div>
    <div v-else class="event-system event-fallback">
      <div class="event-system-label">事件</div>
      <div class="event-system-content">{{ event.content }}</div>
    </div>
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
  display: flex;
  flex-direction: column;
}

.event-row {
  display: flex;
}

.session-event-renderer.role-user .event-row {
  justify-content: flex-end;
}

.session-event-renderer.role-assistant .event-row,
.session-event-renderer:not(.role-user) .event-row {
  justify-content: flex-start;
}

.event-message {
  max-width: min(85%, 560px);
  padding: 12px 14px;
  border-radius: 18px;
  background: #ffffff;
  color: #111827;
  border: 1px solid #e5e7eb;
}

.session-event-renderer.role-user .event-message {
  background: #111827;
  color: #ffffff;
  border-color: #111827;
  border-top-right-radius: 6px;
}

.session-event-renderer.role-assistant .event-message,
.session-event-renderer:not(.role-user) .event-message {
  border-top-left-radius: 6px;
}

.event-content,
.event-system-content {
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.event-system {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 100%;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
}

.event-system-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #6b7280;
}

.event-tool,
.event-status,
.event-artifact,
.event-fallback {
  background: #f9fafb;
}

.event-error {
  background: #fff7f7;
  border-color: #fecaca;
}

.event-stream-shell {
  background: #111827;
  border-color: #111827;
}

.event-stream-shell .event-system-label,
.event-stream {
  color: #e5e7eb;
}

.event-stream {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace;
  font-size: 11px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 220px;
  overflow: auto;
}
</style>

