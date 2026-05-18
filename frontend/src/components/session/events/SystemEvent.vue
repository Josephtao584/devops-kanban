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

<style scoped>
.event-system {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: min(95%, 800px);
  padding: 9px 11px;
  border-radius: 14px;
  border: 1px solid #e5e7eb;
  background: #f8fafc;
  white-space: normal;
  background-clip: padding-box;
  text-align: left;
  position: relative;
  min-width: 0;
  border-width: 1px;
  transition: none;
}

.event-system-card {
  display: flex;
  flex-direction: column;
  padding-inline: 12px;
  position: relative;
  width: 100%;
  min-width: 0;
  padding-top: 1px;
  padding-bottom: 1px;
  justify-content: flex-start;
}

.event-system-card .event-system {
  margin-left: 0;
  box-shadow: 0 1px 0 rgba(15, 23, 42, 0.02);
}

.event-system-label {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  color: #94a3b8;
  user-select: none;
  text-rendering: optimizeLegibility;
}

.event-system-label::before {
  content: '· ';
}

.event-system-content {
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  color: inherit;
  padding-left: 2px;
  user-select: text;
  min-width: 0;
  text-align: left;
  text-rendering: optimizeLegibility;
}

.event-artifact,
.event-fallback {
  background: #f8fafc;
  border-color: #e2e8f0;
  border-style: dashed;
  color: #475569;
  width: fit-content;
  min-width: min(240px, 100%);
  max-width: min(calc(100% - 24px), 800px);
  margin-left: 0;
  align-self: flex-start;
  box-shadow: none;
  opacity: 0.96;
}

.event-artifact:hover,
.event-fallback:hover {
  border-color: #cbd5e1;
}

.event-error {
  background: #fff7f7;
  border-color: #fecaca;
  align-self: flex-start;
  width: 100%;
  max-width: calc(100% - 24px);
  min-width: min(100%, 320px);
  padding: 10px 12px;
  opacity: 1;
}

.event-error .event-system-label {
  color: #b91c1c;
  text-transform: none;
  letter-spacing: 0;
  font-size: 11px;
}

.event-error .event-system-label::before {
  content: '';
}

.event-error .event-system-content {
  color: #7f1d1d;
  line-height: 1.7;
}

.event-stream-shell {
  background: #111827;
  border-color: #111827;
  align-self: flex-start;
  width: 100%;
  max-width: calc(100% - 24px);
  min-width: min(100%, 320px);
  padding: 10px 12px;
  box-shadow: none;
  opacity: 1;
}

.event-stream-shell .event-system-label {
  color: #94a3b8;
  text-transform: none;
  letter-spacing: 0;
  font-size: 11px;
}

.event-stream-shell .event-system-label::before {
  content: '';
}

.event-stream-shell .event-system-content {
  color: #e2e8f0;
  line-height: 1.7;
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
  color: #e5e7eb;
  text-rendering: optimizeLegibility;
  min-width: 0;
}

.event-ask-user {
  background: #eff6ff;
  border-color: #93c5fd;
  align-self: flex-start;
  width: fit-content;
  max-width: min(calc(100% - 24px), 800px);
  min-width: min(240px, 100%);
}

.event-ask-user .event-system-label {
  color: #2563eb;
}

.event-ask-question {
  font-size: 13px;
  color: #1e40af;
  line-height: 1.6;
  white-space: pre-wrap;
}

.event-ask-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.event-ask-option {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 500;
}
</style>
