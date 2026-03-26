<template>
  <div
    v-if="shouldDisplay"
    class="session-event-renderer"
    :class="[`kind-${event.kind}`, `role-${event.role}`, toneClass]"
  >
    <div
      v-if="event.kind === 'message'"
      class="event-row event-chat-message"
      :class="messageAlignmentClass"
    >
      <div class="event-message" :class="messageBubbleClass">
        <div class="event-content" v-html="formattedMessageContent"></div>
      </div>
    </div>

    <div v-else-if="event.kind === 'tool_call'" class="event-system event-system-card event-tool">
      <div class="event-system-label">工具调用</div>
      <div class="event-system-content">{{ toolName }}</div>
    </div>

    <div v-else-if="event.kind === 'status'" class="event-system event-system-card event-status">
      <div class="event-system-label">状态更新</div>
      <div class="event-system-content">{{ eventText }}</div>
    </div>
    <div v-else-if="event.kind === 'error'" class="event-system event-system-card event-error">
      <div class="event-system-label">错误</div>
      <div class="event-system-content">{{ event.content }}</div>
    </div>
    <div v-else-if="event.kind === 'artifact'" class="event-system event-system-card event-artifact">
      <div class="event-system-label">产物</div>
      <div class="event-system-content">{{ event.content }}</div>
    </div>
    <div v-else-if="event.kind === 'stream_chunk'" class="event-system event-system-card event-stream-shell">
      <div class="event-system-label">执行输出</div>
      <pre class="event-stream">{{ event.content }}</pre>
    </div>
    <div v-else class="event-system event-system-card event-fallback">
      <div class="event-system-label">{{ fallbackLabel }}</div>
      <div class="event-system-content">{{ fallbackContent }}</div>
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

const STATUS_START_PATTERNS = ['开始', '启动', '进行中', 'running', 'started']
const STATUS_COMPLETED_PATTERNS = ['完成', '结束', 'success', 'completed', 'done']
const STATUS_FAILED_PATTERNS = ['失败', 'error', 'failed']

const toolName = computed(() => {
  try {
    const payload = props.event?.payload
    if (payload && typeof payload === 'object' && payload.name) {
      return payload.name
    }
  } catch {}
  return '工具'
})

const statusTone = computed(() => {
  if (props.event?.kind !== 'status') return 'neutral'

  const content = String(props.event?.content || '').toLowerCase()

  if (STATUS_FAILED_PATTERNS.some(pattern => content.includes(pattern.toLowerCase()))) {
    return 'failed'
  }
  if (STATUS_COMPLETED_PATTERNS.some(pattern => content.includes(pattern.toLowerCase()))) {
    return 'completed'
  }
  if (STATUS_START_PATTERNS.some(pattern => content.includes(pattern.toLowerCase()))) {
    return 'start'
  }

  return 'neutral'
})

const statusText = computed(() => {
  if (props.event?.kind !== 'status') return props.event?.content || ''

  if (statusTone.value === 'completed') return '已完成'
  if (statusTone.value === 'start') return '进行中'
  if (statusTone.value === 'failed') return '执行失败'

  return props.event?.content || ''
})

const eventText = computed(() => {
  if (props.event?.kind === 'status') return statusText.value
  return props.event?.content || ''
})

const fallbackLabel = computed(() => {
  const labels = {
    tool_result: '工具结果',
    completed: '已完成'
  }
  return labels[props.event?.kind] || '事件'
})

const fallbackContent = computed(() => {
  if (props.event?.kind === 'completed') {
    return props.event?.content || '已完成'
  }
  return props.event?.content || ''
})

const toneClass = computed(() => {
  if (props.event?.kind === 'tool_call') return 'tone-tool'
  if (props.event?.kind === 'status') return `tone-status-${statusTone.value}`
  return ''
})

const messageAlignmentClass = computed(() => {
  return props.event?.role === 'user' ? 'align-right' : 'align-left'
})

const messageBubbleClass = computed(() => {
  return props.event?.role === 'user' ? 'bubble-user' : 'bubble-assistant'
})

