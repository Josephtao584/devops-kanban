<template>
  <div
    class="event-row event-chat-message"
    :class="messageAlignmentClass"
  >
    <div class="event-message-wrapper" :class="messageAlignmentClass">
      <div v-if="messageTime" class="event-time">{{ messageTime }}</div>
      <div class="event-role-label" :class="messageAlignmentClass">{{ roleLabel }}</div>
      <div class="event-message" :class="messageBubbleClass">
        <div
          v-if="isUserMessage"
          class="event-content event-content-plain"
        >{{ rawMessageContent }}</div>
        <div
          v-else
          class="event-content"
          v-html="formattedMessageContent"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const props = defineProps({
  event: { type: Object, required: true },
  assistantLabel: { type: String, default: '' }
})

const messageAlignmentClass = computed(() => {
  return props.event?.role === 'user' ? 'align-right' : 'align-left'
})

const isUserMessage = computed(() => props.event?.role === 'user')

const rawMessageContent = computed(() => props.event?.content || '')

const messageBubbleClass = computed(() => {
  return props.event?.role === 'user' ? 'bubble-user' : 'bubble-assistant'
})

const roleLabel = computed(() => {
  if (props.event?.role === 'user') return '用户'
  return props.assistantLabel || 'Agent'
})

const messageTime = computed(() => {
  if (props.event?.kind !== 'message' || !props.event?.created_at) return ''
  return new Date(props.event.created_at).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
})

const formattedMessageContent = computed(() => {
  const content = props.event?.content || ''
  if (props.event?.kind !== 'message' || !content) return content

  const rendered = marked.parse(content, {
    gfm: true,
    breaks: true
  })

  const html = typeof rendered === 'string' ? rendered : ''
  return html ? DOMPurify.sanitize(html) : ''
})
</script>

<style scoped>
.event-row {
  display: flex;
}

.event-chat-message {
  margin: 2px 0 4px;
  position: relative;
  padding-top: 1px;
  padding-bottom: 1px;
  width: 100%;
  min-width: 0;
}

.event-chat-message + .event-chat-message {
  margin-top: 2px;
}

.event-chat-message.align-right {
  justify-content: flex-end;
}

.event-chat-message.align-left {
  justify-content: flex-start;
}

.event-chat-message.align-left {
  padding-right: 28px;
}

.event-chat-message.align-right {
  padding-left: 28px;
}

.event-chat-message.align-left,
.event-chat-message.align-right {
  align-items: stretch;
}

.event-message-wrapper {
  display: flex;
  flex-direction: column;
  max-width: min(88%, 720px);
}

.event-message-wrapper.align-right {
  align-items: flex-end;
}

.event-message-wrapper.align-left {
  align-items: flex-start;
}

.event-time {
  font-size: 11px;
  color: #9ca3af;
  padding: 0 4px;
  margin-bottom: 2px;
}

.event-role-label {
  font-size: 11px;
  font-weight: 500;
  padding: 0 4px;
  margin-bottom: 3px;
}

.event-role-label.align-right {
  text-align: right;
  color: #9ca3af;
}

.event-role-label.align-left {
  text-align: left;
  color: #6b7280;
}

.event-message {
  padding: 14px 16px;
  border-radius: 18px;
  background: #ffffff;
  color: #111827;
  border: 1px solid #e5e7eb;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
  min-width: 120px;
  max-width: 100%;
  width: fit-content;
  background-clip: padding-box;
  white-space: normal;
  position: relative;
  overflow: visible;
  border-width: 1px;
  transition: none;
}

.event-message.bubble-user {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
  border-top-right-radius: 6px;
  box-shadow: 0 12px 28px rgba(37, 99, 235, 0.22);
}

.event-message.bubble-assistant {
  border-top-left-radius: 6px;
  background: #ffffff;
  border-color: #dbe4f0;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.05);
}

.event-message.bubble-user {
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.2);
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
  border-radius: 2px 0 0 0;
  box-shadow: none;
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
  border-top: 1px solid #2563eb;
  border-right: 1px solid #2563eb;
  border-radius: 0 2px 0 0;
  box-shadow: none;
}

