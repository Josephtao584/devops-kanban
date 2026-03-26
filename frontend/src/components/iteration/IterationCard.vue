<template>
  <el-card class="iteration-card" shadow="hover" @click="$emit('click', iteration)">
    <template #header>
      <div class="card-header">
        <div class="iteration-title">
          <el-icon size="20"><Timer /></el-icon>
          <span class="iteration-name">{{ iteration.name }}</span>
        </div>
        <el-tag :type="statusType" size="small">{{ statusLabel }}</el-tag>
      </div>
    </template>

    <div class="card-body">
      <p class="iteration-description">{{ iteration.description || $t('iteration.noDescription') }}</p>

      <div v-if="iteration.goal" class="iteration-goal">
        <strong>{{ $t('iteration.goal') }}:</strong> {{ iteration.goal }}
      </div>

      <div v-if="iteration.start_date || iteration.end_date" class="iteration-dates">
        <div v-if="iteration.start_date" class="date">
          <el-icon><Calendar /></el-icon>
          <span>{{ $t('iteration.start') }}: {{ formatDate(iteration.start_date) }}</span>
        </div>
        <div v-if="iteration.end_date" class="date">
          <el-icon><Calendar /></el-icon>
          <span>{{ $t('iteration.end') }}: {{ formatDate(iteration.end_date) }}</span>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="card-footer">
        <div class="progress-info">
          <span class="progress-text">{{ iteration.done_count || 0 }} / {{ iteration.task_count || 0 }}</span>
          <span class="progress-percent">{{ progress }}%</span>
        </div>
        <el-progress :percentage="progress" :status="progressStatus" />
        <div class="card-actions">
          <el-button link type="primary" @click.stop="$emit('edit', iteration)">
            <el-icon><Edit /></el-icon>
          </el-button>
          <el-button link type="danger" @click.stop="$emit('delete', iteration)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
      </div>
    </template>
  </el-card>
</template>

<script setup>
import { computed } from 'vue'
import { Timer, Calendar, Edit, Delete } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  iteration: {
    type: Object,
    required: true
  }
})

defineEmits(['click', 'edit', 'delete'])

const statusMap = {
  PLANNED: { label: '计划中', type: 'info' },
  ACTIVE: { label: '进行中', type: 'warning' },
  COMPLETED: { label: '已完成', type: 'success' },
  ARCHIVED: { label: '已归档', type: 'info' }
}

const statusType = computed(() => {
  const status = props.iteration.status || 'PLANNED'
  return statusMap[status]?.type || 'info'
})

const statusLabel = computed(() => {
  const status = props.iteration.status || 'PLANNED'
  return statusMap[status]?.label || status
})

const progress = computed(() => {
  if (!props.iteration.task_count || props.iteration.task_count === 0) return 0
  return Math.round(((props.iteration.done_count || 0) / props.iteration.task_count) * 100)
})

const progressStatus = computed(() => {
  if (props.iteration.status === 'COMPLETED') return 'success'
  if (props.iteration.status === 'ARCHIVED') return ''
  return progress.value === 100 ? 'success' : ''
})

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString()
}
</script>

<style scoped>
.iteration-card {
  cursor: pointer;
  width: 100%;
  transition: transform 0.2s;
}

.iteration-card:hover {
  transform: translateY(-2px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.iteration-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.iteration-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.iteration-description {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.iteration-goal {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.iteration-dates {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.date {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.card-footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.progress-percent {
  font-weight: 600;
  color: var(--el-color-primary);
}
</style>
