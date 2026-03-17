<template>
  <el-drawer
    :model-value="visible"
    :title="$t('execution.detail')"
    size="50%"
    direction="rtl"
    @close="$emit('close')"
  >
    <!-- Loading state -->
    <div v-if="loading" class="drawer-content">
      <el-skeleton :rows="10" animated />
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="drawer-content">
      <el-empty :description="error" />
    </div>

    <!-- Detail content -->
    <div v-else-if="execution" class="drawer-content">
      <!-- Task info card -->
      <el-card shadow="never" class="info-card">
        <template #header>
          <div class="card-header">
            <span class="card-title">{{ $t('execution.taskInfo') }}</span>
          </div>
        </template>
        <div class="info-row">
          <span class="info-label">{{ $t('agent.taskTitle') }}</span>
          <span class="info-value">{{ execution.taskTitle || `Task #${execution.taskId}` }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('task.status') }}</span>
          <span class="info-value">
            <el-tag :type="getTaskStatusType(execution.taskStatus)" size="small">
              {{ execution.taskStatus ? $t(`status.${execution.taskStatus}`) : '-' }}
            </el-tag>
          </span>
        </div>
      </el-card>

      <!-- Execution info card -->
      <el-card shadow="never" class="info-card">
        <template #header>
          <div class="card-header">
            <span class="card-title">{{ $t('execution.executionInfo') }}</span>
          </div>
        </template>
        <div class="info-row">
          <span class="info-label">{{ $t('execution.status') }}</span>
          <span class="info-value">
            <el-tag :type="getExecutionStatusType(execution.status)" size="small">
              {{ $t(`execution.statuses.${execution.status}`) }}
            </el-tag>
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('execution.startedAt') }}</span>
          <span class="info-value">{{ formatDateTime(execution.startedAt) }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('execution.completedAt') }}</span>
          <span class="info-value">{{ execution.completedAt ? formatDateTime(execution.completedAt) : '-' }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('execution.duration') }}</span>
          <span class="info-value">{{ calculateDuration(execution.startedAt, execution.completedAt) }}</span>
        </div>
      </el-card>

      <!-- Git info card (conditional) -->
      <el-card v-if="execution.branch || execution.worktreePath" shadow="never" class="info-card">
        <template #header>
          <div class="card-header">
            <span class="card-title">{{ $t('execution.gitInfo') }}</span>
          </div>
        </template>
        <div v-if="execution.branch" class="info-row">
          <span class="info-label">{{ $t('execution.branch') }}</span>
          <span class="info-value">
            <el-tag type="info" size="small">{{ execution.branch }}</el-tag>
          </span>
        </div>
        <div v-if="execution.worktreePath" class="info-row">
          <span class="info-label">{{ $t('execution.worktreePath') }}</span>
          <span class="info-value code-text">{{ execution.worktreePath }}</span>
        </div>
      </el-card>

      <!-- Output section -->
      <div class="output-section">
        <div class="output-header">
          <span class="card-title">{{ $t('execution.output') }}</span>
        </div>
        <el-scrollbar height="400px">
          <pre v-if="execution.output" class="terminal-output">{{ execution.output }}</pre>
          <el-empty v-else :description="$t('execution.noOutput')" :image-size="60" />
        </el-scrollbar>
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getExecution } from '../api/execution'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  executionId: {
    type: Number,
    default: null
  }
})

const emit = defineEmits(['close'])

const loading = ref(false)
const error = ref(null)
const execution = ref(null)

// Load execution detail when visible changes
watch(() => props.visible, async (newVisible) => {
  if (newVisible && props.executionId) {
    await loadExecutionDetail()
  } else if (!newVisible) {
    // Reset state when closing
    execution.value = null
    error.value = null
  }
})

// Also watch executionId in case it changes while drawer is open
watch(() => props.executionId, async (newId) => {
  if (props.visible && newId) {
    await loadExecutionDetail()
  }
})

const loadExecutionDetail = async () => {
  if (!props.executionId) return

  loading.value = true
  error.value = null

  try {
    const response = await getExecution(props.executionId)
    if (response.success && response.data) {
      execution.value = response.data
    } else {
      error.value = response.message || 'Failed to load execution detail'
    }
  } catch (e) {
    console.error('Failed to load execution detail:', e)
    error.value = e.message || 'Failed to load execution detail'
  } finally {
    loading.value = false
  }
}

const formatDateTime = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const calculateDuration = (startedAt, completedAt) => {
  if (!startedAt) return '-'

  const start = new Date(startedAt)
  const end = completedAt ? new Date(completedAt) : new Date()
  const diff = end - start

  if (diff < 0) return '-'

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

const getTaskStatusType = (status) => {
  const typeMap = {
    'TODO': 'info',
    'IN_PROGRESS': 'warning',
    'DONE': 'success',
    'BLOCKED': 'danger'
  }
  return typeMap[status] || 'info'
}

const getExecutionStatusType = (status) => {
  const typeMap = {
    'PENDING': 'info',
    'RUNNING': 'warning',
    'SUCCESS': 'success',
    'FAILED': 'danger',
    'CANCELLED': 'info'
  }
  return typeMap[status] || 'info'
}
</script>

<style scoped>
.drawer-content {
  padding: 0 16px 16px;
}

.info-card {
  margin-bottom: 16px;
}

.info-card :deep(.el-card__header) {
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
}

.info-card :deep(.el-card__body) {
  padding: 12px 16px;
}

.card-header {
  display: flex;
  align-items: center;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.info-row {
  display: flex;
  align-items: center;
  padding: 8px 0;
}

.info-row:not(:last-child) {
  border-bottom: 1px solid #f5f7fa;
}

.info-label {
  width: 100px;
  flex-shrink: 0;
  color: #909399;
  font-size: 13px;
}

.info-value {
  color: #303133;
  font-size: 13px;
}

.code-text {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  background: #f5f7fa;
  padding: 2px 6px;
  border-radius: 4px;
}

/* Output section */
.output-section {
  margin-top: 16px;
}

.output-header {
  padding: 12px 0;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 12px;
}

.terminal-output {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.5;
  background: #1a1a2e;
  color: #eee;
  padding: 12px;
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  min-height: 100px;
}

.output-section :deep(.el-empty) {
  padding: 40px 0;
}
</style>
