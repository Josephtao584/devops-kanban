<template>
  <div class="event-system event-system-card event-thinking">
    <div class="event-thinking-header" @click="toggleThinkingExpanded">
      <span class="event-thinking-label">思考过程</span>
      <span class="event-thinking-toggle">{{ isThinkingExpanded ? '收起' : '展开' }}</span>
    </div>
    <pre v-if="isThinkingExpanded" class="event-thinking-content">{{ event.content }}</pre>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  event: { type: Object, required: true }
})

const isThinkingExpanded = ref(false)

function toggleThinkingExpanded() {
  isThinkingExpanded.value = !isThinkingExpanded.value
}
</script>
