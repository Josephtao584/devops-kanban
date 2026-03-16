<template>
  <div class="brainstorming-drawer" :class="{ 'visible': visible }">
    <div class="drawer-overlay" @click="$emit('close')"></div>
    <div class="drawer-content">
      <!-- Header -->
      <div class="drawer-header">
        <div class="header-left">
          <span class="header-icon">🧠</span>
          <h4 class="header-title">{{ $t('brainstorming.title', '头脑风暴') }}</h4>
          <span v-if="topic" class="topic-tag">{{ topic }}</span>
        </div>
        <div class="header-actions">
          <el-button
            type="primary"
            size="small"
            :disabled="isRunning || isCompleted"
            @click="startBrainstorming"
          >
            <el-icon><Lightning /></el-icon>
            {{ isRunning ? $t('brainstorming.inProgress', '讨论中...') : isCompleted ? $t('brainstorming.completed', '已完成') : $t('brainstorming.start', '开始讨论') }}
          </el-button>
          <el-button size="small" text @click="$emit('close')">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
      </div>

      <!-- Participants Bar -->
      <div v-if="isRunning || isCompleted" class="participants-bar">
        <span class="participants-label">
          <el-icon><User /></el-icon>
          {{ $t('brainstorming.participants', '参与者') }}:
        </span>
        <div class="participants-list">
          <span
            v-for="(role, index) in currentParticipants"
            :key="role"
            class="participant"
            :class="{
              'active': currentIndex === index,
              'completed': currentIndex > index
            }"
          >
            <span class="participant-icon">
              {{ roleConfig[role]?.icon || '👤' }}
            </span>
            <span class="participant-name">{{ role }}</span>
            <el-icon v-if="currentIndex > index" class="check-icon"><Check /></el-icon>
          </span>
        </div>
      </div>

      <!-- Messages Container -->
      <div ref="messagesContainer" class="messages-container">
        <div v-if="!isStarted && !isCompleted" class="empty-state">
          <div class="empty-icon">🎯</div>
          <p class="empty-hint">{{ $t('brainstorming.emptyHint', '点击「开始讨论」按钮，召唤多位角色进行头脑风暴') }}</p>
        </div>

        <template v-else>
          <div
            v-for="(msg, index) in visibleMessages"
            :key="index"
            class="brainstorming-message"
            :class="{ 'visible': msg.visible }"
          >
            <div class="message-avatar">
              <span class="avatar-icon">{{ msg.icon }}</span>
            </div>
            <div class="message-content">
              <div class="message-header">
                <span class="role-name">{{ msg.role }}</span>
                <span class="message-time">{{ msg.showTime }}</span>
              </div>
              <div class="message-body">
                <div v-if="msg.isTyping" class="typewriter-content">
                  {{ msg.typedContent }}<span class="cursor">|</span>
                </div>
                <div v-else class="full-content markdown-content" v-html="msg.renderedContent"></div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Conclusion Card -->
      <div v-if="isCompleted && currentConclusion" class="conclusion-card">
        <div class="conclusion-header">
          <div class="header-left">
            <span class="header-icon">📋</span>
            <h4 class="header-title">综合结论</h4>
          </div>
          <el-tag type="success" size="small">
            <el-icon><Check /></el-icon>
            讨论完成
          </el-tag>
        </div>
        <div class="conclusion-body">
          <div class="markdown-content" v-html="renderedConclusion"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { Lightning, User, Check, Close } from '@element-plus/icons-vue'
import { roleConfig } from '@/mock/workflowData'
import {
  getScriptByTaskType,
  matchTaskType
} from '@/mock/brainstormingData'
import { marked } from 'marked'

const props = defineProps({
  task: {
    type: Object,
    default: null
  },
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'add-to-task'])

// State
const isStarted = ref(false)
const isRunning = ref(false)
const isCompleted = ref(false)
const currentIndex = ref(-1)
const visibleMessages = ref([])
const topic = ref('')
const currentParticipants = ref([])
const currentConclusion = ref('')
const currentScript = ref(null)

const messagesContainer = ref(null)

// Get task type for script selection
const taskType = computed(() => {
  if (!props.task) return 'default'
  return matchTaskType(props.task.title || '', props.task.description || '')
})

const renderedConclusion = computed(() => {
  return marked(currentConclusion.value || '')
})

// Initialize and start brainstorming
const startBrainstorming = async () => {
  if (isRunning.value || isCompleted.value) return

  // Reset state
  isStarted.value = true
  isRunning.value = true
  isCompleted.value = false
  currentIndex.value = -1
  visibleMessages.value = []
  currentConclusion.value = ''

  // Get script based on task type
  const type = taskType.value
  currentScript.value = getScriptByTaskType(type)
  topic.value = currentScript.value.topic
  currentParticipants.value = currentScript.value.participants

  // Play dialogues sequentially
  await playDialogues()
}

const playDialogues = async () => {
  const dialogues = currentScript.value.dialogues

  for (let i = 0; i < dialogues.length; i++) {
    if (!isRunning.value) break

    currentIndex.value = i

    // Add message with typing state
    const newMessage = {
      role: dialogues[i].role,
      icon: dialogues[i].icon,
      content: dialogues[i].content,
      typedContent: '',
      isTyping: true,
      visible: false,
      showTime: ''
    }
    visibleMessages.value.push(newMessage)

    // Start typing animation
    await typeMessage(visibleMessages.value.length - 1, dialogues[i].content)

    // Scroll to bottom
    scrollToBottom()
  }

  // Show conclusion
  finishBrainstorming()
}