const formattedMessageContent = computed(() => {
  const content = props.event?.content || ''
  if (props.event?.kind !== 'message' || !content) return content

  let formatted = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  formatted = formatted.replace(/^#{1,6}\s+(.+)$/gm, '<strong>$1</strong>')
  formatted = formatted.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  formatted = formatted.replace(/__(.*?)__/g, '<strong>$1</strong>')
  formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>')
  formatted = formatted.replace(/\n/g, '<br>')

  return formatted
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

.event-chat-message.align-right,
.session-event-renderer.role-user .event-row {
  justify-content: flex-end;
}

.event-chat-message.align-left,
.session-event-renderer.role-assistant .event-row,
.session-event-renderer:not(.role-user) .event-row {
  justify-content: flex-start;
}

.event-message {
  max-width: min(82%, 520px);
  padding: 14px 16px;
  border-radius: 18px;
  background: #ffffff;
  color: #111827;
  border: 1px solid #e5e7eb;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
}

.event-message.bubble-user,
.session-event-renderer.role-user .event-message {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
  border-top-right-radius: 6px;
  box-shadow: 0 12px 28px rgba(37, 99, 235, 0.22);
}

.event-message.bubble-assistant,
.session-event-renderer.role-assistant .event-message,
.session-event-renderer:not(.role-user) .event-message {
  border-top-left-radius: 6px;
  background: #ffffff;
  border-color: #dbe4f0;
}

.event-system-card {
  display: flex;
  flex-direction: column;
  padding-inline: 6px;
}

.event-content,
.event-system-content {
  font-size: 13px;
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
}

.event-system {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: min(92%, 640px);
  padding: 9px 11px;
  border-radius: 14px;
  border: 1px solid #e5e7eb;
  background: #f8fafc;
}

.event-chat-message {
  margin: 2px 0 4px;
}

.event-system-card + .event-chat-message,
.event-chat-message + .event-system-card {
  margin-top: 8px;
}

.event-system-card + .event-system-card {
  margin-top: 2px;
}

.event-system-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #94a3b8;
}

.event-tool,
.event-status,
.event-artifact,
.event-fallback {
  background: #f8fafc;
}

.event-tool .event-system-content,
.event-status .event-system-content,
.event-artifact .event-system-content,
.event-fallback .event-system-content {
  color: #475569;
}

.event-row.event-chat-message.align-left {
  padding-right: 28px;
}

.event-row.event-chat-message.align-right {
  padding-left: 28px;
}

.event-stream-shell {
  background: #0f172a;
  border-color: #0f172a;
}

.event-stream-shell .event-system-label {
  color: #94a3b8;
}

.event-stream {
  color: #e2e8f0;
}

.event-system.event-fallback {
  background: #f8fafc;
}

.event-system.event-error {
  background: #fff7f7;
}

.event-system.event-status {
  border-style: dashed;
}

.event-system.event-tool {
  border-style: dashed;
}

.event-system.event-artifact {
  border-style: dashed;
}

.event-system.event-fallback {
  border-style: dashed;
}

.event-system.event-status .event-system-label,
.event-system.event-tool .event-system-label,
.event-system.event-artifact .event-system-label,
.event-system.event-fallback .event-system-label {
  font-weight: 500;
}

.event-system.event-status .event-system-content,
.event-system.event-tool .event-system-content,
.event-system.event-artifact .event-system-content,
.event-system.event-fallback .event-system-content {
  font-size: 12px;
}

.event-system.event-status,
.event-system.event-tool,
.event-system.event-artifact,
.event-system.event-fallback {
  box-shadow: none;
}

.event-system.event-tool,
.event-system.event-status,
.event-system.event-artifact,
.event-system.event-fallback {
  opacity: 0.96;
}

.event-system.event-error,
.event-system.event-stream-shell {
  opacity: 1;
}

.event-system.event-tool,
.event-system.event-status,
.event-system.event-artifact,
.event-system.event-fallback,
.event-system.event-error,
.event-system.event-stream-shell {
  align-self: flex-start;
}

.event-system.event-tool,
.event-system.event-status,
.event-system.event-artifact,
.event-system.event-fallback {
  margin-left: 0;
}

.event-system.event-tool,
.event-system.event-status,
.event-system.event-artifact,
.event-system.event-fallback {
  width: fit-content;
}

.event-system.event-stream-shell,
.event-system.event-error {
  width: 100%;
}

.event-system.event-tool .event-system-content {
  font-weight: 500;
}

.event-message.bubble-assistant .event-content {
  font-size: 14px;
}

.event-message.bubble-user .event-content {
  font-size: 14px;
}

.event-message.bubble-assistant .event-content,
.event-message.bubble-user .event-content {
  line-height: 1.8;
}

.event-content :deep(strong) {
  font-weight: 600;
}

.event-content :deep(code) {
  background: rgba(15, 23, 42, 0.06);
  padding: 1px 6px;
  border-radius: 999px;
}

.event-message.bubble-user .event-content :deep(code) {
  background: rgba(255, 255, 255, 0.18);
}

.event-content :deep(pre) {
  margin-top: 8px;
  padding: 12px;
  border-radius: 10px;
  overflow-x: auto;
}

.event-message.bubble-assistant .event-content :deep(pre) {
  background: #f8fafc;
}

.event-message.bubble-user .event-content :deep(pre) {
  background: rgba(15, 23, 42, 0.18);
}

.event-content :deep(pre code) {
  background: transparent;
  padding: 0;
  border-radius: 0;
}

.event-message.bubble-assistant {
  position: relative;
}

.event-message.bubble-assistant::before {
  content: '';
  position: absolute;
  left: -6px;
  top: 12px;
  width: 12px;
  height: 12px;
  background: #ffffff;
  border-left: 1px solid #dbe4f0;
  border-bottom: 1px solid #dbe4f0;
  transform: rotate(45deg);
}

.event-message.bubble-user {
  position: relative;
}

.event-message.bubble-user::after {
  content: '';
  position: absolute;
  right: -6px;
  top: 12px;
  width: 12px;
  height: 12px;
  background: #2563eb;
  transform: rotate(45deg);
}

.event-message.bubble-assistant,
.event-message.bubble-user {
  overflow: visible;
}

.event-chat-message.align-left .event-message {
  margin-left: 8px;
}

.event-chat-message.align-right .event-message {
  margin-right: 8px;
}

.event-chat-message.align-left,
.event-chat-message.align-right {
  align-items: stretch;
}

.event-system-card {
  padding-inline: 12px;
}

.event-system-card .event-system {
  box-shadow: none;
}

.event-system-card .event-system-content code {
  background: rgba(15, 23, 42, 0.06);
  padding: 1px 6px;
  border-radius: 999px;
}

.event-system-card .event-system-content strong {
  font-weight: 600;
}

.event-system-card .event-system-content ul,
.event-system-card .event-system-content ol {
  margin: 0;
  padding-left: 18px;
}

.event-system-card .event-system-content pre {
  margin-top: 6px;
}

.event-system-card .event-system-content {
  max-width: 100%;
}

.event-chat-message .event-content code {
  background: rgba(15, 23, 42, 0.06);
  padding: 1px 6px;
  border-radius: 999px;
}

.event-message.bubble-user .event-content code {
  background: rgba(255, 255, 255, 0.18);
}

.event-message.bubble-assistant .event-content strong,
.event-message.bubble-user .event-content strong {
  font-weight: 600;
}

.event-message.bubble-assistant .event-content pre,
.event-message.bubble-user .event-content pre {
  margin-top: 8px;
}

.event-message.bubble-assistant .event-content pre {
  background: #f8fafc;
}

.event-message.bubble-user .event-content pre {
  background: rgba(15, 23, 42, 0.18);
}

.event-message.bubble-assistant .event-content pre code,
.event-message.bubble-user .event-content pre code {
  background: transparent;
  padding: 0;
  border-radius: 0;
}

.event-message.bubble-assistant .event-content pre,
.event-message.bubble-user .event-content pre,
.event-system .event-system-content pre {
  overflow-x: auto;
}

.event-message.bubble-assistant .event-content,
.event-message.bubble-user .event-content,
.event-system .event-system-content {
  word-break: break-word;
}

.event-chat-message.align-left .event-message,
.event-chat-message.align-right .event-message,
.event-system {
  transition: none;
}

.event-system.event-status,
.event-system.event-tool,
.event-system.event-artifact,
.event-system.event-fallback {
  border-color: #e2e8f0;
}

.event-system.event-status:hover,
.event-system.event-tool:hover,
.event-system.event-artifact:hover,
.event-system.event-fallback:hover {
  border-color: #cbd5e1;
}

.event-message.bubble-assistant:hover {
  border-color: #cbd5e1;
}

.event-message.bubble-user:hover {
  border-color: #2563eb;
}

.event-chat-message.align-left,
.event-chat-message.align-right,
.event-system-card {
  width: 100%;
}

.event-chat-message.align-left {
  justify-content: flex-start;
}

.event-chat-message.align-right {
  justify-content: flex-end;
}

.event-system-card {
  justify-content: flex-start;
}

.event-system-card .event-system {
  margin-left: 0;
}

.event-system-card .event-system.event-stream-shell,
.event-system-card .event-system.event-error {
  max-width: 100%;
}

.event-system-card .event-system:not(.event-stream-shell):not(.event-error) {
  max-width: min(88%, 520px);
}

.event-chat-message .event-message {
  min-width: 120px;
}

.event-system .event-system-content {
  min-width: 0;
}

.event-system.event-tool .event-system-label,
.event-system.event-status .event-system-label,
.event-system.event-artifact .event-system-label,
.event-system.event-fallback .event-system-label {
  text-transform: none;
}

.event-system.event-tool .event-system-label::before {
  content: '· ';
}

.event-system.event-status .event-system-label::before,
.event-system.event-artifact .event-system-label::before,
.event-system.event-fallback .event-system-label::before {
  content: '· ';
}

.event-stream-shell .event-system-label::before,
.event-error .event-system-label::before {
  content: '';
}

.event-system.event-tool .event-system-content,
.event-system.event-status .event-system-content,
.event-system.event-artifact .event-system-content,
.event-system.event-fallback .event-system-content {
  padding-left: 2px;
}

.event-system.event-tool .event-system-label,
.event-system.event-status .event-system-label,
.event-system.event-artifact .event-system-label,
.event-system.event-fallback .event-system-label {
  letter-spacing: 0;
}

.event-system.event-tool .event-system-label,
.event-system.event-status .event-system-label,
.event-system.event-artifact .event-system-label,
.event-system.event-fallback .event-system-label,
.event-stream-shell .event-system-label,
.event-error .event-system-label {
  font-size: 11px;
}

.event-system.event-tool .event-system-content,
.event-system.event-status .event-system-content,
.event-system.event-artifact .event-system-content,
.event-system.event-fallback .event-system-content,
.event-stream-shell .event-system-content,
.event-error .event-system-content {
  line-height: 1.7;
}

.event-system.event-stream-shell {
  padding: 10px 12px;
}

.event-system.event-error {
  padding: 10px 12px;
}

.event-system-card {
  margin-top: 0;
}

.event-chat-message {
  position: relative;
}

.event-system-card {
  position: relative;
}

.event-message.bubble-user,
.event-message.bubble-assistant,
.event-system {
  backdrop-filter: none;
}

.event-system-card .event-system {
  background-clip: padding-box;
}

.event-chat-message + .event-chat-message {
  margin-top: 2px;
}

.event-system-card .event-system-label {
  user-select: none;
}

.event-chat-message .event-content,
.event-system-card .event-system-content {
  user-select: text;
}

.event-chat-message .event-message {
  white-space: normal;
}

.event-system-card .event-system {
  white-space: normal;
}

.event-message.bubble-assistant,
.event-message.bubble-user,
.event-system {
  max-width: 100%;
}

.event-chat-message.align-left .event-message,
.event-chat-message.align-right .event-message {
  max-width: min(82%, 520px);
}

.event-system-card .event-system.event-stream-shell,
.event-system-card .event-system.event-error {
  max-width: calc(100% - 24px);
}

.event-system-card .event-system:not(.event-stream-shell):not(.event-error) {
  max-width: min(calc(100% - 24px), 520px);
}

.event-message.bubble-assistant::before,
.event-message.bubble-user::after {
  box-shadow: none;
}

.event-message.bubble-user::after {
  border-top: 1px solid #2563eb;
  border-right: 1px solid #2563eb;
}

.event-message.bubble-assistant::before {
  border-radius: 2px 0 0 0;
}

.event-message.bubble-user::after {
  border-radius: 0 2px 0 0;
}

.event-system-card .event-system.event-tool,
.event-system-card .event-system.event-status,
.event-system-card .event-system.event-artifact,
.event-system-card .event-system.event-fallback {
  background: #f8fafc;
}

.event-chat-message .event-message {
  background-clip: padding-box;
}

.event-message.bubble-assistant {
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.05);
}

.event-message.bubble-user {
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.2);
}

