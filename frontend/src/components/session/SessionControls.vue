<template>
  <div class="session-controls">
    <!-- Create button (no session, no agent) -->
    <el-button
      v-if="showCreate"
      type="warning"
      size="small"
      :loading="loading"
      @click="$emit('create')"
    >
      <el-icon><VideoPlay /></el-icon> {{ createText }}
    </el-button>

    <!-- Start button (has agent, session not started) -->
    <el-button
      v-if="showStart"
      type="primary"
      size="small"
      :loading="loading"
      @click="$emit('start')"
    >
      <el-icon><VideoPlay /></el-icon> {{ startText }}
    </el-button>

    <!-- Stop button (session running) -->
    <el-button
      v-if="showStop"
      type="danger"
      size="small"
      :loading="loading"
      @click="$emit('stop')"
    >
      <el-icon><VideoPause /></el-icon> {{ stopText }}
    </el-button>

    <!-- Delete button (has session) -->
    <el-button
      v-if="showDelete"
      type="danger"
      size="small"
      @click="$emit('delete')"
    >
      <el-icon><Delete /></el-icon>
    </el-button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { VideoPlay, VideoPause, Delete } from '@element-plus/icons-vue'
import { SESSION_STATUS, SESSION_INPUT_STATUSES } from '../../constants/session'

const props = defineProps({
  status: {
    type: String,
    default: ''
  },
  hasAgent: {
    type: Boolean,
    default: false
  },
  hasSession: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  },
  createText: {
    type: String,
    default: 'Create'
  },
  startText: {
    type: String,
    default: 'Start'
  },
  stopText: {
    type: String,
    default: 'Stop'
  }
})

defineEmits(['create', 'start', 'stop', 'delete'])

const showCreate = computed(() => !props.hasSession && !props.hasAgent)
const showStart = computed(() => {
  if (!props.hasSession && props.hasAgent) return true
  if (props.hasSession && props.status === SESSION_STATUS.CREATED) return true
  return false
})
const showStop = computed(() => {
  return props.hasSession && SESSION_INPUT_STATUSES.includes(props.status)
})
const showDelete = computed(() => props.hasSession)
</script>

<style scoped>
.session-controls {
  display: flex;
  gap: 8px;
}
</style>