.event-chat-message.align-left .event-message {
  margin-left: 8px;
  width: fit-content;
  max-width: 100%;
}

.event-chat-message.align-right .event-message {
  margin-right: 8px;
  width: fit-content;
  max-width: 100%;
  text-align: left;
}

.event-message.bubble-assistant:hover {
  border-color: #cbd5e1;
}

.event-message.bubble-user:hover {
  border-color: #2563eb;
}

.event-content {
  font-size: 13px;
  line-height: 1.75;
  white-space: normal;
  word-break: break-word;
  overflow-x: auto;
  user-select: text;
  text-align: left;
  text-rendering: optimizeLegibility;
  min-width: 0;
}

.event-content-plain {
  white-space: pre-wrap;
}

.event-message.bubble-assistant .event-content {
  font-size: 14px;
  line-height: 1.8;
  color: #0f172a;
}

.event-message.bubble-user .event-content {
  font-size: 14px;
  line-height: 1.8;
  color: inherit;
}

.event-chat-message.align-right .event-content {
  text-align: left;
}

.event-content :deep(strong) {
  font-weight: 600;
}

.event-content :deep(em) {
  font-style: italic;
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

.event-content :deep(p) {
  margin: 0.6em 0;
}

.event-content :deep(p:first-child) {
  margin-top: 0;
}

.event-content :deep(p:last-child) {
  margin-bottom: 0;
}

.event-content :deep(br) {
  content: '';
  display: table;
  margin: 0.4em 0;
}

.event-content :deep(ul) {
  padding-left: 1.5em;
  margin: 0.5em 0;
  list-style: disc outside;
}

.event-content :deep(ol) {
  padding-left: 1.5em;
  margin: 0.5em 0;
  list-style: decimal outside;
}

.event-content :deep(li) {
  margin: 0.4em 0;
  line-height: 1.7;
}

.event-content :deep(li::marker) {
  color: #475569;
}

.event-message.bubble-user .event-content :deep(li::marker) {
  color: rgba(255, 255, 255, 0.85);
}

.event-content :deep(h1),
.event-content :deep(h2),
.event-content :deep(h3),
.event-content :deep(h4) {
  margin: 1.2em 0 0.6em;
  font-weight: 700;
  line-height: 1.35;
}

.event-content :deep(h1) {
  font-size: 1.35em;
}

.event-content :deep(h2) {
  font-size: 1.2em;
}

.event-content :deep(h3) {
  font-size: 1.1em;
}

.event-content :deep(h4) {
  font-size: 1em;
  color: #1f2937;
}

.event-message.bubble-user .event-content :deep(h1),
.event-message.bubble-user .event-content :deep(h2),
.event-message.bubble-user .event-content :deep(h3),
.event-message.bubble-user .event-content :deep(h4) {
  color: #ffffff;
}

.event-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 13px;
}

.event-content :deep(th),
.event-content :deep(td) {
  padding: 8px 10px;
  border: 1px solid #dbe4f0;
  text-align: left;
  vertical-align: top;
}

.event-content :deep(th) {
  background: rgba(15, 23, 42, 0.06);
  font-weight: 600;
}

.event-message.bubble-user .event-content :deep(th) {
  background: rgba(255, 255, 255, 0.16);
}

.event-content :deep(blockquote) {
  margin: 0.6em 0;
  padding: 0.2em 0.8em;
  border-left: 3px solid rgba(15, 23, 42, 0.18);
  color: #475569;
}

.event-message.bubble-user .event-content :deep(blockquote) {
  border-left-color: rgba(255, 255, 255, 0.4);
  color: rgba(255, 255, 255, 0.92);
}

.event-content :deep(a) {
  color: #2563eb;
  text-decoration: underline;
}

.event-message.bubble-user .event-content :deep(a) {
  color: #ffffff;
  text-decoration: underline;
}
</style>
