<template>
  <div
    class="event-row event-chat-message"
    :class="messageAlignmentClass"
  >
    <div class="event-message-wrapper" :class="messageAlignmentClass">
      <div v-if="messageTime" class="event-time">{{ messageTime }}</div>
      <div class="event-role-label" :class="messageAlignmentClass">{{ roleLabel }}</div>
      <div class="event-message" :class="messageBubbleClass">
        <div class="event-content" v-html="formattedMessageContent"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { marked } from 'marked'

const props = defineProps({
  event: { type: Object, required: true }
})

const messageAlignmentClass = computed(() => {
  return props.event?.role === 'user' ? 'align-right' : 'align-left'
})

const messageBubbleClass = computed(() => {
  return props.event?.role === 'user' ? 'bubble-user' : 'bubble-assistant'
})

const roleLabel = computed(() => {
  return props.event?.role === 'user' ? '用户' : 'Agent'
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

  const safeContent = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const rendered = marked.parse(safeContent, {
    gfm: true,
    breaks: true
  })

  return typeof rendered === 'string' ? rendered : ''
})
</script>