.event-system-card .event-system {
  box-shadow: 0 1px 0 rgba(15, 23, 42, 0.02);
}

.event-system.event-tool,
.event-system.event-status,
.event-system.event-artifact,
.event-system.event-fallback {
  background: #f8fafc;
}

.event-system.event-status,
.event-system.event-tool,
.event-system.event-artifact,
.event-system.event-fallback {
  color: #475569;
}

.event-system.event-status .event-system-content,
.event-system.event-tool .event-system-content,
.event-system.event-artifact .event-system-content,
.event-system.event-fallback .event-system-content {
  color: inherit;
}

.event-system.event-status .event-system-label,
.event-system.event-tool .event-system-label,
.event-system.event-artifact .event-system-label,
.event-system.event-fallback .event-system-label {
  color: #94a3b8;
}

.event-message.bubble-user {
  color: #fff;
}

.event-message.bubble-user .event-content {
  color: inherit;
}

.event-message.bubble-assistant .event-content {
  color: #0f172a;
}

.event-stream-shell .event-system-content {
  color: #e2e8f0;
}

.event-error .event-system-content {
  color: #7f1d1d;
}

.event-error .event-system-label {
  color: #b91c1c;
}

.event-message.bubble-assistant,
.event-system {
  border-width: 1px;
}

