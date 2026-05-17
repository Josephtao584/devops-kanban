<template>
  <BaseDialog
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    :title="$t('taskSource.syncHistoryTitle', '同步历史')"
    width="600px"
    append-to-body
  >
    <div v-if="loading" class="sync-history-loading">
      {{ $t('taskSource.syncHistoryLoading', '加载中...') }}
    </div>
    <div v-else-if="history.length === 0" class="sync-history-empty">
      {{ $t('taskSource.syncHistoryEmpty', '暂无同步记录') }}
    </div>
    <el-table v-else :data="history" size="small" stripe>
      <el-table-column :label="$t('taskSource.syncHistoryTime', '时间')" prop="startedAt" width="180">
        <template #default="{ row }">
          {{ row.startedAt ? formatDate(row.startedAt) : '-' }}
        </template>
      </el-table-column>
      <el-table-column :label="$t('taskSource.syncHistoryMode', '模式')" width="80">
        <template #default="{ row }">
          <el-tag :type="row.mode === 'ai' ? 'success' : 'info'" size="small">
            {{ row.mode === 'ai' ? $t('taskSource.syncHistoryModeAi', 'AI') : $t('taskSource.syncHistoryModeFixed', '固定') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="$t('taskSource.syncHistoryFiles', '文件数')" prop="fileCount" width="80" />
      <el-table-column :label="$t('taskSource.syncHistoryStatus', '状态')" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'COMPLETED' ? 'success' : row.status === 'FAILED' ? 'danger' : 'warning'" size="small">
            {{ row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="$t('taskSource.syncHistoryViewAnalysis', '查看分析')" width="100">
        <template #default="{ row }">
          <el-button v-if="row.mode === 'ai'" link type="primary" size="small" @click.stop="emit('view-analysis', row.sessionId)">
            {{ $t('taskSource.syncHistoryViewAnalysis', '查看分析') }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      v-if="pagination.total > pagination.pageSize"
      class="sync-history-pagination"
      v-model:current-page="pagination.page"
      v-model:page-size="pagination.pageSize"
      :total="pagination.total"
      :page-sizes="[10, 20, 50]"
      layout="total, prev, pager, next, sizes"
      size="small"
      @current-change="emit('page-change', pagination.page)"
      @size-change="emit('size-change', pagination.pageSize)"
    />
    <template #footer>
      <el-button @click.stop="visible = false">{{ $t('common.close', '关闭') }}</el-button>
    </template>
  </BaseDialog>
</template>

<script setup>
import BaseDialog from '../BaseDialog.vue'

defineProps({
  visible: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  history: { type: Array, default: () => [] },
  pagination: { type: Object, default: () => ({ page: 1, pageSize: 10, total: 0 }) }
})

const emit = defineEmits([
  'update:visible',
  'view-analysis',
  'page-change',
  'size-change'
])

const formatDate = (isoString) => {
  const date = new Date(isoString)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  if (isToday) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.sync-history-loading {
  text-align: center;
  padding: 20px;
  color: #909399;
}

.sync-history-empty {
  text-align: center;
  padding: 20px;
  color: #909399;
}

.sync-history-pagination {
  display: flex;
  justify-content: flex-end;
  padding: 12px 0 0;
}
</style>
