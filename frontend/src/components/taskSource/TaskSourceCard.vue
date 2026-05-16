<template>
  <div class="source-card">
    <div class="source-header">
      <div class="source-title-wrap">
        <h3>{{ source.name }}</h3>
        <div class="source-id">ID: {{ source.id }}</div>
      </div>
      <span class="source-type-badge">{{ getTypeLabel(source.type) }}</span>
    </div>

    <div class="source-details">
      <div class="detail-row">
        <span class="label">{{ $t('taskSource.lastSync', '最后同步') }}</span>
        <span class="value">{{ formatDateTimeWithFallback(source.last_sync_at) }}</span>
      </div>
      <div class="detail-row">
        <span class="label">{{ $t('taskSource.status', '状态') }}</span>
        <span class="value" :class="{ 'value-enabled': source.enabled }">
          {{ source.enabled ? $t('taskSource.enabled', '已启用') : $t('taskSource.disabled', '已禁用') }}
        </span>
      </div>
    </div>

    <div v-if="source.sync_schedule" class="source-schedule-badge">
      <span class="schedule-dot"></span>
      <span class="schedule-text">{{ formatScheduleLabel(source.sync_schedule) }}</span>
    </div>

    <div class="source-actions">
      <el-button size="small" type="primary" @click.stop="emit('sync', source)" :disabled="syncing">
        {{ syncing ? '同步中...' : $t('taskSource.sync', '同步') }}
      </el-button>
      <el-button size="small" @click.stop="emit('sync-history', source)">
        {{ $t('taskSource.syncHistory', '历史') }}
      </el-button>
      <el-button size="small" @click.stop="emit('edit', source)">
        {{ $t('taskSource.edit', '编辑') }}
      </el-button>
      <el-button size="small" type="danger" plain @click.stop="emit('delete', source)">
        {{ $t('taskSource.delete', '删除') }}
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { formatDateTime } from '../../utils/dateFormat'

defineProps({
  source: { type: Object, required: true },
  syncing: { type: Boolean, default: false }
})

const emit = defineEmits(['sync', 'sync-history', 'edit', 'delete'])

const { t } = useI18n()

const formatDateTimeWithFallback = (dateStr) => formatDateTime(dateStr, { fallback: '-' })

const scheduleLabels = {
  '*/5 * * * *': '每5分钟',
  '*/15 * * * *': '每15分钟',
  '*/30 * * * *': '每30分钟',
  '0 * * * *': '每小时',
  '0 */6 * * *': '每6小时',
  '0 0 * * *': '每天',
}

const formatScheduleLabel = (cronExpr) => scheduleLabels[cronExpr] || cronExpr

const getTypeLabel = (type) => {
  const translated = t(`taskSource.types.${type}`)
  return translated === `taskSource.types.${type}` ? type : translated
}
</script>

<style scoped>
.source-card {
  background: var(--bg-primary);
  border-radius: var(--radius-md);
  padding: 14px;
  border: 1px solid var(--border-color);
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.source-card:hover {
  border-color: var(--accent-color);
  box-shadow: 0 2px 8px rgba(37, 198, 201, 0.1);
}

.source-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.source-title-wrap {
  flex: 1;
  min-width: 0;
}

.source-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-id {
  margin-top: 2px;
  font-size: 11px;
  color: var(--text-muted);
  word-break: break-all;
}

.source-type-badge {
  background: var(--accent-color-soft);
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  color: var(--accent-color-strong);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
  flex-shrink: 0;
}

.source-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  gap: 10px;
}

.detail-row .label {
  color: var(--text-muted);
}

.detail-row .value {
  color: var(--text-primary);
  font-weight: 500;
  text-align: right;
}

.detail-row .value-enabled {
  color: var(--done-strong);
}

.source-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
}

.source-actions :deep(.el-button) {
  min-height: 26px;
  padding: 3px 10px;
  font-size: 12px;
  margin: 0;
}

.source-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.source-schedule-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--accent-color-soft);
  padding: 4px 8px;
  border-radius: 4px;
  align-self: flex-start;
}

.schedule-dot {
  width: 6px;
  height: 6px;
  background: var(--accent-color);
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.schedule-text {
  font-size: 11px;
  font-weight: 500;
  color: var(--accent-color-strong);
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.4; }
  100% { opacity: 1; }
}
</style>
