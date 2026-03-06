<template>
  <div v-if="isDev" class="dev-tools">
    <details>
      <summary>🔧 Dev Tools</summary>
      <div class="dev-section">
        <h4>Session State</h4>
        <pre>{{ JSON.stringify(session, null, 2) }}</pre>
      </div>
      <div class="dev-section">
        <h4>WebSocket</h4>
        <span>Connected: {{ wsConnected }}</span>
      </div>
      <div class="dev-section">
        <h4>Can Send Message</h4>
        <span>{{ canSend }}</span>
      </div>
      <div v-if="agentId" class="dev-section">
        <h4>Agent ID</h4>
        <span>{{ agentId }}</span>
      </div>
    </details>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  session: {
    type: Object,
    default: null
  },
  wsConnected: {
    type: Boolean,
    default: false
  },
  agentId: {
    type: [Number, String],
    default: null
  }
})

const isDev = import.meta.env.DEV

const canSend = computed(() => {
  if (!props.session) return false
  const status = props.session.status
  const claudeSessionId = props.session.claudeSessionId
  if (['RUNNING', 'IDLE'].includes(status)) return true
  if (['STOPPED', 'COMPLETED'].includes(status) && claudeSessionId) return true
  return false
})
</script>

<style scoped>
.dev-tools {
  position: relative;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 8px;
  font-size: 11px;
}

.dev-tools summary {
  padding: 4px 8px;
  cursor: pointer;
  font-weight: 600;
  color: #666;
}

.dev-tools details[open] summary {
  border-bottom: 1px solid #ddd;
}

.dev-section {
  padding: 8px;
  border-bottom: 1px solid #eee;
}

.dev-section:last-child {
  border-bottom: none;
}

.dev-section h4 {
  margin: 0 0 4px 0;
  font-size: 11px;
  color: #888;
  text-transform: uppercase;
}

.dev-section pre {
  margin: 0;
  font-size: 10px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 150px;
  overflow: auto;
  background: #fff;
  padding: 4px;
  border-radius: 2px;
}
</style>