.event-message.bubble-user {
  border-width: 1px;
}

.event-chat-message,
.event-system-card {
  min-width: 0;
}

.event-message,
.event-system {
  min-width: 0;
}

.event-content,
.event-system-content,
.event-stream {
  min-width: 0;
}

.event-chat-message .event-message {
  width: fit-content;
}

.event-chat-message.align-left .event-message,
.event-chat-message.align-right .event-message {
  width: fit-content;
}

.event-system.event-stream-shell,
.event-system.event-error {
  width: auto;
}

.event-system.event-stream-shell,
.event-system.event-error {
  min-width: min(100%, 320px);
}

.event-system.event-tool,
.event-system.event-status,
.event-system.event-artifact,
.event-system.event-fallback {
  min-width: min(240px, 100%);
}

.event-chat-message .event-content,
.event-system-card .event-system-content {
  text-align: left;
}

.event-chat-message.align-right .event-message {
  text-align: left;
}

.event-chat-message.align-right .event-content {
  text-align: left;
}

.event-system-card .event-system {
  text-align: left;
}

.event-chat-message .event-message,
.event-system-card .event-system {
  position: relative;
}

.event-system-card {
  padding-top: 1px;
  padding-bottom: 1px;
}

.event-chat-message {
  padding-top: 1px;
  padding-bottom: 1px;
}

