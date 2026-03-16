<template>
  <div class="brainstorming-message" :class="{ 'visible': isVisible }">
    <div class="message-avatar">
      <span class="avatar-icon">{{ message.icon }}</span>
    </div>
    <div class="message-content">
      <div class="message-header">
        <span class="role-name">{{ message.role }}</span>
        <span class="message-time">{{ formattedTime }}</span>
      </div>
      <div class="message-body">
        <div v-if="isTyping" class="typewriter-content">
          {{ typedContent }}<span class="cursor">|</span>
        </div>
        <div v-else class="full-content">
          <div class="markdown-content" v-html="renderedContent"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { marked } from 'marked'

const props = defineProps({
  message: {
    type: Object,
    required: true
  },
  delay: {
    type: Number,
    default: 0
  },
  typingSpeed: {
    type: Number,
    default: 30 // ms per character
  }
})

const isVisible = ref(false)
const isTyping = ref(false)
const typedContent = ref('')
const showTime = ref(null)

const formattedTime = computed(() => {
  if (!showTime.value) return ''
  return showTime.value.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
})

const renderedContent = computed(() => {
  return marked(props.message.content || '')
})

const startTyping = async () => {
  await new Promise(resolve => setTimeout(resolve, props.delay))

  isVisible.value = true
  isTyping.value = true
  showTime.value = new Date()

  const content = props.message.content
  const chars = content.split('')

  for (let i = 0; i < chars.length; i++) {
    typedContent.value += chars[i]
    // Faster typing for already visible messages
    const speed = props.delay > 0 ? props.typingSpeed : props.typingSpeed / 2
    await new Promise(resolve => setTimeout(resolve, speed))
  }

  isTyping.value = false
}

watch(() => props.message, () => {
  typedContent.value = ''
  startTyping()
}, { immediate: true })

onMounted(() => {
  startTyping()
})
</script>

<style scoped>
.brainstorming-message {
  display: flex;
  gap: 12px;
  padding: 16px;
  opacity: 0;
  transform: translateY(10px);
  transition: all 0.3s ease;
  background: var(--el-bg-color);
  border-radius: 8px;
  margin-bottom: 12px;
  border: 1px solid var(--el-border-color-lighter);
}

.brainstorming-message.visible {
  opacity: 1;
  transform: translateY(0);
}

.message-avatar {
  flex-shrink: 0;
}

.avatar-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  font-size: 24px;
  background: var(--el-bg-color-page);
  border-radius: 50%;
  border: 2px solid var(--el-border-color);
}

.message-content {
  flex: 1;
  min-width: 0;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.role-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.message-time {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.message-body {
  background: var(--el-bg-color-page);
  border-radius: 6px;
  padding: 12px;
}

.typewriter-content {
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
  white-space: pre-wrap;
  word-break: break-word;
}

.cursor {
  animation: blink 2s infinite;
  color: var(--el-color-primary);
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.full-content {
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
}

.markdown-content :deep(*) {
  margin: 0;
}

.markdown-content :deep(p) {
  margin-bottom: 8px;
}

.markdown-content :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-content :deep(strong) {
  color: var(--el-color-primary);
  font-weight: 600;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  padding-left: 20px;
  margin: 8px 0;
}

.markdown-content :deep(li) {
  margin-bottom: 4px;
}

.markdown-content :deep(code) {
  background: var(--el-fill-color-light);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  color: var(--el-color-primary);
}

.markdown-content :deep(pre) {
  background: var(--el-fill-color);
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 8px 0;
}

.markdown-content :deep(pre code) {
  background: transparent;
  padding: 0;
  color: var(--el-text-color-primary);
}

.markdown-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 12px;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  border: 1px solid var(--el-border-color);
  padding: 8px;
  text-align: left;
}

.markdown-content :deep(th) {
  background: var(--el-fill-color);
  font-weight: 600;
}

.markdown-content :deep(blockquote) {
  border-left: 3px solid var(--el-color-primary);
  padding-left: 12px;
  margin: 8px 0;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  padding: 8px 12px;
  border-radius: 0 4px 4px 0;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 12px 0 8px;
}

.markdown-content :deep(h3) {
  font-size: 13px;
  margin: 8px 0 6px;
}
</style>
