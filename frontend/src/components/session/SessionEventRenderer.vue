<template>
  <div class="session-event-renderer" :class="`kind-${event.kind}`">
    <div v-if="event.kind === 'message'" class="event-message">
      <div class="event-role">{{ roleLabel }}</div>
      <div class="event-content">{{ event.content }}</div>
    </div>

    <div v-else-if="event.kind === 'tool_call' || event.kind === 'tool_result'" class="event-card">
      <div class="event-kind">{{ event.kind }}</div>
      <div class="event-content">{{ event.content }}</div>
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

const roleLabel = computed(() => {
  const role = props.event?.role
  if (role === 'assistant') return 'Assistant'
  if (role === 'system') return 'System'
  if (role === 'tool') return 'Tool'
  if (role === 'user') return 'User'
  return 'Event'
})
</script>

<style scoped>
.session-event-renderer {
  display: block;
}

.event-message,
.event-card,
.event-status,
.event-error,
.event-artifact,
.event-stream,
.event-fallback {
  border-radius: 8px;
  padding: 10px 12px;
  background: #f8fafc;
}

.event-role,
.event-kind {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 4px;
  color: #64748b;
}

.event-content,
.event-status,
.event-error,
.event-artifact,
.event-fallback,
.event-stream {
  font-size: 13px;
  color: #0f172a;
  white-space: pre-wrap;
  word-break: break-word;
}

.event-error {
  background: #fef2f2;
  color: #b91c1c;
}

.event-stream {
  margin: 0;
  background: #0f172a;
  color: #e2e8f0;
  font-family: ui-monospace, SFMono-Regular, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace;
}
</style>
