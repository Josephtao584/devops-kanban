<template>
  <el-dialog
    v-model="dialogVisible"
    title="Select AI Agent"
    width="450px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <div v-if="loading" class="loading-container">
      <el-icon class="is-loading" :size="24"><Loading /></el-icon>
      <span>Loading agents...</span>
    </div>

    <div v-else-if="agents.length === 0" class="empty-state">
      <el-empty description="No agents available">
        <template #description>
          <p>Please configure an agent first</p>
        </template>
      </el-empty>
    </div>

    <div v-else class="agent-list">
      <div
        v-for="agent in agents"
        :key="agent.id"
        class="agent-item"
        :class="{ selected: selectedAgentId === agent.id }"
        @click="selectedAgentId = agent.id"
      >
        <el-icon :size="28" class="agent-icon">
          <component :is="getAgentIcon(agent.type)" />
        </el-icon>
        <div class="agent-info">
          <span class="agent-name">{{ agent.name }}</span>
          <span class="agent-type">{{ formatAgentType(agent.type) }}</span>
        </div>
        <el-icon v-if="selectedAgentId === agent.id" class="check-icon" color="#67c23a">
          <Check />
        </el-icon>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">Cancel</el-button>
        <el-button
          type="primary"
          :disabled="!selectedAgentId"
          :loading="starting"
          @click="confirmSelect"
        >
          Start Session
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Loading,
  Check,
  Monitor,
  Cpu,
  Connection,
  User
} from '@element-plus/icons-vue'
import { getAgents } from '../api/agent'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  projectId: {
    type: [Number, String],
    required: true
  },
  task: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:modelValue', 'select'])

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const agents = ref([])
const selectedAgentId = ref(null)
const loading = ref(false)
const starting = ref(false)

const loadAgents = async () => {
  console.log('[AgentSelector] loadAgents called, projectId:', props.projectId, 'type:', typeof props.projectId)
  // Check for null or undefined specifically, allow 0 and non-empty strings
  if (props.projectId == null || props.projectId === '') {
    console.log('[AgentSelector] projectId is null/undefined/empty, returning early')
    return
  }

  loading.value = true
  try {
    const response = await getAgents(props.projectId)
    console.log('[AgentSelector] getAgents response:', response)
    // Backend returns ApiResponse { success, data, message }
    agents.value = Array.isArray(response) ? response : (response.data || [])
    console.log('[AgentSelector] agents.value:', agents.value)
    // Auto-select first agent if only one available
    if (agents.value.length === 1) {
      selectedAgentId.value = agents.value[0].id
    }
  } catch (e) {
    console.error('[AgentSelector] Failed to load agents:', e)
    ElMessage.error('Failed to load agents')
  } finally {
    loading.value = false
  }
}

const getAgentIcon = (type) => {
  const icons = {
    CLAUDE_CODE: Monitor,
    CODEX: Cpu,
    LOCAL: Connection,
    DEFAULT: User
  }
  return icons[type] || icons.DEFAULT
}

const formatAgentType = (type) => {
  if (!type) return 'Unknown'
  return type.replace(/_/g, ' ').toLowerCase()
    .replace(/\b\w/g, l => l.toUpperCase())
}

const confirmSelect = () => {
  if (!selectedAgentId.value) return

  const selectedAgent = agents.value.find(a => a.id === selectedAgentId.value)
  if (selectedAgent) {
    starting.value = true
    emit('select', {
      agentId: selectedAgent.id,
      agent: selectedAgent,
      task: props.task
    })
  }
}

const handleClose = () => {
  dialogVisible.value = false
  selectedAgentId.value = null
  starting.value = false
}

// Reset state when dialog opens
watch(dialogVisible, (val) => {
  if (val) {
    selectedAgentId.value = null
    starting.value = false
    console.log('Dialog opened, projectId:', props.projectId, 'type:', typeof props.projectId)
    loadAgents()
  }
})

// Load agents when component is mounted (for v-if case)
onMounted(() => {
  if (dialogVisible.value) {
    loadAgents()
  }
})
</script>

<style scoped>
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  gap: 12px;
  color: var(--el-text-color-secondary);
}

.empty-state {
  padding: 20px;
}

.agent-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
}

.agent-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.agent-item:hover {
  border-color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-9);
}

.agent-item.selected {
  border-color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-8);
}

.agent-icon {
  color: var(--el-color-primary);
}

.agent-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.agent-name {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.agent-type {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.check-icon {
  font-size: 20px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
