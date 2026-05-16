<template>
  <div v-if="event.kind === 'error'" class="event-system event-system-card event-error">
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
  <div v-else-if="event.kind === 'ask_user'" class="event-system event-system-card event-ask-user">
    <div class="event-system-label">AI 提问</div>
    <div class="event-ask-question">{{ askQuestionText }}</div>
    <div v-if="askQuestionOptions.length" class="event-ask-options">
      <span v-for="opt in askQuestionOptions" :key="opt.value" class="event-ask-option">{{ opt.label }}</span>
    </div>
  </div>
  <div v-else class="event-system event-system-card event-fallback">
    <div class="event-system-label">{{ fallbackLabel }}</div>
    <div class="event-system-content">{{ fallbackContent }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  event: { type: Object, required: true }
})

const askQuestionText = computed(() => {
  const questions = props.event?.payload?.ask_user_question?.questions
  if (Array.isArray(questions) && questions.length > 0) {
    return questions.map(q => q.question).join('\n')
  }
  return props.event?.content || ''
})

const askQuestionOptions = computed(() => {
  const questions = props.event?.payload?.ask_user_question?.questions
  if (Array.isArray(questions) && questions.length > 0 && questions[0]?.options) {
    return questions[0].options
  }
  return []
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
</script>