const typeMessage = async (msgIndex, content) => {
  const msg = visibleMessages.value[msgIndex]
  msg.visible = true
  msg.isTyping = true
  msg.showTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

  const chars = content.split('')
  const typingSpeed = 20 // 20ms/字符

  for (let i = 0; i < chars.length; i++) {
    if (!isRunning.value) break
    msg.typedContent += chars[i]
    await new Promise(resolve => setTimeout(resolve, typingSpeed))
  }

  // Mark message as fully typed and render markdown
  msg.isTyping = false
  msg.renderedContent = marked(content)
}

const finishBrainstorming = () => {
  isRunning.value = false
  isCompleted.value = true
  currentIndex.value = -1
  currentConclusion.value = currentScript.value.conclusion
  scrollToBottom()
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

// Expose method for external control
defineExpose({
  startBrainstorming
})
</script>

<style scoped>
.brainstorming-drawer {
  position: fixed;
  top: 0;
  right: -600px;
  width: 600px;
  height: 100vh;
  z-index: 2000;
  transition: right 0.3s ease;
  pointer-events: none;
}

.brainstorming-drawer.visible {
  right: 0;
  pointer-events: auto;
}

.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  z-index: -1;
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.brainstorming-drawer.visible .drawer-overlay {
  opacity: 1;
  pointer-events: auto;
}

.drawer-content {
  position: relative;
  width: 600px;
  height: 100vh;
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  font-size: 24px;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0;
}

.topic-tag {
  font-size: 12px;
  color: var(--el-color-primary);
  background: rgba(102, 126, 234, 0.1);
  padding: 4px 12px;
  border-radius: 12px;
  font-weight: 500;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* Participants Bar */
.participants-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: var(--el-bg-color-page);
  border-bottom: 1px solid var(--el-border-color-lighter);
  flex-wrap: wrap;
}

.participants-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.participants-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.participant {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: var(--el-fill-color);
  border-radius: 16px;
  font-size: 12px;
  color: var(--el-text-color-regular);
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

.participant.active {
  background: rgba(102, 126, 234, 0.15);
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
  animation: pulse 1.5s infinite;
}

.participant.completed {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
}

.participant-icon {
  font-size: 14px;
}

.participant-name {
  font-weight: 500;
}

.check-icon {
  font-size: 14px;
  color: #059669;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(102, 126, 234, 0); }
}

/* Messages Container */
.messages-container {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background: var(--el-bg-color-page);
  min-height: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: var(--el-text-color-secondary);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.empty-hint {
  font-size: 14px;
  text-align: center;
  max-width: 300px;
}

/* Brainstorming Message */
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

.markdown-content :deep(h3),
.markdown-content :deep(h4) {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 12px 0 8px;
}

/* Conclusion Card - Optimized for better readability */
.conclusion-card {
  background: #fff;
  border: 1px solid #86efac;
  border-radius: 12px 12px 0 0;
  padding: 12px;
  margin-top: auto;
  max-height: 40%;
  overflow-y: auto;
}

.conclusion-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #86efac;
}

.conclusion-header .header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.conclusion-header .header-title {
  font-size: 14px;
  font-weight: 600;
  color: #166534;
  margin: 0;
}

.conclusion-body {
  background: #f9fafb;
  border-radius: 8px;
  padding: 10px;
  max-height: 400px;
  overflow-y: auto;
}

.conclusion-body .markdown-content {
  font-size: 12px;
  line-height: 1.5;
}

.conclusion-body .markdown-content :deep(h3),
.conclusion-body .markdown-content :deep(h4) {
  font-size: 13px;
  margin: 8px 0;
}

.conclusion-body .markdown-content :deep(table) {
  font-size: 11px;
  width: 100%;
  border-collapse: collapse;
}

.conclusion-body .markdown-content :deep(th),
.conclusion-body .markdown-content :deep(td) {
  padding: 4px 8px;
  border: 1px solid var(--el-border-color);
  text-align: left;
}

.conclusion-body .markdown-content :deep(ul),
.conclusion-body .markdown-content :deep(ol) {
  padding-left: 16px;
  margin: 4px 0;
}

.conclusion-body .markdown-content :deep(li) {
  margin-bottom: 2px;
}

.conclusion-body .markdown-content :deep(code) {
  background: var(--el-fill-color-light);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 11px;
  color: var(--el-color-primary);
}

.conclusion-body .markdown-content :deep(pre) {
  background: var(--el-fill-color);
  padding: 10px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 6px 0;
}

.conclusion-body .markdown-content :deep(pre code) {
  background: transparent;
  padding: 0;
  color: var(--el-text-color-primary);
}

.conclusion-body .markdown-content :deep(blockquote) {
  border-left: 3px solid #86efac;
  padding-left: 10px;
  margin: 6px 0;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  padding: 6px 10px;
  border-radius: 0 4px 4px 0;
}

.conclusion-body .markdown-content :deep(h3),
.conclusion-body .markdown-content :deep(h4) {
  font-size: 13px;
  font-weight: 600;
  color: #166534;
  margin: 8px 0;
}

/* Scrollbar styling */
.messages-container::-webkit-scrollbar,
.conclusion-body::-webkit-scrollbar {
  width: 6px;
}

.messages-container::-webkit-scrollbar-track,
.conclusion-body::-webkit-scrollbar-track {
  background: var(--el-fill-color);
  border-radius: 3px;
}

.messages-container::-webkit-scrollbar-thumb,
.conclusion-body::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
  border-radius: 3px;
}

.messages-container::-webkit-scrollbar-thumb:hover,
.conclusion-body::-webkit-scrollbar-thumb:hover {
  background: var(--el-border-color-dark);
}
</style>