.event-system-card .event-system-label,
.event-chat-message .event-content {
  text-rendering: optimizeLegibility;
}

.event-system-card .event-system-content,
.event-stream {
  text-rendering: optimizeLegibility;
}

.event-message.bubble-assistant,
.event-message.bubble-user,
.event-system {
  will-change: auto;
}

.event-system.event-tool,
.event-system.event-status,
.event-system.event-artifact,
.event-system.event-fallback,
.event-system.event-error,
.event-system.event-stream-shell {
  border-color: currentColor;
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

.tone-tool .event-system {
  background: #f6f8fb;
  border-color: #dbe3ee;
}

.tone-tool .event-system-label {
  color: #5f6f86;
}

.tone-status-start .event-system {
  background: #f5f9ff;
  border-color: #d9e6f7;
}

.tone-status-start .event-system-label {
  color: #5a7aa3;
}

.tone-status-completed .event-system {
  background: #f6fbf7;
  border-color: #d8e9dc;
}

.tone-status-completed .event-system-label {
  color: #5f8a67;
}

.tone-status-failed .event-system {
  background: #fff7f7;
  border-color: #f1d7d7;
}

.tone-status-failed .event-system-label {
  color: #9a6666;
}

.tone-status-neutral .event-system {
  background: #f9fafb;
  border-color: #e5e7eb;
}

.tone-status-neutral .event-system-label {
  color: #6b7280;
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

